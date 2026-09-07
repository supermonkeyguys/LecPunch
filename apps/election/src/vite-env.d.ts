/// <reference types="vite/client" />

interface Window {
  lecpunchDesktop?: {
    platform: string;
    isDesktop: boolean;
    isPackaged: boolean;
    notify: (payload: { title: string; body: string }) => Promise<void>;
    hideToTray: () => Promise<void>;
    setImmersive: (enabled: boolean) => Promise<{ enabled: boolean; managedApps: string[]; message: string }>;
    setWindowTheme: (theme: 'light' | 'dark') => Promise<void>;
    onMainImmersive: (callback: (enabled: boolean) => void) => () => void;
    onBongoKey: (callback: (event: { kind: 'keydown' | 'keyup'; key: string }) => void) => () => void;
    onBongoMenuToggle: (callback: () => void) => () => void;
    onBongoSettingsChanged: (callback: (settings: { scale: number; visible: boolean; replyTemplate: string; skinId: string }) => void) => () => void;
    onBongoLayoutChanged: (callback: (skinId: string) => void) => () => void;
    onBongoGaze: (callback: (payload: { active: boolean; x: number; y: number }) => void) => () => void;
    onBongoMessage: (callback: (payload: { message: string }) => void) => () => void;
    setCompanionOverlayState: (state: { menuOpen?: boolean; settingsOpen?: boolean }) => void;
    getCompanionSettings: () => Promise<{ scale: number; visible: boolean; replyTemplate: string; skinId: string }>;
    updateCompanionSettings: (settings: { scale?: number; visible?: boolean; replyTemplate?: string; skinId?: string }) => Promise<{ scale: number; visible: boolean; replyTemplate: string; skinId: string }>;
    listCompanionSkins: () => Promise<Array<{ id: string; scene: 'standard' | 'keyboard'; label: string; directory: string; source: 'builtin' | 'user'; backgroundFile: string; coverFile: string; pricePoints: number; isFree: boolean }>>;
    getCompanionSkinLayout: (skinId: string) => Promise<unknown>;
    saveCompanionSkinOverride: (skinId: string, changes: { menu?: unknown }) => Promise<unknown>;
    resetCompanionSkinOverride: (skinId: string) => Promise<unknown>;
    importCompanionSkin: () => Promise<{
      canceled: boolean;
      skins: Array<{ id: string; scene: 'standard' | 'keyboard'; label: string; directory: string; source: 'builtin' | 'user'; backgroundFile: string; coverFile: string; pricePoints: number; isFree: boolean }>;
      items: Array<{ directory: string; status: 'imported' | 'failed'; skin?: { id: string; scene: 'standard' | 'keyboard'; label: string; directory: string; source: 'builtin' | 'user'; backgroundFile: string; coverFile: string; pricePoints: number; isFree: boolean }; reason?: string }>;
      error?: string;
    }>;
    getMeetingSettings: () => Promise<{ meetingOrigin: string }>;
    updateMeetingSettings: (settings: { meetingOrigin: string }) => Promise<{ meetingOrigin: string }>;
    getAppearanceSettings: () => Promise<{ backgroundOpacity: number; backgroundBlur: number; backgroundUrl: string }>;
    selectAppearanceBackground: () => Promise<{ backgroundOpacity: number; backgroundBlur: number; backgroundUrl: string }>;
    clearAppearanceBackground: () => Promise<{ backgroundOpacity: number; backgroundBlur: number; backgroundUrl: string }>;
    updateAppearanceSettings: (settings: { backgroundOpacity?: number; backgroundBlur?: number }) => Promise<{ backgroundOpacity: number; backgroundBlur: number; backgroundUrl: string }>;
    showCompanion: () => Promise<{ scale: number; visible: boolean; replyTemplate: string; skinId: 'standard-default' | 'keyboard' | 'sanren-keyboard' }>;
    setCompanionLayoutEditing: (active: boolean) => Promise<{ active: boolean }>;
    beginCompanionHeaderDrag: () => Promise<{ started: boolean }>;
    openExternal: (url: string) => Promise<void>;
    saveMarkdown: (payload: { filename: string; content: string }) => Promise<{ saved: boolean; filePath?: string }>;
    openFocusAssist: () => Promise<void>;
    showMain: (action: 'schedule' | 'shop' | 'profile') => Promise<void>;
    notifyMainStateChanged: () => Promise<void>;
    onMainAction: (callback: (action: 'schedule' | 'shop' | 'profile' | 'refresh') => void) => () => void;
  };
}
