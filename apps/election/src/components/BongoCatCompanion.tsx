import { Application, Ticker } from 'pixi.js';
import { Config, CubismSetting, Live2DSprite } from 'easy-live2d';
import { BellRing, Coffee, ExternalLink, MonitorOff, Moon, Settings2, ShoppingBag } from 'lucide-react';
import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from 'react';

type Hand = 'left' | 'right';
type Position = { x: number; y: number };
type PanelPlacement = { left: number; top: number; maxWidth: number; maxHeight: number };
export type BongoSceneId = 'standard' | 'keyboard';
export type BongoSkinId = string;

type BongoSkin = {
  id: BongoSkinId;
  scene: BongoSceneId;
  label: string;
  directory: string;
  backgroundFile: string;
  source: 'builtin' | 'user';
};
type BongoSkinLayout = {
  scene: BongoSceneId;
  label: string;
  backgroundFile: string;
  canvas: { width: number; height: number };
  stage: { left: number; bottom: number; width: number; height: number };
  model: { left: number; bottom: number; width: number; height: number; renderScale?: number; renderOffsetX?: number; renderOffsetY?: number };
  menu: { anchorX: number; anchorY: number; scaleOffsetX: number; scaleOffsetY: number; actionOffsets: Array<{ x: number; y: number }>; spacing: number; bubbleSize: number };
  orbit: { right: number; bottom: number };
  message: { left: number; top: number };
  keys: { aliases?: Record<string, string>; leftOverlays: string[]; rightOverlays: string[] };
};

const CAT_WIDTH = 360;
const CAT_HEIGHT = 208;
const POSITION_STORAGE_KEY = 'lecpunch.election.bongocat-position';
const DEFAULT_SKIN_ID: BongoSkinId = 'standard-default';
const BUILTIN_STANDARD_SKINS: BongoSkin[] = [{
    id: 'standard-default',
    scene: 'standard',
    label: '默认标准小猫',
    directory: 'standard/default',
    backgroundFile: 'resources/background.png',
    source: 'builtin'
  }];

const getSkin = (skins: BongoSkin[], skinId: string | undefined): BongoSkin => skins.find((skin) => skin.id === skinId) ?? skins.find((skin) => skin.id === DEFAULT_SKIN_ID) ?? BUILTIN_STANDARD_SKINS[0];
const getAssetBase = (skin: BongoSkin) => {
  if (!window.lecpunchDesktop?.isDesktop) return `${import.meta.env.BASE_URL}bongocat/${skin.directory}/`;
  return skin.source === 'user' ? `lecpunch-assets://user-skins/${skin.directory}/` : `lecpunch-assets://bongocat/${skin.directory}/`;
};
const isSkinLayout = (value: unknown): value is BongoSkinLayout => {
  const layout = value as Partial<BongoSkinLayout>;
  return Boolean((layout?.scene === 'standard' || layout?.scene === 'keyboard') && typeof layout.label === 'string' && typeof layout.backgroundFile === 'string'
    && layout.canvas && layout.stage && layout.model && layout.menu && layout.orbit && layout.message && layout.keys
    && Number.isFinite(layout.canvas.width) && Number.isFinite(layout.canvas.height)
    && Number.isFinite(layout.stage.left) && Number.isFinite(layout.stage.bottom) && Number.isFinite(layout.stage.width) && Number.isFinite(layout.stage.height)
    && Number.isFinite(layout.model.left) && Number.isFinite(layout.model.bottom) && Number.isFinite(layout.model.width) && Number.isFinite(layout.model.height)
    && Array.isArray(layout.menu.actionOffsets) && layout.menu.actionOffsets.length === 5 && Number.isFinite(layout.menu.spacing) && Number.isFinite(layout.menu.bubbleSize)
    && Array.isArray(layout.keys.leftOverlays) && Array.isArray(layout.keys.rightOverlays));
};
const getOverlayKey = (layout: BongoSkinLayout | null, hand: Hand, key: string | null) => {
  if (!key) return null;
  const overlayKey = layout?.keys.aliases?.[key] ?? key;
  return layout && (hand === 'left' ? layout.keys.leftOverlays : layout.keys.rightOverlays).includes(overlayKey) ? overlayKey : null;
};

