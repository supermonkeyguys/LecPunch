import { app, BrowserWindow, desktopCapturer, dialog, ipcMain, Menu, nativeImage, net, Notification, protocol, screen, session, shell, Tray } from 'electron';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

protocol.registerSchemesAsPrivileged([
  { scheme: 'lecpunch-assets', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
]);

// Electron Builder does not follow pnpm workspace links when an application
// opts out of automatic dependency discovery. Keep the native global-input
// hook as an explicit packaged resource, while development continues to use
// the workspace module directly.
const nativeModuleRoot = app.isPackaged
  ? path.join(process.resourcesPath, 'native-modules', 'node_modules', 'uiohook-napi')
  : 'uiohook-napi';
const { uIOhook, UiohookKey } = require(nativeModuleRoot) as typeof import('uiohook-napi');

let mainWindow: BrowserWindow | null = null;
let companionWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let companionOverlayState = { menuOpen: false, settingsOpen: false };
let companionLayoutEditorActive = false;
let companionPointerDown: { x: number; y: number; windowX: number; windowY: number; dragging: boolean } | null = null;
let companionDragTimer: ReturnType<typeof setInterval> | null = null;
let lastCompanionGazeAt = 0;
const COMPANION_GAZE_INTERVAL_MS = 1000 / 30;
// Development-only evidence for window visibility investigations. The logger
// is inert unless the local launcher provides an explicit writable file path.
const diagnosticArgument = process.argv.find((argument) => argument.startsWith('--lecpunch-window-diagnostic-path='));
const windowDiagnosticPath = process.env.LECPUNCH_WINDOW_DIAGNOSTIC_PATH
  ?? diagnosticArgument?.slice('--lecpunch-window-diagnostic-path='.length);
const writeWindowDiagnostic = (event: string, name: string, window?: BrowserWindow | null, details?: unknown) => {
  if (!windowDiagnosticPath) return;
  try {
    fs.appendFileSync(windowDiagnosticPath, `${JSON.stringify({
      at: new Date().toISOString(),
      event,
      name,
      visible: window?.isDestroyed() ? false : window?.isVisible(),
      bounds: window?.isDestroyed() ? undefined : window?.getBounds(),
      details
    })}\n`, 'utf8');
  } catch {
    // Diagnostics must never prevent the desktop client from opening.
  }
};
const observeWindowDiagnostics = (name: string, window: BrowserWindow) => {
  writeWindowDiagnostic('created', name, window);
  window.on('ready-to-show', () => writeWindowDiagnostic('ready-to-show', name, window));
  window.on('show', () => writeWindowDiagnostic('show', name, window));
  window.on('hide', () => writeWindowDiagnostic('hide', name, window));
  window.on('unresponsive', () => writeWindowDiagnostic('unresponsive', name, window));
  window.on('closed', () => writeWindowDiagnostic('closed', name, window));
  window.webContents.on('did-finish-load', () => writeWindowDiagnostic('did-finish-load', name, window));
  window.webContents.on('did-fail-load', (_event, code, description, url) => writeWindowDiagnostic('did-fail-load', name, window, { code, description, url }));
  window.webContents.on('render-process-gone', (_event, details) => writeWindowDiagnostic('render-process-gone', name, window, details));
  window.webContents.on('console-message', (event) => writeWindowDiagnostic('web-console', name, window, {
    level: event.level,
    message: event.message,
    line: event.lineNumber,
    sourceId: event.sourceId
  }));
};
// The transparent host stays fixed. Only the model inside it scales, leaving
// the menu bubbles in the same desktop coordinates at every size.
const COMPANION_WINDOW_WIDTH = 780;
const COMPANION_WINDOW_HEIGHT = 520;
type CompanionSkinId = string;
type CompanionSettings = { scale: number; visible: boolean; replyTemplate: string; skinId: CompanionSkinId; modelVersion: 2 };
type MeetingSettings = { meetingOrigin: string };
type AppearanceSettings = { backgroundFile: string; backgroundOpacity: number; backgroundBlur: number };
type QuietNotificationResult = { enabled: boolean; managedApps: string[]; message: string };
let companionSettings: CompanionSettings = { scale: 1, visible: true, replyTemplate: '{username} {message}', skinId: 'standard-default', modelVersion: 2 };
let meetingSettings: MeetingSettings = { meetingOrigin: '' };
let appearanceSettings: AppearanceSettings = { backgroundFile: '', backgroundOpacity: 62, backgroundBlur: 0 };
let quietNotificationConsentGranted = false;
const quietNotificationBackup = new Map<string, string | null>();
let quietPopupGuard: ChildProcess | null = null;

const companionSettingsPath = () => path.join(app.getPath('userData'), 'companion-settings.json');
const normalizeCompanionSettings = (settings: Partial<CompanionSettings>): CompanionSettings => ({
  // The desktop control is a continuous slider. Clamp persisted values too so a
  // manually edited preference file can never create an impractically sized pet.
  scale: Number.isFinite(Number(settings.scale))
    ? Math.round(Math.max(0.5, Math.min(1.3, Number(settings.scale))) * 100) / 100
    : companionSettings.scale,
  visible: typeof settings.visible === 'boolean' ? settings.visible : companionSettings.visible,
  replyTemplate: typeof settings.replyTemplate === 'string' && settings.replyTemplate.trim().length > 0
    ? settings.replyTemplate.trim().slice(0, 80)
    : companionSettings.replyTemplate,
  skinId: settings.skinId === undefined
    ? companionSettings.skinId
    : typeof settings.skinId === 'string' && companionSkinExists(settings.skinId)
      ? settings.skinId
      // Invalid or stale skin ids fall back safely, but a partial settings
      // update must never discard the currently selected valid skin.
      : 'standard-default',
  modelVersion: 2
});
const loadCompanionSettings = () => {
  try {
    const saved = JSON.parse(fs.readFileSync(companionSettingsPath(), 'utf8')) as Partial<CompanionSettings>;
    // Version 1 only knew keyboard skins. Migrate it once, while version 2
    // keeps a deliberate keyboard selection unchanged across app restarts.
    companionSettings = normalizeCompanionSettings(saved.modelVersion === 2 ? saved : { ...saved, skinId: 'standard-default' });
    if (saved.modelVersion !== 2) saveCompanionSettings();
  } catch {
    // First launch and malformed preference files both fall back to the safe defaults.
  }
};
const saveCompanionSettings = () => fs.writeFileSync(companionSettingsPath(), JSON.stringify(companionSettings));
const meetingSettingsPath = () => path.join(app.getPath('userData'), 'meeting-settings.json');
const isPrivateMeetingHost = (hostname: string) => {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local')) return true;
  const parts = host.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168);
};
const normalizeMeetingOrigin = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return '';
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('会议地址格式无效。');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) {
    throw new Error('会议地址必须是无路径、无账号信息的 HTTPS 局域网地址。');
  }
  if (!isPrivateMeetingHost(url.hostname)) throw new Error('仅允许配置局域网 IP、localhost 或 .local 会议主机。');
  return url.origin;
};
const loadMeetingSettings = () => {
  try {
    const saved = JSON.parse(fs.readFileSync(meetingSettingsPath(), 'utf8')) as Partial<MeetingSettings>;
    meetingSettings = { meetingOrigin: normalizeMeetingOrigin(saved.meetingOrigin) };
  } catch {
    meetingSettings = { meetingOrigin: '' };
  }
};
const saveMeetingSettings = () => fs.writeFileSync(meetingSettingsPath(), JSON.stringify(meetingSettings));
const appearanceSettingsPath = () => path.join(app.getPath('userData'), 'appearance-settings.json');
const appearanceBackgroundRoot = () => path.join(app.getPath('userData'), 'main-background');
const normalizeAppearanceSettings = (settings: Partial<AppearanceSettings>): AppearanceSettings => ({
  backgroundFile: typeof settings.backgroundFile === 'string' && /^[a-z0-9-]+\.(?:png|jpe?g|webp)$/i.test(settings.backgroundFile)
    ? settings.backgroundFile : '',
  backgroundOpacity: Number.isFinite(Number(settings.backgroundOpacity))
    ? Math.round(Math.max(0, Math.min(100, Number(settings.backgroundOpacity)))) : 62,
  backgroundBlur: Number.isFinite(Number(settings.backgroundBlur))
    ? Math.round(Math.max(0, Math.min(24, Number(settings.backgroundBlur)))) : 0
});
const loadAppearanceSettings = () => {
  try {
    appearanceSettings = normalizeAppearanceSettings(JSON.parse(fs.readFileSync(appearanceSettingsPath(), 'utf8')) as Partial<AppearanceSettings>);
  } catch {
    appearanceSettings = { backgroundFile: '', backgroundOpacity: 62, backgroundBlur: 0 };
  }
  if (appearanceSettings.backgroundFile && !fs.existsSync(path.join(appearanceBackgroundRoot(), appearanceSettings.backgroundFile))) {
    appearanceSettings.backgroundFile = '';
  }
};
const saveAppearanceSettings = () => fs.writeFileSync(appearanceSettingsPath(), JSON.stringify(appearanceSettings));
const getAppearanceSettingsForRenderer = () => {
  const file = appearanceSettings.backgroundFile;
  const filePath = file ? path.join(appearanceBackgroundRoot(), file) : '';
  const version = filePath && fs.existsSync(filePath) ? fs.statSync(filePath).mtimeMs : 0;
  return {
    backgroundOpacity: appearanceSettings.backgroundOpacity,
    backgroundBlur: appearanceSettings.backgroundBlur,
    backgroundUrl: file && version ? `lecpunch-assets://appearance/${encodeURIComponent(file)}?v=${version}` : ''
  };
};
const selectAppearanceBackground = async () => {
  const result = await dialog.showOpenDialog(mainWindow ?? companionWindow!, {
    title: '选择工作台背景图片',
    properties: ['openFile'],
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
  });
  if (result.canceled || !result.filePaths[0]) return getAppearanceSettingsForRenderer();
  const source = result.filePaths[0];
  const extension = path.extname(source).toLowerCase();
  if (!['.png', '.jpg', '.jpeg', '.webp'].includes(extension)) throw new Error('仅支持 PNG、JPG、JPEG 或 WebP 背景图片。');
  if (fs.statSync(source).size > 15 * 1024 * 1024) throw new Error('背景图片请控制在 15MB 以内。');
  fs.mkdirSync(appearanceBackgroundRoot(), { recursive: true });
  const filename = `main-background${extension === '.jpeg' ? '.jpg' : extension}`;
  fs.copyFileSync(source, path.join(appearanceBackgroundRoot(), filename));
  appearanceSettings.backgroundFile = filename;
  saveAppearanceSettings();
  return getAppearanceSettingsForRenderer();
};
const clearAppearanceBackground = () => {
  const file = appearanceSettings.backgroundFile;
  if (file) fs.rmSync(path.join(appearanceBackgroundRoot(), file), { force: true });
  appearanceSettings.backgroundFile = '';
  saveAppearanceSettings();
  return getAppearanceSettingsForRenderer();
};
const isConfiguredMeetingUrl = (value: string) => {
  if (!meetingSettings.meetingOrigin) return false;
  try {
    return new URL(value).origin === meetingSettings.meetingOrigin;
  } catch {
    return false;
  }
};

