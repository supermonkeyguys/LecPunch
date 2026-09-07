import { useEffect, useState } from 'react';
import { ImageUp, MonitorCog, Moon, SlidersHorizontal, Sun, Trash2 } from 'lucide-react';

export type ThemePreference = 'system' | 'light' | 'dark';
export type AppearanceState = { backgroundOpacity: number; backgroundBlur: number; backgroundUrl: string };

const emptyAppearance: AppearanceState = { backgroundOpacity: 62, backgroundBlur: 0, backgroundUrl: '' };

export const AppearanceSettings = ({
  preference,
  onPreferenceChanged,
  appearance,
  onAppearanceChanged,
  onNotice
}: {
  preference: ThemePreference;
  onPreferenceChanged: (preference: ThemePreference) => void;
  appearance: AppearanceState;
  onAppearanceChanged: (appearance: AppearanceState) => void;
  onNotice: (message: string) => void;
}) => {
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!window.lecpunchDesktop) return;
    void window.lecpunchDesktop.getAppearanceSettings()
      .then(onAppearanceChanged)
      .catch((error: unknown) => onNotice(error instanceof Error ? error.message : '读取本机外观设置失败。'));
  }, [onAppearanceChanged, onNotice]);

  const chooseBackground = async () => {
    if (!window.lecpunchDesktop) return onNotice('自定义背景仅在 Windows 桌面端可用。');
    setSaving(true);
    try {
      const next = await window.lecpunchDesktop.selectAppearanceBackground();
      onAppearanceChanged(next);
      if (next.backgroundUrl) onNotice('背景已复制到本机应用数据目录，不会上传到服务器。');
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '选择背景失败。');
    } finally {
      setSaving(false);
    }
  };

  const clearBackground = async () => {
    if (!window.lecpunchDesktop) return;
    setSaving(true);
    try {
      onAppearanceChanged(await window.lecpunchDesktop.clearAppearanceBackground());
      onNotice('已清除本机自定义背景。');
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '清除背景失败。');
    } finally {
      setSaving(false);
    }
  };

  const updateAppearance = async (changes: Pick<AppearanceState, 'backgroundOpacity' | 'backgroundBlur'>) => {
    const optimistic = { ...appearance, ...changes };
    onAppearanceChanged(optimistic);
    if (!window.lecpunchDesktop) return;
    try {
      onAppearanceChanged(await window.lecpunchDesktop.updateAppearanceSettings(changes));
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '保存外观设置失败。');
    }
  };

  return <section className="appearance-card blue-card" aria-labelledby="appearance-title">
    <header className="appearance-card-header">
      <div className="profile-card-title"><MonitorCog size={19} /><div><h2 id="appearance-title">主窗口外观</h2><p>主题和背景仅保存在这台设备；不会同步到团队或服务器。</p></div></div>
    </header>
    <div className="appearance-section">
      <span className="appearance-label">主题</span>
      <div className="theme-picker" role="group" aria-label="选择主题">
        <button type="button" className={preference === 'system' ? 'selected' : ''} onClick={() => onPreferenceChanged('system')}><MonitorCog size={15} />跟随系统</button>
        <button type="button" className={preference === 'light' ? 'selected' : ''} onClick={() => onPreferenceChanged('light')}><Sun size={15} />浅色</button>
        <button type="button" className={preference === 'dark' ? 'selected' : ''} onClick={() => onPreferenceChanged('dark')}><Moon size={15} />深色</button>
      </div>
    </div>
    <div className="appearance-section">
      <div className="appearance-label-row"><span className="appearance-label">自定义背景</span><small>{appearance.backgroundUrl ? '已启用本地背景' : '当前使用默认背景'}</small></div>
      <div className={`appearance-preview ${appearance.backgroundUrl ? 'has-background' : ''}`} style={appearance.backgroundUrl ? { backgroundImage: `url("${appearance.backgroundUrl}")` } : undefined}>
        <span>背景仅从本地图片导入</span>
      </div>
      <div className="appearance-actions"><button type="button" className="appearance-import" disabled={saving} onClick={() => void chooseBackground()}><ImageUp size={15} />选择图片</button>{appearance.backgroundUrl ? <button type="button" className="appearance-clear" disabled={saving} onClick={() => void clearBackground()}><Trash2 size={15} />清除</button> : null}</div>
      <p className="appearance-help">支持 PNG、JPG、WebP，最大 15MB。图片将复制到本机应用数据目录，远程 URL 不被接受。</p>
    </div>
    <div className="appearance-section appearance-sliders">
      <label><span><SlidersHorizontal size={14} />背景透明度 <strong>{appearance.backgroundOpacity}%</strong></span><input type="range" min="0" max="100" value={appearance.backgroundOpacity} onChange={(event) => void updateAppearance({ backgroundOpacity: Number(event.target.value), backgroundBlur: appearance.backgroundBlur })} /></label>
      <label><span><SlidersHorizontal size={14} />背景虚化 <strong>{appearance.backgroundBlur}px</strong></span><input type="range" min="0" max="24" value={appearance.backgroundBlur} onChange={(event) => void updateAppearance({ backgroundOpacity: appearance.backgroundOpacity, backgroundBlur: Number(event.target.value) })} /></label>
    </div>
  </section>;
};

export { emptyAppearance };
