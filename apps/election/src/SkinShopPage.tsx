import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Coins, LockKeyhole, ShoppingBag, Sparkles } from 'lucide-react';
import { fetchPoints, fetchShopUnlocks, unlockShopSkin } from '@/lib/api';

type Skin = { id: string; scene: 'standard' | 'keyboard'; label: string; directory: string; source: 'builtin' | 'user'; backgroundFile: string; coverFile: string; pricePoints: number; isFree: boolean };
const PRICE = 600;
const previewNames = ['艾瑟雅', '爱莉希雅', '动力小猫', '菲比', '可莉', '流萤', '罗小黑', '乃琳', '皮蛋', '珊瑚宫心海', '逍遥散人', '小熊猫昊昊', '绪山真寻', '籽岷', '子音', 'doro'];
const previewIds = ['aixiya', 'ailixiya', 'power-cat', 'feibi', 'keli', 'liuying', 'luoxiaohei', 'nailin', 'pidan', 'sangonomiya-kokomi', 'xiaoyao-sanren', 'red-panda-haohao', 'oyama-mahiru', 'zimin', 'ziyin', 'doro'];
const previewSkins: Skin[] = [
  { id: 'standard-default', label: '默认标准小猫', directory: 'standard/default', source: 'builtin', scene: 'standard', backgroundFile: 'resources/background.png', coverFile: 'resources/cover.png', pricePoints: 0, isFree: true },
  ...previewNames.map((label, index) => ({ id: previewIds[index], label, directory: `standard/market/${previewIds[index]}`, source: 'builtin' as const, scene: 'standard' as const, backgroundFile: 'resources/background.png', coverFile: 'resources/cover.png', pricePoints: PRICE, isFree: false }))
];

const coverUrl = (skin: Skin) => {
  const relative = `${skin.directory}/${skin.coverFile || skin.backgroundFile}`;
  if (!window.lecpunchDesktop?.isDesktop) return `${import.meta.env.BASE_URL}bongocat/${relative}`;
  return skin.source === 'user' ? `lecpunch-assets://user-skins/${relative}` : `lecpunch-assets://bongocat/${relative}`;
};

export const SkinShopPage = ({ onNotice, onPurchased }: { onNotice: (message: string) => void; onPurchased: () => void }) => {
  const desktop = Boolean(window.lecpunchDesktop?.isDesktop);
  const [skins, setSkins] = useState<Skin[]>(previewSkins);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Skin | null>(null);
  const [buying, setBuying] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [unlockResult, pointsResult, available] = await Promise.all([
        fetchShopUnlocks(), fetchPoints(), desktop ? window.lecpunchDesktop!.listCompanionSkins() : Promise.resolve(previewSkins)
      ]);
      setUnlocked(new Set(unlockResult.skinIds));
      setPoints(pointsResult.totalPoints);
      setSkins(available.filter((skin): skin is Skin => skin.scene === 'standard'));
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '无法读取小猫商城。');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void refresh(); }, []);
  const paidCount = useMemo(() => skins.filter((skin) => !skin.isFree).length, [skins]);
  const owns = (skin: Skin) => skin.isFree || unlocked.has(skin.id);
  const confirmPurchase = async () => {
    if (!pending) return;
    setBuying(true);
    try {
      const result = await unlockShopSkin(pending.id);
      setUnlocked((current) => new Set([...current, pending.id]));
      setPoints(result.totalPoints);
      setPending(null);
      onPurchased();
      onNotice(result.alreadyUnlocked ? `“${pending.label}”已在你的皮肤库中。` : `已解锁“${pending.label}”，扣除 ${result.pricePoints} 积分。`);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '购买失败。');
    } finally {
      setBuying(false);
    }
  };

  return <div className="page skin-shop-page">
    <section className="welcome-row"><div><p className="eyebrow">CAT SHOP</p><h1>小猫<span>商城</span></h1><p>标准模式皮肤每款 600 积分。购买成功立即解锁，积分消费不可退回。</p></div><div className="shop-points"><Coins size={22} /><span><small>当前积分</small><strong>{loading ? '…' : points}</strong></span></div></section>
    <section className="shop-guide"><Sparkles size={18} /><span>默认白猫永久免费；你从本机导入的自定义皮肤也遵循同一解锁规则。解锁记录保存在 LecPunch 服务端。</span></section>
    <p className="shop-count">共 {paidCount} 款可购买标准皮肤</p>
    <section className="skin-shop-grid">{skins.map((skin) => {
      const owned = owns(skin);
      return <article className={`skin-shop-card ${owned ? 'is-owned' : 'is-locked'}`} key={skin.id}>
        <img src={coverUrl(skin)} alt={`${skin.label} 预览`} onError={(event) => { event.currentTarget.src = coverUrl({ ...skin, coverFile: skin.backgroundFile }); }} />
        <div className="skin-shop-card-body"><div><h2>{skin.label}</h2><p>{skin.isFree ? '永久免费' : `${skin.pricePoints} 积分 · 约 10 小时专注`}</p></div>{owned ? <span className="skin-owned"><CheckCircle2 size={14} />已解锁</span> : <button type="button" onClick={() => setPending(skin)}><LockKeyhole size={14} />解锁</button>}</div>
      </article>;
    })}</section>
    <p className="shop-boundary">说明：客户端本地文件可能被篡改而显示未拥有皮肤；小团队采用服务端解锁记录加本地信任模型，正式购买状态以服务端账本为准。</p>
    {pending ? <div className="shop-confirm-mask" role="dialog" aria-modal="true" aria-label="确认购买皮肤"><section><ShoppingBag size={24} /><h2>确认解锁“{pending.label}”</h2><p>将从你的积分余额扣除 <strong>{pending.pricePoints} 积分</strong>。该消费不可退回。</p><div><button type="button" disabled={buying} onClick={() => setPending(null)}>取消</button><button type="button" disabled={buying} onClick={() => void confirmPurchase()}>{buying ? '正在解锁…' : '确认扣除并解锁'}</button></div></section></div> : null}
  </div>;
};