// The captain's LAN Jitsi uses a local certificate. Do not disable certificate
// verification globally: only the exact origin stored in meeting-settings.json
// may use this narrow fallback when the operating system does not trust its CA.
app.on('certificate-error', (event, _webContents, url, _error, _certificate, callback) => {
  if (!isConfiguredMeetingUrl(url)) return callback(false);
  event.preventDefault();
  callback(true);
});
const quietNotificationSettingsPath = () => path.join(app.getPath('userData'), 'quiet-notification-settings.json');
const loadQuietNotificationSettings = () => {
  try {
    const saved = JSON.parse(fs.readFileSync(quietNotificationSettingsPath(), 'utf8')) as { consentGranted?: boolean; backup?: Record<string, string | null> };
    quietNotificationConsentGranted = saved.consentGranted === true;
    Object.entries(saved.backup ?? {}).forEach(([key, value]) => quietNotificationBackup.set(key, value));
  } catch {
    // First launch has no notification changes to restore.
  }
};
const saveQuietNotificationSettings = () => fs.writeFileSync(quietNotificationSettingsPath(), JSON.stringify({
  consentGranted: quietNotificationConsentGranted,
  backup: Object.fromEntries(quietNotificationBackup)
}));
const runReg = (args: string[]) => new Promise<{ stdout: string }>((resolve, reject) => {
  execFile('reg.exe', args, { windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => {
    if (error) reject(error);
    else resolve({ stdout });
  });
});
const notificationSettingsRoot = 'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings';
const quietPopupGuardPath = () => path.join(app.getPath('userData'), 'quiet-popup-guard.ps1');
const quietPopupGuardScript = `
$source = @'
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
public static class LecPunchQuietWindowGuard {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr data);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int command);
}
'@
Add-Type -TypeDefinition $source
while ($true) {
  [LecPunchQuietWindowGuard]::EnumWindows({
    param($handle, $unused)
    if (-not [LecPunchQuietWindowGuard]::IsWindowVisible($handle)) { return $true }
    $processId = [uint32]0
    [LecPunchQuietWindowGuard]::GetWindowThreadProcessId($handle, [ref]$processId) | Out-Null
    try { $process = Get-Process -Id $processId -ErrorAction Stop } catch { return $true }
    if ($process.ProcessName -notmatch '^(QQ|WeChat|Weixin)$') { return $true }
    $rect = [LecPunchQuietWindowGuard+RECT]::new()
    [LecPunchQuietWindowGuard]::GetWindowRect($handle, [ref]$rect) | Out-Null
    $width = $rect.Right - $rect.Left
    $height = $rect.Bottom - $rect.Top
    # Preserve full chat windows. QQ/WeChat native notification panes are
    # short, secondary top-level windows; hide only that constrained shape.
    if ($width -ge 160 -and $width -le 700 -and $height -ge 55 -and $height -le 420) {
      [LecPunchQuietWindowGuard]::ShowWindow($handle, 0) | Out-Null
    }
    return $true
  }, [IntPtr]::Zero) | Out-Null
  Start-Sleep -Milliseconds 150
}
`;
const setQuietNativePopupGuard = (enabled: boolean) => {
  if (process.platform !== 'win32') return false;
  if (!enabled) {
    quietPopupGuard?.kill();
    quietPopupGuard = null;
    return false;
  }
  if (quietPopupGuard && !quietPopupGuard.killed) return true;
  try {
    fs.writeFileSync(quietPopupGuardPath(), quietPopupGuardScript, 'utf8');
    quietPopupGuard = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', quietPopupGuardPath()], { windowsHide: true, stdio: 'ignore' });
    quietPopupGuard.once('exit', () => { quietPopupGuard = null; });
    return true;
  } catch {
    quietPopupGuard = null;
    return false;
  }
};
const quietAppKind = (key: string): '微信' | 'QQ' | null => {
  const appId = key.split('\\').pop()?.toLowerCase() ?? '';
  // Keep this deliberately strict: QQLive and other Tencent products must not
  // be muted when the user only asks to silence QQ / WeChat messages.
  if (/(^|[!._-])(wechat|weixin|wecom|tencentwechat|tencentwework)([!._-]|$)/i.test(appId)) return '微信';
  if (/(^|!)(qq|tencentqq|qq\.exe|com\.tencent\.qq)(?=$|[._-])/i.test(appId)) return 'QQ';
  return null;
};
const findQuietAppNotificationKeys = async () => {
  const { stdout } = await runReg(['query', notificationSettingsRoot, '/s']);
  return [...new Set(stdout.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.startsWith('HKEY_CURRENT_USER\\') && quietAppKind(line)))];
};
const readEnabledValue = async (key: string) => {
  try {
    const { stdout } = await runReg(['query', key, '/v', 'Enabled']);
    const match = stdout.match(/Enabled\s+REG_DWORD\s+(0x[\da-f]+)/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};
const setQuietAppNotifications = async (enabled: boolean): Promise<QuietNotificationResult> => {
  if (process.platform !== 'win32') return { enabled: false, managedApps: [], message: '该功能仅支持 Windows。' };
  if (enabled && !quietNotificationConsentGranted) {
    const promptOptions = {
      type: 'question' as const,
      buttons: ['取消', '授权并开启'] as string[],
      defaultId: 1,
      cancelId: 0,
      title: '授权管理 QQ / 微信通知',
      message: '允许 LecPunch 管理 Windows 已登记的 QQ、微信通知吗？',
      detail: '开启后会暂时关闭这些应用的 Windows 通知横幅与提示音；退出免提示模式时会恢复你此前的设置。不会读取聊天内容、账号或文件。'
    };
    const parentWindow = mainWindow ?? companionWindow;
    const result = parentWindow ? await dialog.showMessageBox(parentWindow, promptOptions) : await dialog.showMessageBox(promptOptions);
    if (result.response !== 1) return { enabled: false, managedApps: [], message: '未授予 QQ、微信通知管理权限。' };
    quietNotificationConsentGranted = true;
    saveQuietNotificationSettings();
  }
  let keys: string[] = [];
  let popupGuardActive = false;
  try {
    keys = await findQuietAppNotificationKeys();
    for (const key of keys) {
      if (enabled) {
        if (!quietNotificationBackup.has(key)) quietNotificationBackup.set(key, await readEnabledValue(key));
        await runReg(['add', key, '/v', 'Enabled', '/t', 'REG_DWORD', '/d', '0', '/f']);
      } else if (quietNotificationBackup.has(key)) {
        const previous = quietNotificationBackup.get(key);
        if (previous) await runReg(['add', key, '/v', 'Enabled', '/t', 'REG_DWORD', '/d', String(Number.parseInt(previous, 16)), '/f']);
        else await runReg(['delete', key, '/v', 'Enabled', '/f']);
      }
    }
    if (!enabled) quietNotificationBackup.clear();
    saveQuietNotificationSettings();
  } catch {
    popupGuardActive = setQuietNativePopupGuard(enabled);
    return { enabled: false, managedApps: [], message: popupGuardActive ? 'Windows 横幅设置暂时无法修改，但 QQ/微信原生通知窗拦截已开启。' : 'Windows 通知设置暂时无法修改；可改用 Windows 专注助手。' };
  }
  popupGuardActive = setQuietNativePopupGuard(enabled);
  const managedApps = keys.map((key) => quietAppKind(key)).filter((name): name is '微信' | 'QQ' => Boolean(name));
  if (!managedApps.length) return { enabled, managedApps: [], message: enabled && popupGuardActive ? '未发现已登记的 Windows 横幅；QQ/微信原生通知窗拦截已开启。' : '未发现已登记的 QQ 或微信 Windows 通知。请先让对应软件产生一次系统通知后，再重新开启免提示模式。' };
  return { enabled, managedApps: [...new Set(managedApps)], message: enabled ? `已关闭 ${[...new Set(managedApps)].join('、')} 的 Windows 通知${popupGuardActive ? '，并开启原生通知窗拦截。' : '。'}` : `已恢复 ${[...new Set(managedApps)].join('、')} 的原通知设置，并停止原生通知窗拦截。` };
};
type BongoSkinLayout = {
  scene: 'standard' | 'keyboard';
  label: string;
  backgroundFile: string;
  canvas: { width: number; height: number };
  stage: { left: number; bottom: number; width: number; height: number };
  model: { left: number; bottom: number; width: number; height: number; renderScale?: number; renderOffsetX?: number; renderOffsetY?: number };
  menu: {
    anchorX: number; anchorY: number; scaleOffsetX: number; scaleOffsetY: number;
    actionOffsets: Array<{ x: number; y: number }>; spacing: number; bubbleSize: number;
  };
  orbit: { right: number; bottom: number };
  message: { left: number; top: number };
  keys: { aliases?: Record<string, string>; leftOverlays: string[]; rightOverlays: string[] };
};
type CompanionSkinDescriptor = { id: string; scene: BongoSkinLayout['scene']; label: string; directory: string; source: 'builtin' | 'user'; backgroundFile: string; coverFile: string; pricePoints: number; isFree: boolean };
type CompanionLayoutOverride = { menu?: Partial<BongoSkinLayout['menu']> };
const DEFAULT_BUBBLE_OFFSETS = [{ x: -71, y: 65 }, { x: -126, y: 12 }, { x: -130, y: -55 }, { x: -79, y: -108 }, { x: -8, y: -129 }];
const BUILTIN_SKINS: Array<Pick<CompanionSkinDescriptor, 'id' | 'directory' | 'source'>> = [
  { id: 'standard-default', directory: 'standard/default', source: 'builtin' },
  { id: 'keyboard', directory: 'keyboard', source: 'builtin' },
  { id: 'sanren-keyboard', directory: 'skins/sanren-keyboard', source: 'builtin' },
  { id: 'aixiya', directory: 'standard/market/aixiya', source: 'builtin' },
  { id: 'ailixiya', directory: 'standard/market/ailixiya', source: 'builtin' },
  { id: 'power-cat', directory: 'standard/market/power-cat', source: 'builtin' },
  { id: 'feibi', directory: 'standard/market/feibi', source: 'builtin' },
  { id: 'keli', directory: 'standard/market/keli', source: 'builtin' },
  { id: 'liuying', directory: 'standard/market/liuying', source: 'builtin' },
  { id: 'luoxiaohei', directory: 'standard/market/luoxiaohei', source: 'builtin' },
  { id: 'nailin', directory: 'standard/market/nailin', source: 'builtin' },
  { id: 'pidan', directory: 'standard/market/pidan', source: 'builtin' },
  { id: 'sangonomiya-kokomi', directory: 'standard/market/sangonomiya-kokomi', source: 'builtin' },
  { id: 'xiaoyao-sanren', directory: 'standard/market/xiaoyao-sanren', source: 'builtin' },
  { id: 'red-panda-haohao', directory: 'standard/market/red-panda-haohao', source: 'builtin' },
  { id: 'oyama-mahiru', directory: 'standard/market/oyama-mahiru', source: 'builtin' },
  { id: 'zimin', directory: 'standard/market/zimin', source: 'builtin' },
  { id: 'ziyin', directory: 'standard/market/ziyin', source: 'builtin' },
  { id: 'doro', directory: 'standard/market/doro', source: 'builtin' }
];
const fallbackSkinLayout: BongoSkinLayout = {
  scene: 'standard',
  label: '默认标准小猫',
  backgroundFile: 'resources/background.png',
  canvas: { width: COMPANION_WINDOW_WIDTH, height: COMPANION_WINDOW_HEIGHT },
  stage: { left: 0, bottom: 0, width: 780, height: 520 },
  model: { left: 84, bottom: 58, width: 612, height: 354 },
  // Keep all five controls beside the cat's head. Their shared fan offsets
  // extend 130px left and 129px up from this anchor.
  menu: { anchorX: 630, anchorY: 180, scaleOffsetX: 0, scaleOffsetY: 0, actionOffsets: DEFAULT_BUBBLE_OFFSETS, spacing: 1, bubbleSize: 44 },
  orbit: { right: 130, bottom: 92 },
  message: { left: 340, top: 10 },
  keys: { leftOverlays: [], rightOverlays: [] }
};
const isPositiveNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const isSafeRelativePath = (value: unknown): value is string => typeof value === 'string'
  && value.length > 0 && value.length <= 240 && !path.isAbsolute(value)
  && !value.includes('\0') && !/[?#]/.test(value) && !/^[a-z][a-z0-9+.-]*:/i.test(value)
  && !value.split(/[\\/]/).some((part) => part === '..' || part === '');
const isScene = (value: unknown): value is BongoSkinLayout['scene'] => value === 'standard' || value === 'keyboard';
const normalizeMenu = (value: Partial<BongoSkinLayout['menu']> | undefined, fallback = fallbackSkinLayout.menu): BongoSkinLayout['menu'] => {
  const offsets = Array.isArray(value?.actionOffsets) && value.actionOffsets.length === 5
    && value.actionOffsets.every((item) => item && Number.isFinite(item.x) && Number.isFinite(item.y))
    ? value.actionOffsets.map((item) => ({ x: Number(item.x), y: Number(item.y) }))
    : fallback.actionOffsets.map((item) => ({ ...item }));
  const number = (candidate: unknown, current: number, minimum: number, maximum: number) => Number.isFinite(Number(candidate))
    ? Math.max(minimum, Math.min(maximum, Number(candidate))) : current;
  return {
    anchorX: number(value?.anchorX, fallback.anchorX, -500, 1280),
    anchorY: number(value?.anchorY, fallback.anchorY, -500, 1280),
    scaleOffsetX: number(value?.scaleOffsetX, fallback.scaleOffsetX, -500, 500),
    scaleOffsetY: number(value?.scaleOffsetY, fallback.scaleOffsetY, -500, 500),
    actionOffsets: offsets,
    spacing: number(value?.spacing, fallback.spacing, 0.5, 1.8),
    bubbleSize: number(value?.bubbleSize, fallback.bubbleSize, 32, 72)
  };
};
const normalizeSkinLayout = (value: unknown, fallback = fallbackSkinLayout): BongoSkinLayout | null => {
  const layout = value as Partial<BongoSkinLayout>;
  if (!layout || !isScene(layout.scene) || typeof layout.label !== 'string' || !layout.label.trim() || !isSafeRelativePath(layout.backgroundFile)
    || !layout.canvas || !layout.stage || !layout.model || !layout.orbit || !layout.message || !layout.keys
    || !isPositiveNumber(layout.canvas.width) || !isPositiveNumber(layout.canvas.height)
    || !isPositiveNumber(layout.stage.width) || !isPositiveNumber(layout.stage.height)
    || !isPositiveNumber(layout.model.width) || !isPositiveNumber(layout.model.height)
    || !Number.isFinite(layout.stage.left) || !Number.isFinite(layout.stage.bottom)
    || !Number.isFinite(layout.model.left) || !Number.isFinite(layout.model.bottom)
    || !Number.isFinite(layout.orbit.right) || !Number.isFinite(layout.orbit.bottom)
    || !Number.isFinite(layout.message.left) || !Number.isFinite(layout.message.top)
    || !Array.isArray(layout.keys.leftOverlays) || !Array.isArray(layout.keys.rightOverlays)) return null;
  return {
    scene: layout.scene,
    label: layout.label.trim().slice(0, 80),
    backgroundFile: layout.backgroundFile,
    canvas: { width: layout.canvas.width, height: layout.canvas.height },
    stage: { left: layout.stage.left, bottom: layout.stage.bottom, width: layout.stage.width, height: layout.stage.height },
    model: { ...layout.model },
    menu: normalizeMenu(layout.menu, fallback.menu),
    orbit: { right: layout.orbit.right, bottom: layout.orbit.bottom },
    message: { left: layout.message.left, top: layout.message.top },
    keys: {
      aliases: layout.keys.aliases && typeof layout.keys.aliases === 'object' ? layout.keys.aliases : undefined,
      leftOverlays: layout.keys.leftOverlays.filter((key): key is string => typeof key === 'string'),
      rightOverlays: layout.keys.rightOverlays.filter((key): key is string => typeof key === 'string')
    }
  };
};
const builtInSkinRoot = () => app.isPackaged ? path.join(app.getAppPath(), 'dist', 'bongocat') : path.join(app.getAppPath(), 'public', 'bongocat');
const importedSkinRoot = () => path.join(app.getPath('userData'), 'bongocat-skins');
const skinOverrideRoot = () => path.join(app.getPath('userData'), 'skin-overrides');
const layoutPathForSkin = (skin: CompanionSkinDescriptor) => path.join(skin.source === 'builtin' ? builtInSkinRoot() : importedSkinRoot(), skin.directory, 'layout.json');
const readJsonFile = (filePath: string): unknown | null => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  } catch {
    return null;
  }
};
const hasSkinFile = (root: string, relativePath: unknown) => {
  if (!isSafeRelativePath(relativePath)) return false;
  const candidate = path.join(root, relativePath);
  return candidate.startsWith(`${root}${path.sep}`) && fs.existsSync(candidate) && fs.statSync(candidate).isFile();
};
const scanOverlayNames = (root: string, side: 'left' | 'right') => {
  const overlayRoot = path.join(root, 'resources', `${side}-keys`);
  try {
    return fs.readdirSync(overlayRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === '.png')
      .map((entry) => path.basename(entry.name, path.extname(entry.name)))
      .filter((name) => name.length > 0 && isSafeRelativePath(`${name}.png`))
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
};
const generatedSkinLabel = (directoryName: string) => {
  const label = directoryName.replace(/\s*-\s*标准模式\s*$/u, '').trim();
  return (label || '导入标准小猫').slice(0, 80);
};
const generateImportedSkinLayout = (sourceRoot: string): BongoSkinLayout => ({
  ...JSON.parse(JSON.stringify(fallbackSkinLayout)) as BongoSkinLayout,
  scene: 'standard',
  label: generatedSkinLabel(path.basename(sourceRoot)),
  backgroundFile: 'resources/background.png',
  keys: {
    leftOverlays: scanOverlayNames(sourceRoot, 'left'),
    rightOverlays: scanOverlayNames(sourceRoot, 'right')
  }
});
const validateRequiredModelReferences = (sourceRoot: string): string | null => {
  const model = readJsonFile(path.join(sourceRoot, 'cat.model3.json')) as { FileReferences?: Record<string, unknown> } | null;
  const references = model?.FileReferences;
  if (!references || typeof references !== 'object') return 'cat.model3.json 缺少 FileReferences。';
  if (!isSafeRelativePath(references.Moc)) return 'cat.model3.json 的 Moc 路径无效。';
  if (!Array.isArray(references.Textures) || references.Textures.length === 0 || !references.Textures.every(isSafeRelativePath)) {
    return 'cat.model3.json 的 Textures 路径无效。';
  }
  const required = [references.Moc, ...references.Textures, ...(references.Physics === undefined ? [] : [references.Physics])];
  const invalid = required.find((file) => !isSafeRelativePath(file));
  if (invalid) return `cat.model3.json 包含不安全的引用路径：${String(invalid)}。`;
  const missing = required.find((file) => !hasSkinFile(sourceRoot, file));
  return missing ? `cat.model3.json 引用的必需文件不存在：${String(missing)}。` : null;
};
const stableImportedSkinId = (sourceRoot: string) => {
  const directoryName = path.basename(sourceRoot);
  const slug = directoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 42) || 'skin';
  const suffix = createHash('sha256').update(directoryName).digest('hex').slice(0, 8);
  return `user-${slug}-${suffix}`;
};
const readSkinDescriptor = (id: string, directory: string, source: CompanionSkinDescriptor['source']): CompanionSkinDescriptor | null => {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/i.test(id) || !isSafeRelativePath(directory)) return null;
  const layout = normalizeSkinLayout(readJsonFile(path.join(source === 'builtin' ? builtInSkinRoot() : importedSkinRoot(), directory, 'layout.json')));
  return layout ? {
    id, directory, source, scene: layout.scene, label: layout.label, backgroundFile: layout.backgroundFile,
    coverFile: 'resources/cover.png', isFree: id === 'standard-default', pricePoints: id === 'standard-default' ? 0 : 600
  } : null;
};
const listCompanionSkins = (): CompanionSkinDescriptor[] => {
  const builtins = BUILTIN_SKINS.map((skin) => readSkinDescriptor(skin.id, skin.directory, skin.source)).filter((skin): skin is CompanionSkinDescriptor => Boolean(skin));
  let imported: CompanionSkinDescriptor[] = [];
  try {
    imported = fs.readdirSync(importedSkinRoot(), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => readSkinDescriptor(entry.name, entry.name, 'user'))
      .filter((skin): skin is CompanionSkinDescriptor => Boolean(skin));
  } catch {
    // Imported skins are optional on a fresh profile.
  }
  return [...builtins, ...imported];
};
const getCompanionSkin = (skinId: string) => listCompanionSkins().find((skin) => skin.id === skinId && skin.scene === 'standard')
  ?? listCompanionSkins().find((skin) => skin.id === 'standard-default')!;
