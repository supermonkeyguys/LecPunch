import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { Download, RotateCcw, SlidersHorizontal, Upload } from 'lucide-react';
import { fetchShopUnlocks } from '@/lib/api';

type Skin = { id: string; scene: 'standard'; label: string; directory: string; source: 'builtin' | 'user'; backgroundFile: string; coverFile: string; pricePoints: number; isFree: boolean };
type SkinImportResult = { directory: string; status: 'imported' | 'failed'; reason?: string };
type Point = { x: number; y: number };
type Layout = {
  scene: 'standard'; label: string; backgroundFile: string;
  canvas: { width: number; height: number };
  stage: { left: number; bottom: number; width: number; height: number };
  model: { left: number; bottom: number; width: number; height: number };
  menu: { anchorX: number; anchorY: number; scaleOffsetX: number; scaleOffsetY: number; actionOffsets: Point[]; spacing: number; bubbleSize: number };
};

const ACTION_NAMES = ['打卡', '沉浸', '定时', '商城', '设置'];
const fallbackSkin: Skin = { id: 'standard-default', scene: 'standard', label: '默认标准小猫', directory: 'standard/default', source: 'builtin', backgroundFile: 'resources/background.png', coverFile: 'resources/cover.png', pricePoints: 0, isFree: true };
const fallbackLayout: Layout = {
  scene: 'standard', label: '默认标准小猫', backgroundFile: 'resources/background.png',
  canvas: { width: 780, height: 520 }, stage: { left: 0, bottom: 0, width: 780, height: 520 },
  model: { left: 84, bottom: 58, width: 612, height: 354 },
  menu: { anchorX: 630, anchorY: 180, scaleOffsetX: 0, scaleOffsetY: 0, actionOffsets: [{ x: -71, y: 65 }, { x: -126, y: 12 }, { x: -130, y: -55 }, { x: -79, y: -108 }, { x: -8, y: -129 }], spacing: 1, bubbleSize: 44 }
};

const isLayout = (value: unknown): value is Layout => {
  const layout = value as Partial<Layout>;
  return layout?.scene === 'standard' && Boolean(layout.canvas && layout.stage && layout.model && layout.menu)
    && Number.isFinite(layout.canvas?.width) && Number.isFinite(layout.canvas?.height)
    && Array.isArray(layout.menu?.actionOffsets) && layout.menu.actionOffsets.length === 5
    && Number.isFinite(layout.menu?.anchorX) && Number.isFinite(layout.menu?.anchorY)
    && Number.isFinite(layout.menu?.spacing) && Number.isFinite(layout.menu?.bubbleSize);
};
const cloneLayout = (layout: Layout): Layout => JSON.parse(JSON.stringify(layout)) as Layout;
const clamp = (value: number, lower: number, upper: number) => Math.max(lower, Math.min(upper, value));

