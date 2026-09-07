import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('lecpunchDesktop', {
  platform: process.platform,
  isDesktop: true,
  isPackaged: !process.defaultApp,
  notify: (payload: { title: string; body: string }) => ipcRenderer.invoke('desktop:notify', payload),
  hideToTray: () => ipcRenderer.invoke('desktop:hide-to-tray'),
  setImmersive: (enabled: boolean) => ipcRenderer.invoke('desktop:set-immersive', enabled) as Promise<{ enabled: boolean; managedApps: string[]; message: string }>,
  setWindowTheme: (theme: 'light' | 'dark') => ipcRenderer.invoke('desktop:set-window-theme', theme) as Promise<void>,
  onMainImmersive: (callback: (enabled: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, enabled: boolean) => callback(enabled);
    ipcRenderer.on('desktop:main-immersive', listener);
    return () => ipcRenderer.removeListener('desktop:main-immersive', listener);
  },
  onBongoKey: (callback: (event: { kind: 'keydown' | 'keyup'; key: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { kind: 'keydown' | 'keyup'; key: string }) => callback(payload);
    ipcRenderer.on('bongo:key', listener);
    return () => ipcRenderer.removeListener('bongo:key', listener);
  },
  onBongoMenuToggle: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('bongo:toggle-menu', listener);
    return () => ipcRenderer.removeListener('bongo:toggle-menu', listener);
  },
  onBongoSettingsChanged: (callback: (settings: { scale: number; visible: boolean; replyTemplate: string; skinId: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, settings: { scale: number; visible: boolean; replyTemplate: string; skinId: string }) => callback(settings);
    ipcRenderer.on('bongo:settings-changed', listener);
    return () => ipcRenderer.removeListener('bongo:settings-changed', listener);
  },
  onBongoLayoutChanged: (callback: (skinId: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, skinId: string) => callback(skinId);
    ipcRenderer.on('bongo:layout-changed', listener);
    return () => ipcRenderer.removeListener('bongo:layout-changed', listener);
  },
  onBongoGaze: (callback: (payload: { active: boolean; x: number; y: number }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { active: boolean; x: number; y: number }) => callback(payload);
    ipcRenderer.on('bongo:gaze', listener);
    return () => ipcRenderer.removeListener('bongo:gaze', listener);
  },
  onBongoMessage: (callback: (payload: { message: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { message: string }) => callback(payload);
    ipcRenderer.on('bongo:message', listener);
    return () => ipcRenderer.removeListener('bongo:message', listener);
  },
  setCompanionOverlayState: (state: { menuOpen?: boolean; settingsOpen?: boolean }) => ipcRenderer.send('desktop:set-companion-overlay-state', state),
  getCompanionSettings: () => ipcRenderer.invoke('desktop:get-companion-settings'),
  updateCompanionSettings: (settings: { scale?: number; visible?: boolean; replyTemplate?: string; skinId?: string }) => ipcRenderer.invoke('desktop:update-companion-settings', settings),
  listCompanionSkins: () => ipcRenderer.invoke('desktop:list-companion-skins') as Promise<Array<{ id: string; scene: 'standard' | 'keyboard'; label: string; directory: string; source: 'builtin' | 'user'; backgroundFile: string; coverFile: string; pricePoints: number; isFree: boolean }>>,
  getCompanionSkinLayout: (skinId: string) => ipcRenderer.invoke('desktop:get-companion-skin-layout', skinId),
  saveCompanionSkinOverride: (skinId: string, changes: { menu?: unknown }) => ipcRenderer.invoke('desktop:save-companion-skin-override', skinId, changes),
  resetCompanionSkinOverride: (skinId: string) => ipcRenderer.invoke('desktop:reset-companion-skin-override', skinId),
  importCompanionSkin: () => ipcRenderer.invoke('desktop:import-companion-skin') as Promise<{
    canceled: boolean;
    skins: Array<{ id: string; scene: 'standard' | 'keyboard'; label: string; directory: string; source: 'builtin' | 'user'; backgroundFile: string; coverFile: string; pricePoints: number; isFree: boolean }>;
    items: Array<{ directory: string; status: 'imported' | 'failed'; skin?: { id: string; scene: 'standard' | 'keyboard'; label: string; directory: string; source: 'builtin' | 'user'; backgroundFile: string; coverFile: string; pricePoints: number; isFree: boolean }; reason?: string }>;
    error?: string;
  }>,
  getMeetingSettings: () => ipcRenderer.invoke('desktop:get-meeting-settings') as Promise<{ meetingOrigin: string }>,
  updateMeetingSettings: (settings: { meetingOrigin: string }) => ipcRenderer.invoke('desktop:update-meeting-settings', settings) as Promise<{ meetingOrigin: string }>,
  getAppearanceSettings: () => ipcRenderer.invoke('desktop:get-appearance-settings') as Promise<{ backgroundOpacity: number; backgroundBlur: number; backgroundUrl: string }>,
  selectAppearanceBackground: () => ipcRenderer.invoke('desktop:select-appearance-background') as Promise<{ backgroundOpacity: number; backgroundBlur: number; backgroundUrl: string }>,
  clearAppearanceBackground: () => ipcRenderer.invoke('desktop:clear-appearance-background') as Promise<{ backgroundOpacity: number; backgroundBlur: number; backgroundUrl: string }>,
  updateAppearanceSettings: (settings: { backgroundOpacity?: number; backgroundBlur?: number }) => ipcRenderer.invoke('desktop:update-appearance-settings', settings) as Promise<{ backgroundOpacity: number; backgroundBlur: number; backgroundUrl: string }>,
  showCompanion: () => ipcRenderer.invoke('desktop:show-companion'),
  setCompanionLayoutEditing: (active: boolean) => ipcRenderer.invoke('desktop:set-companion-layout-editing', active) as Promise<{ active: boolean }>,
  beginCompanionHeaderDrag: () => ipcRenderer.invoke('desktop:begin-companion-header-drag') as Promise<{ started: boolean }>,
  openExternal: (url: string) => ipcRenderer.invoke('desktop:open-external', url) as Promise<void>,
  saveMarkdown: (payload: { filename: string; content: string }) => ipcRenderer.invoke('desktop:save-markdown', payload) as Promise<{ saved: boolean; filePath?: string }>,
  openFocusAssist: () => ipcRenderer.invoke('desktop:open-focus-assist'),
  showMain: (action: 'schedule' | 'shop' | 'profile') => ipcRenderer.invoke('desktop:show-main', action),
  notifyMainStateChanged: () => ipcRenderer.invoke('desktop:notify-main-state'),
  onMainAction: (callback: (action: 'schedule' | 'shop' | 'profile' | 'refresh') => void) => {
    const listener = (_event: Electron.IpcRendererEvent, action: 'schedule' | 'shop' | 'profile' | 'refresh') => callback(action);
    ipcRenderer.on('desktop:main-action', listener);
    return () => ipcRenderer.removeListener('desktop:main-action', listener);
  }
});