const companionSkinExists = (skinId: string) => listCompanionSkins().some((skin) => skin.id === skinId && skin.scene === 'standard');
const readCompanionLayoutOverride = (skinId: string): CompanionLayoutOverride => {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/i.test(skinId)) return {};
  const value = readJsonFile(path.join(skinOverrideRoot(), `${skinId}.json`)) as CompanionLayoutOverride | null;
  return value && typeof value === 'object' ? value : {};
};
const loadSkinLayout = (skinId = companionSettings.skinId): BongoSkinLayout => {
  const skin = getCompanionSkin(skinId);
  const base = normalizeSkinLayout(readJsonFile(layoutPathForSkin(skin))) ?? fallbackSkinLayout;
  const override = readCompanionLayoutOverride(skin.id);
  return { ...base, menu: normalizeMenu(override.menu, base.menu) };
};
const companionDimensions = () => {
  const { canvas } = loadSkinLayout();
  return { width: canvas.width, height: canvas.height };
};
const companionModelBounds = () => {
  if (!companionWindow || !companionWindow.isVisible()) return null;
  const [windowX, windowY] = companionWindow.getPosition();
  const scale = companionSettings.scale;
  const layout = loadSkinLayout();
  // `layout.json` is the single source for this native hit box and the
  // renderer CSS variables. The model scales from its bottom centre.
  const baseX = windowX + layout.stage.left + layout.model.left;
  const baseY = windowY + layout.canvas.height - layout.stage.bottom - layout.model.bottom - layout.model.height;
  return {
    x: baseX + (1 - scale) * (layout.model.width / 2),
    y: baseY + (1 - scale) * layout.model.height,
    width: layout.model.width * scale,
    height: layout.model.height * scale
  };
};
const clampUnit = (value: number) => Math.max(-1, Math.min(1, value));
const setCompanionGazeTracking = (active: boolean) => {
  lastCompanionGazeAt = 0;
  const window = companionWindow;
  if (!window || window.isDestroyed()) return;
  // This lifecycle message lets the renderer stop its rAF loop immediately
  // when the native companion is hidden or the layout editor takes over.
  window.webContents.send('bongo:gaze', { active, x: 0, y: 0 });
};
const sendCompanionGaze = () => {
  const window = companionWindow;
  if (!window || window.isDestroyed() || !window.isVisible() || companionLayoutEditorActive) return;
  const now = Date.now();
  if (now - lastCompanionGazeAt < COMPANION_GAZE_INTERVAL_MS) return;
  const bounds = companionModelBounds();
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
  const point = screen.getCursorScreenPoint();
  lastCompanionGazeAt = now;
  // Relative to the declarative model centre, never to the companion's
  // transparent host window. The renderer applies model-specific signs.
  window.webContents.send('bongo:gaze', {
    active: true,
    x: clampUnit((point.x - (bounds.x + bounds.width / 2)) / (bounds.width / 2)),
    y: clampUnit((point.y - (bounds.y + bounds.height / 2)) / (bounds.height / 2))
  });
};
const companionModelHitBounds = () => {
  const bounds = companionModelBounds();
  if (!bounds) return null;
  // Live2D art has transparent texture margins, so let the usable native hit
  // area extend a little past the declarative model box. This keeps dragging
  // faithful to what the user can see without turning the whole host window
  // into an invisible click blocker.
  const hitPadding = 28;
  return {
    x: bounds.x - hitPadding,
    y: bounds.y - hitPadding,
    width: bounds.width + hitPadding * 2,
    height: bounds.height + hitPadding * 2
  };
};
const isCursorOnCompanionModel = () => {
  const bounds = companionModelHitBounds();
  if (!bounds) return false;
  const point = screen.getCursorScreenPoint();
  return point.x >= bounds.x && point.x <= bounds.x + bounds.width
    && point.y >= bounds.y && point.y <= bounds.y + bounds.height;
};
const companionMenuAnchor = () => {
  const menu = loadSkinLayout().menu;
  return { x: menu.anchorX + companionSettings.scale * menu.scaleOffsetX, y: menu.anchorY + companionSettings.scale * menu.scaleOffsetY };
};
const companionBubbleBounds = (layout = loadSkinLayout()) => {
  const anchor = companionMenuAnchor();
  return layout.menu.actionOffsets.map((offset) => ({
    x: anchor.x + offset.x * layout.menu.spacing,
    y: anchor.y + offset.y * layout.menu.spacing,
    size: layout.menu.bubbleSize
  }));
};
const isCursorOnCompanionBubble = () => {
  if (!companionOverlayState.menuOpen) return false;
  if (!companionModelBounds() || !companionWindow) return false;
  const [windowX, windowY] = companionWindow.getPosition();
  const layout = loadSkinLayout();
  const point = screen.getCursorScreenPoint();
  return companionBubbleBounds(layout).some((bubble) => {
    const x = windowX + layout.stage.left + bubble.x;
    const y = windowY + layout.canvas.height - layout.stage.bottom - layout.stage.height + bubble.y;
    return point.x >= x && point.x <= x + bubble.size && point.y >= y && point.y <= y + bubble.size;
  });
};
const isCursorOnCompanionInteractiveSurface = () => {
  if (!companionWindow?.isVisible()) return false;
  // The settings panel has form controls whose exact footprint changes with
  // the selected scene. While open, keep this one native window interactive.
  if (companionOverlayState.settingsOpen) return true;
  return isCursorOnCompanionModel() || isCursorOnCompanionBubble();
};
const syncCompanionMouseCapture = () => {
  const window = companionWindow;
  if (!window || window.isDestroyed()) return;
  if (companionLayoutEditorActive) return;
  // Transparent space must never become an invisible rectangular blocker.
  // uIOhook turns native hit testing back on only above the model or controls.
  const ignore = !isCursorOnCompanionInteractiveSurface();
  window.setIgnoreMouseEvents(ignore, { forward: true });
};
const stopCompanionDragTracking = () => {
  if (!companionDragTimer) return;
  clearInterval(companionDragTimer);
  companionDragTimer = null;
};
const beginCompanionDragTracking = () => {
  const window = companionWindow;
  if (!window || window.isDestroyed() || companionLayoutEditorActive) return false;
  stopCompanionDragTracking();
  const screenPoint = screen.getCursorScreenPoint();
  const [windowX, windowY] = window.getPosition();
  companionPointerDown = { x: screenPoint.x, y: screenPoint.y, windowX, windowY, dragging: false };
  window.setIgnoreMouseEvents(false);
  // Polling the system cursor avoids gaps caused by Electron coalescing mouse
  // movement around a transparent native window.
  companionDragTimer = setInterval(updateCompanionDragPosition, 16);
  return true;
};
const updateCompanionDragPosition = () => {
  const pointer = companionPointerDown;
  const window = companionWindow;
  if (!pointer || !window || window.isDestroyed()) {
    stopCompanionDragTracking();
    return;
  }
  const point = screen.getCursorScreenPoint();
  const deltaX = point.x - pointer.x;
  const deltaY = point.y - pointer.y;
  if (!pointer.dragging && Math.hypot(deltaX, deltaY) > 6) {
    pointer.dragging = true;
  }
  if (pointer.dragging) {
    const nextX = pointer.windowX + deltaX;
    const nextY = pointer.windowY + deltaY;
    window.setPosition(nextX, nextY);
  }
};