export const CompanionLayoutEditor = ({ onNotice }: { onNotice: (notice: string) => void }) => {
  const desktop = Boolean(window.lecpunchDesktop?.isDesktop);
  const [skins, setSkins] = useState<Skin[]>([fallbackSkin]);
  const [skinId, setSkinId] = useState(fallbackSkin.id);
  const [layout, setLayout] = useState<Layout>(fallbackLayout);
  const [editing, setEditing] = useState(false);
  const [notice, setLocalNotice] = useState('');
  const [importResults, setImportResults] = useState<SkinImportResult[]>([]);
  const [unlockedSkinIds, setUnlockedSkinIds] = useState<Set<string>>(new Set());
  const dragRef = useRef<{ pointerId: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const skin = skins.find((item) => item.id === skinId) ?? fallbackSkin;
  const assetBase = !desktop ? `${import.meta.env.BASE_URL}bongocat/${skin.directory}/`
    : skin.source === 'user' ? `lecpunch-assets://user-skins/${skin.directory}/` : `lecpunch-assets://bongocat/${skin.directory}/`;
  const scale = useMemo(() => Math.min(1, 650 / layout.canvas.width, 390 / layout.canvas.height), [layout.canvas.height, layout.canvas.width]);

  const loadLayout = async (nextSkinId: string) => {
    if (!desktop) {
      setLayout(cloneLayout(fallbackLayout));
      return;
    }
    const next = await window.lecpunchDesktop?.getCompanionSkinLayout(nextSkinId);
    if (!isLayout(next)) throw new Error('皮肤布局格式无效。');
    setLayout(next);
  };

  useEffect(() => {
    if (!desktop) return;
    let alive = true;
    void Promise.all([window.lecpunchDesktop!.getCompanionSettings(), window.lecpunchDesktop!.listCompanionSkins(), fetchShopUnlocks()])
      .then(async ([settings, available, unlocks]) => {
        if (!alive) return;
        setUnlockedSkinIds(new Set(unlocks.skinIds));
        const standard = available.filter((item) => item.scene === 'standard').map((item) => ({ ...item, scene: 'standard' as const }));
        if (standard.length) setSkins(standard);
        const nextId = standard.some((item) => item.id === settings.skinId) ? settings.skinId : standard[0]?.id ?? fallbackSkin.id;
        setSkinId(nextId);
        await loadLayout(nextId);
      })
      .catch((error: unknown) => setLocalNotice(error instanceof Error ? error.message : '无法读取桌宠皮肤。'));
    return () => { alive = false; };
  }, [desktop]);

  useEffect(() => () => { if (desktop) void window.lecpunchDesktop?.setCompanionLayoutEditing(false); }, [desktop]);

  const patchMenu = (changes: Partial<Layout['menu']>) => setLayout((current) => ({ ...current, menu: { ...current.menu, ...changes } }));
  const beginEditing = async () => {
    if (!desktop) return setLocalNotice('本地预览：编辑控件只演示，不访问桌宠或服务器。');
    await window.lecpunchDesktop?.setCompanionLayoutEditing(true);
    setEditing(true);
    setLocalNotice('桌宠已临时隐藏。拖动唯一的黑色中心块可整体移动五个功能气泡。');
  };
  const endEditing = async (message?: string) => {
    dragRef.current = null;
    if (desktop) await window.lecpunchDesktop?.setCompanionLayoutEditing(false);
    setEditing(false);
    if (message) setLocalNotice(message);
  };
  const changeSkin = async (nextId: string) => {
    try {
      const next = skins.find((item) => item.id === nextId);
      if (next && !next.isFree && !unlockedSkinIds.has(nextId)) throw new Error('该皮肤尚未解锁，请先在小猫商城购买。');
      if (editing) await endEditing();
      setSkinId(nextId);
      if (desktop) await window.lecpunchDesktop?.updateCompanionSettings({ skinId: nextId });
      await loadLayout(nextId);
      setLocalNotice('已切换标准模式皮肤；各皮肤的布局覆盖互不影响。');
    } catch (error) { setLocalNotice(error instanceof Error ? error.message : '切换皮肤失败。'); }
  };
  const importSkin = async () => {
    if (!desktop) return setLocalNotice('本地预览不打开文件选择器。安装版可从皮肤库导入标准模式皮肤。');
    const result = await window.lecpunchDesktop?.importCompanionSkin();
    if (!result || result.canceled) return;
    setImportResults(result.items.map((item) => ({ directory: item.directory, status: item.status, reason: item.reason })));
    const imported = result.skins.map((item): Skin => ({ ...item, scene: 'standard' }));
    if (!imported.length) return setLocalNotice(result.error ?? '没有可导入的皮肤。');
    setSkins((current) => [...current.filter((item) => !imported.some((skin) => skin.id === item.id)), ...imported]);
    await changeSkin(imported[0].id);
    setLocalNotice(result.error ?? `已导入 ${imported.length} 个皮肤，并选中“${imported[0].label}”。`);
  };
  const save = async () => {
    if (!desktop) return setLocalNotice('本地预览不会写入文件。');
    try {
      const saved = await window.lecpunchDesktop?.saveCompanionSkinOverride(skin.id, { menu: layout.menu });
      if (!isLayout(saved)) throw new Error('保存后的布局无效。');
      setLayout(saved);
      await endEditing('布局已保存到本机；重启后仍会保持。');
      onNotice('桌宠布局已保存并立即应用。');
    } catch (error) { setLocalNotice(error instanceof Error ? error.message : '布局保存失败。'); }
  };
  const reset = async () => {
    if (!desktop) return setLocalNotice('本地预览已回到内置示例布局。');
    try {
      const restored = await window.lecpunchDesktop?.resetCompanionSkinOverride(skin.id);
      if (!isLayout(restored)) throw new Error('默认布局无效。');
      setLayout(restored);
      await endEditing('已清除该皮肤的本地布局覆盖，恢复内置布局。');
      onNotice('桌宠布局已恢复默认。');
    } catch (error) { setLocalNotice(error instanceof Error ? error.message : '恢复默认布局失败。'); }
  };
  const startDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!editing) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId };
  };
  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const anchorX = clamp((event.clientX - bounds.left) / scale, 0, layout.canvas.width);
    const anchorY = clamp((event.clientY - bounds.top) / scale, 0, layout.canvas.height);
    patchMenu({ anchorX, anchorY });
  };
  const stopDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
  };
  const previewStyle = { width: layout.canvas.width * scale, height: layout.canvas.height * scale, '--layout-scale': scale } as CSSProperties;
  const modelStyle = { left: layout.model.left * scale, top: (layout.canvas.height - layout.model.bottom - layout.model.height) * scale, width: layout.model.width * scale, height: layout.model.height * scale } as CSSProperties;

  return <section id="companion-layout-settings" className="profile-card blue-card companion-layout-card">
    <div className="profile-card-title"><SlidersHorizontal size={19} /><div><h2>桌宠布局</h2><p>只支持标准模式。布局编辑在主窗口完成，透明桌宠不会参与鼠标操作。</p></div></div>
    <label>标准模式皮肤<select value={skinId} onChange={(event) => void changeSkin(event.target.value)} disabled={editing}>{skins.map((item) => <option key={item.id} value={item.id} disabled={!item.isFree && !unlockedSkinIds.has(item.id)}>{item.label}{!item.isFree && !unlockedSkinIds.has(item.id) ? '（未解锁）' : ''}</option>)}</select></label>
    <div className="companion-layout-actions"><button type="button" onClick={() => void importSkin()} disabled={editing}><Upload size={15} />导入皮肤</button><button type="button" onClick={() => void beginEditing()} disabled={editing}><SlidersHorizontal size={15} />进入布局编辑</button><button type="button" onClick={() => void reset()}><RotateCcw size={15} />恢复默认</button></div>
    <div className={`companion-layout-preview ${editing ? 'is-editing' : ''}`} ref={canvasRef} style={previewStyle} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag}>
      <img src={`${assetBase}${skin.backgroundFile}`} alt="当前皮肤背景预览" draggable={false} />
      <div className="companion-layout-model" style={modelStyle}>猫模型区域<br /><small>示意</small></div>
      <div className="companion-layout-crosshair companion-layout-crosshair-x" style={{ left: layout.menu.anchorX * scale }} /><div className="companion-layout-crosshair companion-layout-crosshair-y" style={{ top: layout.menu.anchorY * scale }} />
      {layout.menu.actionOffsets.map((offset, index) => {
        const left = (layout.menu.anchorX + offset.x * layout.menu.spacing) * scale;
        const top = (layout.menu.anchorY + offset.y * layout.menu.spacing) * scale;
        return <div key={ACTION_NAMES[index]} className="companion-layout-bubble" style={{ left, top, width: layout.menu.bubbleSize * scale, height: layout.menu.bubbleSize * scale }}><span>{ACTION_NAMES[index]}</span></div>;
      })}
      <button type="button" className="companion-layout-grip companion-layout-group-grip" style={{ left: layout.menu.anchorX * scale, top: layout.menu.anchorY * scale }} onPointerDown={startDrag} disabled={!editing} aria-label="拖动整组功能气泡">整组</button>
    </div>
    <p className="companion-layout-help">黑色“整组”块是唯一拖拽手柄；五个气泡固定为皮肤定义的弧形，坐标与桌宠运行时使用同一份 layout.json + 本机覆盖文件。</p>
    <div className="companion-layout-sliders"><label>锚点 X<input type="range" min="0" max={layout.canvas.width} value={Math.round(layout.menu.anchorX)} disabled={!editing} onChange={(event) => patchMenu({ anchorX: Number(event.target.value) })} /><output>{Math.round(layout.menu.anchorX)}</output></label><label>锚点 Y<input type="range" min="0" max={layout.canvas.height} value={Math.round(layout.menu.anchorY)} disabled={!editing} onChange={(event) => patchMenu({ anchorY: Number(event.target.value) })} /><output>{Math.round(layout.menu.anchorY)}</output></label><label>气泡间距<input type="range" min="50" max="180" value={Math.round(layout.menu.spacing * 100)} disabled={!editing} onChange={(event) => patchMenu({ spacing: Number(event.target.value) / 100 })} /><output>{Math.round(layout.menu.spacing * 100)}%</output></label><label>气泡大小<input type="range" min="32" max="72" value={Math.round(layout.menu.bubbleSize)} disabled={!editing} onChange={(event) => patchMenu({ bubbleSize: Number(event.target.value) })} /><output>{Math.round(layout.menu.bubbleSize)}px</output></label></div>
    {editing ? <div className="companion-layout-actions"><button type="button" className="companion-layout-save" onClick={() => void save()}><Download size={15} />保存布局</button><button type="button" onClick={() => void endEditing('已退出布局编辑；未保存的更改不会写入本机。')}>取消并显示桌宠</button></div> : null}
    {notice ? <p className="companion-layout-notice">{notice}</p> : null}
    {importResults.length ? <ul className="companion-import-results" aria-label="皮肤导入结果">{importResults.map((item) => <li key={item.directory} className={item.status}><strong>{item.status === 'imported' ? '成功' : '失败'}</strong><span>{item.directory}</span>{item.reason ? <small>{item.reason}</small> : null}</li>)}</ul> : null}
  </section>;
};