const mapKey = (event: KeyboardEvent) => {
  const aliases: Record<string, string> = {
    Enter: 'Return',
    Space: 'Space',
    Backquote: 'BackQuote',
    Backslash: 'Backslash',
    Slash: 'Slash',
    ShiftLeft: 'ShiftLeft',
    ShiftRight: 'ShiftRight',
    ControlLeft: 'ControlLeft',
    ControlRight: 'ControlRight',
    AltLeft: 'Alt',
    AltRight: 'AltGr',
    MetaLeft: 'Meta',
    MetaRight: 'Meta',
    CapsLock: 'CapsLock',
    Tab: 'Tab',
    Escape: 'Escape',
    Delete: 'Delete',
    Backspace: 'Backspace',
    ArrowUp: 'UpArrow',
    ArrowDown: 'DownArrow',
    ArrowLeft: 'LeftArrow',
    ArrowRight: 'RightArrow'
  };

  if (aliases[event.code]) return aliases[event.code];
  if (/^Key[A-Z]$/.test(event.code)) return event.code;
  if (/^Digit\d$/.test(event.code)) return `Num${event.code.slice(-1)}`;
  if (/^Numpad\d$/.test(event.code)) return `Num${event.code.slice(-1)}`;
  return null;
};

const getHand = (key: string): Hand => key.endsWith('Arrow') ? 'right' : 'left';
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(value, maximum));
// The standard model is mirrored relative to screen coordinates: these are
// the sole visual-calibration points if a future model looks the wrong way.
const GAZE_DIRECTION_X = -1;
const GAZE_DIRECTION_Y = -1;
const GAZE_SMOOTHING_MS = 90;
const LIVE2D_READY_TIMEOUT_MS = 12_000;
const writeNormalizedParameter = (model: Live2DSprite, id: string, value: number) => {
  const range = model.getParameterValueRangeById(id);
  if (!range) return;
  const centre = (range.min + range.max) / 2;
  const halfRange = (range.max - range.min) / 2;
  model.setParameterValueById(id, clamp(centre + clamp(value, -1, 1) * halfRange, range.min, range.max));
};
const destroyLive2DModel = (model: Live2DSprite | null) => {
  if (!model || model.destroyed) return;
  // easy-live2d currently treats every sprite destruction as application
  // shutdown and calls CubismFramework.dispose(). That framework is a
  // renderer-process singleton, so a layout remount must release this sprite
  // without disposing the singleton needed by the next sprite.
  if (model.parent) model.parent.removeChild(model);
  const instance = model as unknown as { _cubismInitialized?: boolean };
  instance._cubismInitialized = false;
  model.destroy({ children: true, texture: true, textureSource: true });
};
const waitForLive2DReady = async (model: Live2DSprite) => {
  let timeout: number | null = null;
  try {
    await Promise.race([
      model.ready,
      new Promise<never>((_resolve, reject) => {
        timeout = window.setTimeout(() => reject(new Error(`Live2D 模型初始化超时（${LIVE2D_READY_TIMEOUT_MS / 1000} 秒）。`)), LIVE2D_READY_TIMEOUT_MS);
      })
    ]);
  } finally {
    if (timeout !== null) window.clearTimeout(timeout);
  }
};

const clampPosition = (position: Position): Position => ({
  x: Math.max(0, Math.min(position.x, window.innerWidth - CAT_WIDTH)),
  y: Math.max(38, Math.min(position.y, window.innerHeight - CAT_HEIGHT))
});

const readInitialPosition = (): Position => {
  try {
    const saved = JSON.parse(localStorage.getItem(POSITION_STORAGE_KEY) || 'null') as Position | null;
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) return clampPosition(saved);
  } catch {
    // A malformed saved location should never block the cat from rendering.
  }
  return clampPosition({ x: window.innerWidth - CAT_WIDTH - 24, y: window.innerHeight - CAT_HEIGHT - 28 });
};