const keyboardKeyMap = new Map<number, string>([
  [UiohookKey.A, 'KeyA'], [UiohookKey.B, 'KeyB'], [UiohookKey.C, 'KeyC'], [UiohookKey.D, 'KeyD'], [UiohookKey.E, 'KeyE'], [UiohookKey.F, 'KeyF'], [UiohookKey.G, 'KeyG'], [UiohookKey.H, 'KeyH'], [UiohookKey.I, 'KeyI'], [UiohookKey.J, 'KeyJ'], [UiohookKey.K, 'KeyK'], [UiohookKey.L, 'KeyL'], [UiohookKey.M, 'KeyM'], [UiohookKey.N, 'KeyN'], [UiohookKey.O, 'KeyO'], [UiohookKey.P, 'KeyP'], [UiohookKey.Q, 'KeyQ'], [UiohookKey.R, 'KeyR'], [UiohookKey.S, 'KeyS'], [UiohookKey.T, 'KeyT'], [UiohookKey.U, 'KeyU'], [UiohookKey.V, 'KeyV'], [UiohookKey.W, 'KeyW'], [UiohookKey.X, 'KeyX'], [UiohookKey.Y, 'KeyY'], [UiohookKey.Z, 'KeyZ'],
  [UiohookKey[0], 'Num0'], [UiohookKey[1], 'Num1'], [UiohookKey[2], 'Num2'], [UiohookKey[3], 'Num3'], [UiohookKey[4], 'Num4'], [UiohookKey[5], 'Num5'], [UiohookKey[6], 'Num6'], [UiohookKey[7], 'Num7'], [UiohookKey[8], 'Num8'], [UiohookKey[9], 'Num9'],
  [UiohookKey.Space, 'Space'], [UiohookKey.Enter, 'Return'], [UiohookKey.Backspace, 'Backspace'], [UiohookKey.Tab, 'Tab'], [UiohookKey.Escape, 'Escape'], [UiohookKey.CapsLock, 'CapsLock'], [UiohookKey.Delete, 'Delete'], [UiohookKey.Shift, 'ShiftLeft'], [UiohookKey.ShiftRight, 'ShiftRight'], [UiohookKey.Ctrl, 'ControlLeft'], [UiohookKey.CtrlRight, 'ControlRight'], [UiohookKey.Alt, 'Alt'], [UiohookKey.AltRight, 'AltGr'], [UiohookKey.Meta, 'Meta'], [UiohookKey.MetaRight, 'Meta'], [UiohookKey.ArrowUp, 'UpArrow'], [UiohookKey.ArrowDown, 'DownArrow'], [UiohookKey.ArrowLeft, 'LeftArrow'], [UiohookKey.ArrowRight, 'RightArrow']
]);

const getIconPath = () => app.isPackaged
  ? path.join(process.resourcesPath, 'icon.ico')
  : path.join(__dirname, '..', 'resources', 'icon.ico');
const setMainWindowTheme = (theme: 'light' | 'dark') => {
  if (!mainWindow || process.platform !== 'win32') return;
  mainWindow.setTitleBarOverlay(theme === 'dark'
    ? { color: '#00000000', symbolColor: '#d7edf9', height: 36 }
    : { color: '#00000000', symbolColor: '#36434d', height: 36 });
};

const showWindow = () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
};

const showCompanion = () => {
  if (companionLayoutEditorActive) return;
  companionSettings.visible = true;
  saveCompanionSettings();
  companionWindow?.showInactive();
  setCompanionGazeTracking(true);
  syncCompanionMouseCapture();
};

const hideCompanion = () => {
  companionSettings.visible = false;
  companionOverlayState = { menuOpen: false, settingsOpen: false };
  companionPointerDown = null;
  stopCompanionDragTracking();
  setCompanionGazeTracking(false);
  saveCompanionSettings();
  companionWindow?.hide();
};

// Layout editing deliberately lives in the regular main renderer. While it is
// active the transparent companion is hidden and completely removed from the
// mouse pipeline; this prevents click-through state from interrupting DOM drag.
const setCompanionLayoutEditing = (active: boolean) => {
  companionLayoutEditorActive = active;
  companionPointerDown = null;
  stopCompanionDragTracking();
  if (active) {
    setCompanionGazeTracking(false);
    companionWindow?.hide();
  }
  else if (companionSettings.visible) {
    companionWindow?.showInactive();
    setCompanionGazeTracking(true);
    syncCompanionMouseCapture();
  }
  return { active };
};