export const BongoCatCompanion = ({
  attendanceActive,
  immersive,
  onAttendance,
  onToggleImmersive,
  onOpenSchedule,
  onOpenShop,
  catScale = 1,
  settingsOpen = false,
  onToggleSettings,
  onSetCatScale,
  onSetVisible,
  onOpenFocusAssist,
  onOpenLayoutEditor,
  replyTemplate = '{username} {message}',
  onSetReplyTemplate,
  catMessage,
  catSkinId = DEFAULT_SKIN_ID,
  desktop = false
}: {
  attendanceActive: boolean;
  immersive: boolean;
  onAttendance: () => void;
  onToggleImmersive: () => void;
  onOpenSchedule: () => void;
  onOpenShop: () => void;
  catScale?: number;
  settingsOpen?: boolean;
  onToggleSettings?: () => void;
  onSetCatScale?: (scale: number) => void;
  onSetVisible?: (visible: boolean) => void;
  onOpenFocusAssist?: () => void;
  onOpenLayoutEditor?: () => void;
  replyTemplate?: string;
  onSetReplyTemplate?: (template: string) => void;
  catMessage?: { id: number; message: string } | null;
  catSkinId?: string;
  desktop?: boolean;
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const settingsPanelRef = useRef<HTMLElement | null>(null);
  const visualRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modelRef = useRef<Live2DSprite | null>(null);
  const gazeFrameRef = useRef<number | null>(null);
  const gazeTargetRef = useRef<Position>({ x: 0, y: 0 });
  const gazeCurrentRef = useRef<Position>({ x: 0, y: 0 });
  const pointerRef = useRef<{ id: number; startX: number; startY: number; lastX: number; lastY: number; origin: Position; moved: boolean } | null>(null);
  const [position, setPosition] = useState<Position>(readInitialPosition);
  const [menuOpen, setMenuOpen] = useState(false);
  const [leftKey, setLeftKey] = useState<string | null>(null);
  const [rightKey, setRightKey] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [skinLayout, setSkinLayout] = useState<BongoSkinLayout | null>(null);
  const [layoutSkinId, setLayoutSkinId] = useState<string | null>(null);
  const [layoutFailed, setLayoutFailed] = useState(false);
  const [skins, setSkins] = useState<BongoSkin[]>(BUILTIN_STANDARD_SKINS);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const [settingsPanelPlacement, setSettingsPanelPlacement] = useState<PanelPlacement | null>(null);
  const skin = getSkin(skins, catSkinId);
  const assetBase = getAssetBase(skin);
  // The layout editor changes only menu geometry. Keep the Live2D canvas
  // alive across those writes; a stage remount is reserved for an actual skin
  // change, where model assets and geometry can differ.
  const liveStageKey = skin.id;

  useEffect(() => {
    if (!desktop) return;
    void window.lecpunchDesktop?.listCompanionSkins().then((items) => {
      const standardSkins = items.filter((item) => item.scene === 'standard');
      if (standardSkins.length) setSkins(standardSkins);
    }).catch(() => undefined);
  }, [catSkinId, desktop]);

  useEffect(() => {
    let cancelled = false;
    // Preserve the current model and menu while a same-skin override reloads.
    // Clearing it for every save used to trigger an unnecessary Live2D stage
    // teardown and left the renderer waiting indefinitely for model.ready.
    if (layoutSkinId !== skin.id) {
      setSkinLayout(null);
      setLayoutSkinId(null);
    }
    setLayoutFailed(false);
    const loadLayout = desktop
      ? window.lecpunchDesktop?.getCompanionSkinLayout(skin.id)
      : fetch(`${assetBase}layout.json`).then(async (response) => {
          if (!response.ok) throw new Error('皮肤布局不可访问');
          return response.json() as Promise<unknown>;
        });
    void Promise.resolve(loadLayout)
      .then((value) => {
        if (!isSkinLayout(value)) throw new Error('皮肤布局格式无效');
        if (!cancelled) {
          setSkinLayout(value);
          setLayoutSkinId(skin.id);
        }
      })
      .catch(() => {
        if (!cancelled) setLayoutFailed(true);
      });
    return () => { cancelled = true; };
  }, [assetBase, desktop, layoutRevision, skin.id]);

  useEffect(() => {
    let app: Application | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let cancelled = false;
    let initialized = false;
    let activeModel: Live2DSprite | null = null;

    const resizeModel = () => {
      const model = activeModel;
      const host = visualRef.current;
      if (!model || !host) return;
      const source = model.getModelCanvasSize();
      const sourceWidth = source?.width || model.width;
      const sourceHeight = source?.height || model.height;
      const fitScale = Math.min(host.clientWidth / sourceWidth, host.clientHeight / sourceHeight) * 0.9;
      const renderScale = skinLayout?.model.renderScale ?? 1;
      const offsetX = skinLayout?.model.renderOffsetX ?? 0;
      const offsetY = skinLayout?.model.renderOffsetY ?? 0;
      const scale = fitScale * renderScale;
      model.scale.set(scale);
      model.anchor.set(0.5);
      model.x = host.clientWidth / 2 + offsetX;
      model.y = host.clientHeight / 2 + offsetY;
    };

    const loadModel = async () => {
      try {
        if (!skinLayout || layoutSkinId !== skin.id) return;
        const canvas = canvasRef.current;
        const host = visualRef.current;
        if (!canvas || !host) return;

        setReady(false);
        setLoadFailed(false);
        app = new Application();
        // Pixi 8 expects `canvas`; the legacy `view` key can create a detached
        // renderer and leave Live2D with a lost WebGL context.
        await app.init({ canvas, resizeTo: host, backgroundAlpha: 0, autoDensity: true, resolution: devicePixelRatio, preference: 'webgl' });
        initialized = true;
        // React development mode deliberately mounts effects twice. Stop the
        // first asynchronous renderer before it can create a second WebGL
        // model. This cancellation check never suppresses a later layout
        // revision because that revision owns a distinct effect instance.
        if (cancelled) {
          app.destroy({ removeView: false }, { children: true, texture: true, textureSource: true });
          initialized = false;
          app = null;
          return;
        }
        const response = await fetch(`${assetBase}cat.model3.json`);
        if (!response.ok) throw new Error('Live2D 模型清单不可访问');
        const modelJSON = await response.json();
        if (cancelled) return;
        const modelSetting = new CubismSetting({ modelJSON });
        modelSetting.redirectPath(({ file }) => `${assetBase}${file}`);
        // Live2D uploads each texture into WebGL, which requires a CORS-safe
        // Image even for our internal asset protocol. main.ts gives that
        // allow-listed protocol an explicit ACAO response; keep this request
        // anonymous so WebGL may consume the decoded pixels.
        Config.crossOrigin = 'anonymous';
        activeModel = new Live2DSprite({ modelSetting, ticker: Ticker.shared });
        app.stage.addChild(activeModel);
        await waitForLive2DReady(activeModel);
        if (cancelled) {
          return;
        }
        modelRef.current = activeModel;
        resizeModel();
        resizeObserver = new ResizeObserver(resizeModel);
        resizeObserver.observe(host);
        setReady(true);
      } catch (error) {
        console.error('BongoCat Live2D load failed', error);
        if (!cancelled) setLoadFailed(true);
      }
    };

    void loadModel();
    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      // Never destroy through the shared ref: a newer revision may already
      // have assigned it while this older async effect is being cleaned up.
      if (modelRef.current === activeModel) modelRef.current = null;
      // Remove and release the sprite before Pixi destroys the stage. Letting
      // Application.destroy recurse into Live2DSprite.destroy would dispose
      // the process-wide CubismFramework and leave the next remount blank.
      destroyLive2DModel(activeModel);
      if (initialized) {
        app?.destroy({ removeView: false }, { children: true, texture: true, textureSource: true });
      }
    };
  }, [assetBase, layoutSkinId, skin.id]);

  useEffect(() => {
    let lastFrameAt = 0;
    let trackingActive = false;
    const stop = () => {
      trackingActive = false;
      if (gazeFrameRef.current !== null) window.cancelAnimationFrame(gazeFrameRef.current);
      gazeFrameRef.current = null;
      lastFrameAt = 0;
    };
    const render = (at: number) => {
      if (!trackingActive) {
        gazeFrameRef.current = null;
        return;
      }
      const elapsed = lastFrameAt ? at - lastFrameAt : 16.7;
      lastFrameAt = at;
      const blend = 1 - Math.exp(-elapsed / GAZE_SMOOTHING_MS);
      const current = gazeCurrentRef.current;
      const target = gazeTargetRef.current;
      current.x += (target.x - current.x) * blend;
      current.y += (target.y - current.y) * blend;
      const model = modelRef.current;
      if (model) {
        const x = current.x * GAZE_DIRECTION_X;
        const y = current.y * GAZE_DIRECTION_Y;
        // Parameter availability and ranges are read from the loaded .moc3;
        // a missing control safely degrades instead of inventing a range.
        writeNormalizedParameter(model, 'ParamMouseX', x);
        writeNormalizedParameter(model, 'ParamMouseY', y);
        writeNormalizedParameter(model, 'ParamAngleX', x * 0.72);
        writeNormalizedParameter(model, 'ParamAngleY', y * 0.55);
        writeNormalizedParameter(model, 'ParamEyeBallX', x * 0.9);
        writeNormalizedParameter(model, 'ParamEyeBallY', y * 0.9);
      }
      if (Math.abs(target.x - current.x) < 0.001 && Math.abs(target.y - current.y) < 0.001) {
        current.x = target.x;
        current.y = target.y;
        gazeFrameRef.current = null;
        return;
      }
      gazeFrameRef.current = window.requestAnimationFrame(render);
    };
    const start = () => {
      trackingActive = true;
      if (gazeFrameRef.current !== null) return;
      lastFrameAt = 0;
      gazeFrameRef.current = window.requestAnimationFrame(render);
    };
    const setTarget = (x: number, y: number) => {
      gazeTargetRef.current = { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
      start();
    };
    if (desktop) {
      const unlisten = window.lecpunchDesktop?.onBongoGaze((payload) => {
        if (!payload.active) {
          stop();
          return;
        }
        setTarget(payload.x, payload.y);
      });
      return () => {
        unlisten?.();
        stop();
      };
    }
    const updateLocalGaze = (event: PointerEvent) => {
      setTarget(event.clientX / window.innerWidth * 2 - 1, event.clientY / window.innerHeight * 2 - 1);
    };
    window.addEventListener('pointermove', updateLocalGaze, { passive: true });
    return () => {
      window.removeEventListener('pointermove', updateLocalGaze);
      stop();
    };
  }, [desktop]);

  useEffect(() => {
    const updateKey = (kind: 'keydown' | 'keyup', key: string | null) => {
      if (!key) return;
      const hand = getHand(key);
      const pressed = kind === 'keydown';
      if (hand === 'left') setLeftKey((current) => pressed ? key : current === key ? null : current);
      else setRightKey((current) => pressed ? key : current === key ? null : current);
      modelRef.current?.setParameterValueById(hand === 'left' ? 'CatParamLeftHandDown' : 'CatParamRightHandDown', pressed ? 1 : 0);
    };
    const releaseAll = () => {
      setLeftKey(null);
      setRightKey(null);
      modelRef.current?.setParameterValueById('CatParamLeftHandDown', 0);
      modelRef.current?.setParameterValueById('CatParamRightHandDown', 0);
    };
    const press = (event: KeyboardEvent) => updateKey('keydown', mapKey(event));
    const release = (event: KeyboardEvent) => updateKey('keyup', mapKey(event));
    const unlistenDesktop = desktop ? window.lecpunchDesktop?.onBongoKey((event) => updateKey(event.kind, event.key)) : undefined;
    if (!desktop) {
      window.addEventListener('keydown', press);
      window.addEventListener('keyup', release);
    }
    window.addEventListener('blur', releaseAll);
    return () => {
      unlistenDesktop?.();
      window.removeEventListener('keydown', press);
      window.removeEventListener('keyup', release);
      window.removeEventListener('blur', releaseAll);
    };
  }, [desktop]);

  useEffect(() => {
    if (!desktop) return;
    return window.lecpunchDesktop?.onBongoMenuToggle(() => {
      if (!settingsOpen) setMenuOpen((open) => !open);
    });
  }, [desktop, settingsOpen]);

  useEffect(() => {
    if (!desktop) return;
    window.lecpunchDesktop?.setCompanionOverlayState({ menuOpen, settingsOpen });
    return () => window.lecpunchDesktop?.setCompanionOverlayState({ menuOpen: false, settingsOpen: false });
  }, [desktop, menuOpen, settingsOpen]);

  useEffect(() => {
    if (!desktop) return;
    return window.lecpunchDesktop?.onBongoLayoutChanged((changedSkinId) => {
      if (changedSkinId === skin.id) setLayoutRevision((revision) => revision + 1);
    });
  }, [desktop, skin.id]);

  useLayoutEffect(() => {
    if (!desktop || !settingsOpen || !skinLayout) {
      setSettingsPanelPlacement(null);
      return;
    }
    const stage = hostRef.current;
    const panel = settingsPanelRef.current;
    if (!stage || !panel) return;
    const placePanel = () => {
      const gutter = 12;
      const stageWidth = stage.clientWidth;
      const stageHeight = stage.clientHeight;
      const maxWidth = Math.max(1, stageWidth - gutter * 2);
      const maxHeight = Math.max(1, stageHeight - gutter * 2);
      const panelWidth = Math.min(panel.offsetWidth, maxWidth);
      const panelHeight = Math.min(panel.offsetHeight, maxHeight);
      const menu = skinLayout.menu;
      const settingsOffset = menu.actionOffsets[4];
      if (!settingsOffset) return;
      const anchorX = menu.anchorX + catScale * menu.scaleOffsetX + settingsOffset.x * menu.spacing;
      const anchorY = menu.anchorY + catScale * menu.scaleOffsetY + settingsOffset.y * menu.spacing;
      // Default direction preserves the centred layout's established left/down
      // opening. Only the panel's visual placement flips; layout data stays put.
      const leftDown = { left: anchorX - panelWidth - gutter, top: anchorY + menu.bubbleSize + gutter };
      const rightDown = { left: anchorX + menu.bubbleSize + gutter, top: leftDown.top };
      const left = leftDown.left >= gutter && leftDown.left + panelWidth <= stageWidth - gutter
        ? leftDown.left
        : rightDown.left >= gutter && rightDown.left + panelWidth <= stageWidth - gutter
          ? rightDown.left
          : clamp(leftDown.left, gutter, stageWidth - gutter - panelWidth);
      const up = anchorY - panelHeight - gutter;
      const top = leftDown.top + panelHeight <= stageHeight - gutter
        ? leftDown.top
        : up >= gutter
          ? up
          : clamp(leftDown.top, gutter, stageHeight - gutter - panelHeight);
      setSettingsPanelPlacement((current) => current
        && current.left === left && current.top === top && current.maxWidth === maxWidth && current.maxHeight === maxHeight
        ? current
        : { left, top, maxWidth, maxHeight });
    };
    const animationFrame = window.requestAnimationFrame(placePanel);
    const observer = new ResizeObserver(placePanel);
    observer.observe(stage);
    observer.observe(panel);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
    };
  }, [catScale, desktop, settingsOpen, skinLayout]);

  useEffect(() => {
    const keepInsideScreen = () => setPosition((current) => clampPosition(current));
    window.addEventListener('resize', keepInsideScreen);
    return () => window.removeEventListener('resize', keepInsideScreen);
  }, []);

  const persistPosition = (next: Position) => {
    localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(next));
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    // Desktop movement and menu toggling are handled by the main-process
    // uIOhook pipeline, so this renderer never competes for pointer capture.
    if (desktop) return;
    if ((event.target as HTMLElement).closest('button')) return;
    if (desktop) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, origin: position, moved: false };
  };

  const onSettingsHeaderPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!desktop || event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
    // The main process owns native movement. Starting the same uIOhook-backed
    // pipeline here keeps panel-header dragging separate from every form row.
    event.preventDefault();
    void window.lecpunchDesktop?.beginCompanionHeaderDrag();
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.startX;
    const dy = event.clientY - pointer.startY;
    if (Math.hypot(dx, dy) > 6) pointer.moved = true;
    setPosition(clampPosition({ x: pointer.origin.x + dx, y: pointer.origin.y + dy }));
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (desktop) return;
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    pointerRef.current = null;
    if (pointer.moved && !desktop) {
      setPosition((current) => {
        persistPosition(current);
        return current;
      });
    } else {
      setMenuOpen((open) => !open);
    }
  };

  const actions = [
    { label: attendanceActive ? '结束打卡' : '开始打卡', icon: <Coffee size={18} />, onClick: onAttendance },
    { label: immersive ? '退出沉浸' : '沉浸模式', icon: <Moon size={18} />, onClick: onToggleImmersive },
    { label: '定时任务', icon: <BellRing size={18} />, onClick: onOpenSchedule },
    { label: '小猫商城', icon: <ShoppingBag size={18} />, onClick: onOpenShop },
    ...(desktop && onToggleSettings ? [{ label: '小猫设置', icon: <Settings2 size={18} />, onClick: onToggleSettings }] : [])
  ];

  const companionStyle = skinLayout
    ? {
        '--skin-canvas-width': `${skinLayout.canvas.width}px`, '--skin-canvas-height': `${skinLayout.canvas.height}px`,
        '--skin-stage-left': `${skinLayout.stage.left}px`, '--skin-stage-bottom': `${skinLayout.stage.bottom}px`, '--skin-stage-width': `${skinLayout.stage.width}px`, '--skin-stage-height': `${skinLayout.stage.height}px`,
        '--skin-model-left': `${skinLayout.model.left}px`, '--skin-model-bottom': `${skinLayout.model.bottom}px`, '--skin-model-width': `${skinLayout.model.width}px`, '--skin-model-height': `${skinLayout.model.height}px`,
        '--menu-anchor-x': `${skinLayout.menu.anchorX + catScale * skinLayout.menu.scaleOffsetX}px`, '--menu-anchor-y': `${skinLayout.menu.anchorY + catScale * skinLayout.menu.scaleOffsetY}px`,
        '--bubble-size': `${skinLayout.menu.bubbleSize}px`,
        ...Object.fromEntries(skinLayout.menu.actionOffsets.flatMap((offset, index) => [
          [`--bubble-${index + 1}-x`, `${offset.x * skinLayout.menu.spacing}px`],
          [`--bubble-${index + 1}-y`, `${offset.y * skinLayout.menu.spacing}px`]
        ])),
        '--skin-orbit-right': `${skinLayout.orbit.right}px`, '--skin-orbit-bottom': `${skinLayout.orbit.bottom}px`,
        '--skin-message-left': `${skinLayout.message.left}px`, '--skin-message-top': `${skinLayout.message.top}px`
      } as CSSProperties
    : {} as CSSProperties;
  if (!desktop) {
    companionStyle.left = position.x;
    companionStyle.top = position.y;
  }

  const leftOverlayKey = getOverlayKey(skinLayout, 'left', leftKey);
  const rightOverlayKey = getOverlayKey(skinLayout, 'right', rightKey);
  return <aside className={`bongo-companion bongo-skin-${skin.id} ${desktop ? 'desktop-companion' : ''} ${menuOpen ? 'menu-open' : ''}`} style={companionStyle} aria-label="LecPunch 小猫助手">
    <div className="cat-orbit" aria-hidden="true" />
    <div className="bongo-stage" ref={hostRef} onPointerDown={onPointerDown} onPointerMove={desktop ? undefined : onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} role="button" tabIndex={0} aria-label="拖动小猫移动，单击打开快捷功能">
      <div className="cat-visual" key={liveStageKey} ref={visualRef}>
        <img className="bongo-background" src={`${assetBase}${skin.backgroundFile}`} alt="" draggable={false} />
        <canvas className="bongo-canvas" ref={canvasRef} />
        {leftOverlayKey ? <img className="bongo-key-layer" src={`${assetBase}resources/left-keys/${leftOverlayKey}.png`} alt="" draggable={false} /> : null}
        {rightOverlayKey ? <img className="bongo-key-layer" src={`${assetBase}resources/right-keys/${rightOverlayKey}.png`} alt="" draggable={false} /> : null}
        {!ready ? <div className={`bongo-loading ${loadFailed || layoutFailed ? 'load-failed' : ''}`}>{layoutFailed ? '小猫皮肤布局不可用' : loadFailed ? '小猫动画暂时不可用' : '小猫正在准备…'}</div> : null}
      </div>
      {catMessage ? <div className="cat-head-message" key={catMessage.id}>{catMessage.message}</div> : null}
      <div className="cat-action-fan">{actions.map((action, index) => <button className={`cat-action cat-action-${index + 1}`} key={action.label} onClick={() => {
        action.onClick();
        setMenuOpen(false);
      }} title={action.label}><span>{action.icon}</span><em>{action.label}</em></button>)}</div>
      {desktop && settingsOpen ? <section ref={settingsPanelRef} className="cat-settings-panel" aria-label="小猫设置" style={settingsPanelPlacement ? { left: settingsPanelPlacement.left, top: settingsPanelPlacement.top, bottom: 'auto', maxWidth: settingsPanelPlacement.maxWidth, maxHeight: settingsPanelPlacement.maxHeight } : undefined}>
        <div className="cat-settings-header" onPointerDown={onSettingsHeaderPointerDown}><strong>小猫设置</strong><button onClick={onToggleSettings} aria-label="关闭小猫设置">×</button></div>
        <p className="cat-size-label"><span>显示大小</span><strong>{Math.round(catScale * 100)}%</strong></p>
        <input className="cat-size-slider" type="range" min="50" max="130" step="1" value={Math.round(catScale * 100)} onChange={(event) => onSetCatScale?.(Number(event.target.value) / 100)} style={{ background: `linear-gradient(90deg, #24a8e5 ${((catScale - 0.5) / 0.8) * 100}%, #c7e6f4 ${((catScale - 0.5) / 0.8) * 100}%)` }} aria-label="调整小猫显示大小" />
        <div className="cat-size-marks" aria-hidden="true"><span>50%</span><span>100%</span><span>130%</span></div>
        <label className="cat-template-label">提醒回复模板
          <input className="cat-template-input" value={replyTemplate} maxLength={80} onChange={(event) => onSetReplyTemplate?.(event.target.value)} placeholder="{username} {message}" />
          <small>可用变量：{'{username}'}、{'{message}'}</small>
        </label>
        <button className="cat-settings-row" onClick={onOpenLayoutEditor}><Settings2 size={15} /><span>布局编辑</span></button>
        <p className="cat-template-label"><small>将在主窗口的“个人设置 → 桌宠布局”中打开；透明桌宠不参与编辑。</small></p>
        <button className="cat-settings-row" onClick={() => onSetVisible?.(false)}><MonitorOff size={15} /><span>隐藏桌面小猫</span></button>
        <button className="cat-settings-row" onClick={onOpenFocusAssist}><ExternalLink size={15} /><span>打开 Windows 专注助手</span></button>
      </section> : null}
      <div className="bongo-hint">{menuOpen ? '点选快捷功能' : '拖动移动 · 单击菜单'}</div>
    </div>
  </aside>;
};