const createTray = () => {
  const icon = nativeImage.createFromPath(getIconPath());
  tray = new Tray(icon);
  tray.setToolTip('LecPunch Election');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示 LecPunch Election', click: showWindow },
    { label: '显示桌面小猫', click: showCompanion },
    { label: '隐藏桌面小猫', click: hideCompanion },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]));
  tray.on('click', showWindow);
};

const loadRenderer = (window: BrowserWindow, hash?: string) => {
  if (app.isPackaged) {
    return window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), hash ? { hash } : undefined);
  }
  return window.loadURL(`http://127.0.0.1:5174/${hash ? `#${hash}` : ''}`);
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 760,
    // Keep Windows controls while removing the native menu bar and white title bar.
    titleBarStyle: process.platform === 'win32' ? 'hidden' : 'hiddenInset',
    ...(process.platform === 'win32'
      ? {
          titleBarOverlay: {
            // The app paints the backdrop underneath. Do not introduce a second
            // opaque title-bar strip between the background and native controls.
            color: '#00000000',
            symbolColor: '#22557f',
            height: 36
          }
        }
      : {}),
    backgroundColor: '#edf8ff',
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  observeWindowDiagnostics('main', mainWindow);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  void loadRenderer(mainWindow);
  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow?.hide();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

const createCompanionWindow = () => {
  const dimensions = companionDimensions();
  companionWindow = new BrowserWindow({
    width: dimensions.width,
    height: dimensions.height,
    frame: false,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true,
    hasShadow: false,
    show: false,
    transparent: true,
    backgroundColor: '#00000000',
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  observeWindowDiagnostics('companion', companionWindow);
  if (!app.isPackaged) {
    // The transparent companion is intentionally not a normal focus target,
    // so open a detached inspector in development instead of relying on a
    // keyboard shortcut that may never reach this native window.
    const devtoolsTarget = companionWindow;
    devtoolsTarget.webContents.once('did-finish-load', () => {
      if (!devtoolsTarget.isDestroyed()) devtoolsTarget.webContents.openDevTools({ mode: 'detach' });
    });
  }
  companionWindow.setAlwaysOnTop(true, 'floating');
  companionWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  companionWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
  void loadRenderer(companionWindow, 'companion');
  companionWindow.once('ready-to-show', () => {
    if (companionSettings.visible) {
      companionWindow?.showInactive();
      setCompanionGazeTracking(true);
      syncCompanionMouseCapture();
    }
  });
  companionWindow.on('hide', () => setCompanionGazeTracking(false));
  companionWindow.on('show', () => setCompanionGazeTracking(true));
  companionWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    companionWindow?.hide();
  });
  companionWindow.on('closed', () => {
    companionWindow = null;
  });
};

type CompanionSkinImportItem = { directory: string; status: 'imported' | 'failed'; skin?: CompanionSkinDescriptor; reason?: string };
type CompanionSkinImportResult = { canceled: boolean; skins: CompanionSkinDescriptor[]; items: CompanionSkinImportItem[]; error?: string };
const importOneCompanionSkin = (sourceRoot: string): CompanionSkinImportItem => {
  const directory = path.basename(sourceRoot);
  if (!hasSkinFile(sourceRoot, 'cat.model3.json')) return { directory, status: 'failed', reason: '缺少 cat.model3.json。' };
  if (!hasSkinFile(sourceRoot, 'resources/background.png')) return { directory, status: 'failed', reason: '缺少 resources/background.png。' };
  const modelReferenceError = validateRequiredModelReferences(sourceRoot);
  if (modelReferenceError) return { directory, status: 'failed', reason: modelReferenceError };

  const id = stableImportedSkinId(sourceRoot);
  const destinationRoot = importedSkinRoot();
  const destination = path.join(destinationRoot, id);
  const staging = path.join(destinationRoot, `.${id}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const backup = `${destination}.previous-${Date.now()}`;
  let backupCreated = false;
  try {
    fs.mkdirSync(destinationRoot, { recursive: true });
    // Copy everything: upstream packages can include optional expressions,
    // motions, sounds and alternate models. They never block import, but stay
    // available to the Live2D runtime whenever their model references them.
    fs.cpSync(sourceRoot, staging, { recursive: true, errorOnExist: true });
    const layout = generateImportedSkinLayout(sourceRoot);
    if (!normalizeSkinLayout(layout)) throw new Error('自动生成的布局无效。');
    fs.writeFileSync(path.join(staging, 'layout.json'), `${JSON.stringify(layout, null, 2)}\n`, 'utf8');
    if (fs.existsSync(destination)) {
      fs.renameSync(destination, backup);
      backupCreated = true;
    }
    fs.renameSync(staging, destination);
    const skin = readSkinDescriptor(id, id, 'user');
    if (!skin) throw new Error('复制后的皮肤布局校验失败。');
    // A re-import replaces the source geometry too, so it must not inherit an
    // old layout override. Built-in skin overrides are never touched.
    fs.rmSync(path.join(skinOverrideRoot(), `${id}.json`), { force: true });
    if (backupCreated) fs.rmSync(backup, { recursive: true, force: true });
    return { directory, status: 'imported', skin };
  } catch (error) {
    try {
      fs.rmSync(staging, { recursive: true, force: true });
      if (backupCreated && fs.existsSync(backup)) {
        fs.rmSync(destination, { recursive: true, force: true });
        fs.renameSync(backup, destination);
      }
    } catch {
      // Preserve the original import error; cleanup is best-effort only.
    }
    return { directory, status: 'failed', reason: error instanceof Error ? error.message : '无法复制到本地皮肤目录。' };
  }
};
const importCandidatesFrom = (selectedRoot: string) => {
  const looksLikeSkin = (candidate: string) => fs.existsSync(path.join(candidate, 'cat.model3.json')) || fs.existsSync(path.join(candidate, 'resources'));
  if (looksLikeSkin(selectedRoot)) return [selectedRoot];
  try {
    return fs.readdirSync(selectedRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(selectedRoot, entry.name))
      .filter(looksLikeSkin);
  } catch {
    return [];
  }
};
const importCompanionSkin = async (): Promise<CompanionSkinImportResult> => {
  const result = await dialog.showOpenDialog(mainWindow ?? companionWindow!, {
    title: '选择一个皮肤文件夹或皮肤库根目录',
    properties: ['openDirectory']
  });
  if (result.canceled || !result.filePaths[0]) return { canceled: true, skins: [], items: [] };
  const candidates = importCandidatesFrom(result.filePaths[0]);
  if (!candidates.length) return { canceled: false, skins: [], items: [], error: '未找到皮肤文件夹：每套皮肤至少应包含 cat.model3.json 或 resources 目录。' };
  const items = candidates.map(importOneCompanionSkin);
  const skins = items.flatMap((item) => item.status === 'imported' && item.skin ? [item.skin] : []);
  const failures = items.filter((item) => item.status === 'failed');
  return {
    canceled: false,
    skins,
    items,
    error: failures.length ? `${skins.length} 个导入成功，${failures.length} 个未导入。` : undefined
  };
};

app.whenReady().then(() => {
  protocol.handle('lecpunch-assets', (request) => {
    const requestUrl = new URL(request.url);
    const relativePath = path.normalize(decodeURIComponent(requestUrl.pathname)).replace(/^([/\\])+/, '');
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return new Response('Not found', { status: 404 });
    }
    const root = requestUrl.hostname === 'bongocat' ? builtInSkinRoot()
      : requestUrl.hostname === 'user-skins' ? importedSkinRoot()
        : requestUrl.hostname === 'appearance' ? appearanceBackgroundRoot() : null;
    if (!root) return new Response('Not found', { status: 404 });
    const assetPath = path.join(root, relativePath);
    if (!assetPath.startsWith(`${root}${path.sep}`) && assetPath !== root) return new Response('Not found', { status: 404 });
    // easy-live2d loads model textures through Image with a CORS request.
    // This is an internal, allow-listed protocol, so explicitly mark its file
    // response readable by the renderer instead of leaving Image waiting for a
    // load event that never arrives.
    return net.fetch(pathToFileURL(assetPath).toString()).then((response) => {
      const headers = new Headers(response.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    });
  });

  Menu.setApplicationMenu(null);
  loadCompanionSettings();
  loadMeetingSettings();
  loadAppearanceSettings();
  loadQuietNotificationSettings();
  // Jitsi is the only remote page embedded by the desktop client. Keep both
  // permission paths fail-closed and tied to the exact locally configured
  // HTTPS origin; no other website can request camera or microphone access.
  session.defaultSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) =>
    permission === 'media' && isConfiguredMeetingUrl(requestingOrigin)
  );
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    callback(permission === 'media' && isConfiguredMeetingUrl(details.requestingUrl));
  });
  // Screen sharing inside the Jitsi iframe: the OS-native picker (screens +
  // windows, the same experience as browser sharing) is preferred. When the
  // platform picker is unavailable, fall back to sharing the primary screen.
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      callback(sources.length ? { video: sources[0] } : {});
    }).catch(() => callback({}));
  }, { useSystemPicker: true });
  createWindow();
  createCompanionWindow();
  createTray();

  uIOhook.on('keydown', (event) => {
    const key = keyboardKeyMap.get(event.keycode);
    if (key) companionWindow?.webContents.send('bongo:key', { kind: 'keydown', key });
  });
  uIOhook.on('keyup', (event) => {
    const key = keyboardKeyMap.get(event.keycode);
    if (key) companionWindow?.webContents.send('bongo:key', { kind: 'keyup', key });
  });
  // The companion has no Electron app-region drag surface. A single global
  // pointer pipeline owns native movement and click-vs-drag classification.
  uIOhook.on('mousedown', (event) => {
    if (companionLayoutEditorActive) return;
    const modelHit = isCursorOnCompanionModel();
    const bubbleHit = isCursorOnCompanionBubble();
    if (Number(event.button) !== 1 || companionOverlayState.settingsOpen || bubbleHit || !modelHit) {
      return;
    }
    beginCompanionDragTracking();
  });
  uIOhook.on('mousemove', () => {
    if (companionLayoutEditorActive) return;
    sendCompanionGaze();
    if (!companionPointerDown) {
      syncCompanionMouseCapture();
      return;
    }
    updateCompanionDragPosition();
  });
  uIOhook.on('mouseup', (event) => {
    if (companionLayoutEditorActive) return;
    if (Number(event.button) !== 1 || !companionPointerDown) return;
    updateCompanionDragPosition();
    stopCompanionDragTracking();
    const pointer = companionPointerDown;
    companionPointerDown = null;
    const end = screen.getCursorScreenPoint();
    if (!pointer.dragging && !companionOverlayState.settingsOpen && !isCursorOnCompanionBubble() && Math.hypot(end.x - pointer.x, end.y - pointer.y) <= 6 && isCursorOnCompanionModel()) {
      companionWindow?.webContents.send('bongo:toggle-menu');
    }
    syncCompanionMouseCapture();
  });
  uIOhook.start();

  ipcMain.handle('desktop:notify', (_event, payload: { title?: string; body?: string }) => {
    // The pet bubble is the fallback when Windows notifications are unavailable
    // or disabled by the operating system.
    companionWindow?.webContents.send('bongo:message', { message: payload.body || '' });
    if (!Notification.isSupported()) return { supported: false };
    new Notification({
      title: payload.title || 'LecPunch Election',
      body: payload.body || '',
      // Let Windows use the user's configured notification sound. Quiet mode
      // only suppresses QQ/WeChat; LecPunch reminders must remain audible.
      silent: false
    }).show();
    return { supported: true };
  });

  ipcMain.handle('desktop:hide-to-tray', () => mainWindow?.hide());
  ipcMain.handle('desktop:set-immersive', async (_event, enabled: boolean) => {
    const quietResult = await setQuietAppNotifications(Boolean(enabled));
    mainWindow?.webContents.send('desktop:main-immersive', Boolean(enabled) && quietResult.enabled);
    return quietResult;
  });
  ipcMain.handle('desktop:set-window-theme', (_event, value: unknown) => {
    if (value !== 'light' && value !== 'dark') throw new Error('窗口主题无效。');
    setMainWindowTheme(value);
  });
  ipcMain.handle('desktop:get-companion-settings', () => companionSettings);
  ipcMain.handle('desktop:update-companion-settings', (_event, changes: Partial<CompanionSettings>) => {
    const window = companionWindow;
    companionSettings = normalizeCompanionSettings(changes);
    saveCompanionSettings();
    companionWindow?.webContents.send('bongo:settings-changed', companionSettings);
    if (!window) return companionSettings;
    const [x, y] = window.getPosition();
    const [oldWidth, oldHeight] = window.getSize();
    const { width, height } = companionDimensions();
    const shouldResizeWindow = changes.visible !== undefined || oldWidth !== width || oldHeight !== height;
    // Slider changes deliberately do not resize the native window after the
    // one-time host migration from older, smaller companion windows.
    if (!shouldResizeWindow) return companionSettings;
    const display = screen.getDisplayNearestPoint({ x, y });
    const area = display.workArea;
    const nextX = Math.max(area.x, Math.min(x + Math.round((oldWidth - width) / 2), area.x + area.width - width));
    const nextY = Math.max(area.y, Math.min(y + Math.round((oldHeight - height) / 2), area.y + area.height - height));
    window.setBounds({ x: nextX, y: nextY, width, height });
    if (companionSettings.visible) window.showInactive();
    else window.hide();
    return companionSettings;
  });
  ipcMain.handle('desktop:list-companion-skins', () => listCompanionSkins().filter((skin) => skin.scene === 'standard'));
  ipcMain.handle('desktop:get-companion-skin-layout', (_event, skinId: unknown) => loadSkinLayout(typeof skinId === 'string' ? skinId : companionSettings.skinId));
  ipcMain.handle('desktop:save-companion-skin-override', (_event, skinId: unknown, changes: CompanionLayoutOverride) => {
    if (typeof skinId !== 'string' || !companionSkinExists(skinId)) throw new Error('皮肤不存在，无法保存布局。');
    const base = loadSkinLayout(skinId);
    const menu = normalizeMenu(changes?.menu, base.menu);
    fs.mkdirSync(skinOverrideRoot(), { recursive: true });
    fs.writeFileSync(path.join(skinOverrideRoot(), `${skinId}.json`), JSON.stringify({ menu }, null, 2), 'utf8');
    const layout = loadSkinLayout(skinId);
    companionWindow?.webContents.send('bongo:layout-changed', skinId);
    return layout;
  });
  ipcMain.handle('desktop:reset-companion-skin-override', (_event, skinId: unknown) => {
    if (typeof skinId !== 'string' || !companionSkinExists(skinId)) throw new Error('皮肤不存在，无法恢复默认布局。');
    fs.rmSync(path.join(skinOverrideRoot(), `${skinId}.json`), { force: true });
    const layout = loadSkinLayout(skinId);
    companionWindow?.webContents.send('bongo:layout-changed', skinId);
    return layout;
  });
  ipcMain.handle('desktop:import-companion-skin', () => importCompanionSkin());
  ipcMain.handle('desktop:get-meeting-settings', () => meetingSettings);
  ipcMain.handle('desktop:update-meeting-settings', (_event, changes: Partial<MeetingSettings>) => {
    meetingSettings = { meetingOrigin: normalizeMeetingOrigin(changes?.meetingOrigin) };
    saveMeetingSettings();
    return meetingSettings;
  });
  ipcMain.handle('desktop:get-appearance-settings', () => getAppearanceSettingsForRenderer());
  ipcMain.handle('desktop:select-appearance-background', () => selectAppearanceBackground());
  ipcMain.handle('desktop:clear-appearance-background', () => clearAppearanceBackground());
  ipcMain.handle('desktop:update-appearance-settings', (_event, changes: Partial<AppearanceSettings>) => {
    appearanceSettings = { ...appearanceSettings, ...normalizeAppearanceSettings({ ...appearanceSettings, ...changes }) };
    saveAppearanceSettings();
    return getAppearanceSettingsForRenderer();
  });
  ipcMain.handle('desktop:open-focus-assist', () => shell.openExternal('ms-settings:quiethours'));
  ipcMain.handle('desktop:open-external', async (_event, value: unknown) => {
    if (typeof value !== 'string') throw new Error('外部地址无效。');
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error('外部地址无效。');
    }
    if (url.protocol !== 'https:') throw new Error('仅允许打开 HTTPS 外部地址。');
    await shell.openExternal(url.toString());
  });
  ipcMain.handle('desktop:save-markdown', async (_event, payload: { filename?: unknown; content?: unknown }) => {
    if (typeof payload?.content !== 'string') throw new Error('Markdown 内容无效。');
    const requested = typeof payload.filename === 'string' ? payload.filename : 'weekly-report.md';
    const filename = requested.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 100) || 'weekly-report.md';
    const options = {
      title: '保存本周周报 Markdown',
      defaultPath: filename.endsWith('.md') ? filename : `${filename}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    };
    const result = mainWindow ? await dialog.showSaveDialog(mainWindow, options) : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return { saved: false };
    await fs.promises.writeFile(result.filePath, payload.content, 'utf8');
    return { saved: true, filePath: result.filePath };
  });
  ipcMain.handle('desktop:show-companion', () => {
    showCompanion();
    return companionSettings;
  });
  ipcMain.handle('desktop:set-companion-layout-editing', (_event, active: unknown) => setCompanionLayoutEditing(Boolean(active)));
  ipcMain.handle('desktop:begin-companion-header-drag', () => {
    // Only the open settings header may request this. Form controls never
    // enter the native pointer pipeline and remain ordinary DOM controls.
    if (!companionOverlayState.settingsOpen) return { started: false };
    return { started: beginCompanionDragTracking() };
  });
  ipcMain.on('desktop:set-companion-overlay-state', (_event, state: Partial<typeof companionOverlayState>) => {
    companionOverlayState = { ...companionOverlayState, ...state };
    syncCompanionMouseCapture();
  });
  ipcMain.handle('desktop:show-main', (_event, action: 'schedule' | 'shop' | 'profile') => {
    showWindow();
    mainWindow?.webContents.send('desktop:main-action', action);
  });
  ipcMain.handle('desktop:notify-main-state', () => mainWindow?.webContents.send('desktop:main-action', 'refresh'));

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      createCompanionWindow();
    } else {
      showWindow();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  setQuietNativePopupGuard(false);
  uIOhook.stop();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
