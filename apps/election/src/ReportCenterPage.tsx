import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock3, FileWarning, ImagePlus, Send, ShieldCheck, X } from 'lucide-react';
import { ApiError, submitReport } from '@/lib/api';

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type DraftImage = { id: string; file: File; url: string };

const imageError = (error: unknown) => {
  if (error instanceof ApiError && error.status === 413) return '图片过大，请将每张图片控制在 3MB 以内。';
  if (error instanceof ApiError && error.status === 415) return '仅支持 JPG、PNG 或 WebP 格式图片。';
  return error instanceof Error ? error.message : '请假申请提交失败，请稍后重试。';
};

export const ReportCenterPage = ({ onNotice }: { onNotice: (message: string) => void }) => {
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<DraftImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const imagesRef = useRef<DraftImage[]>([]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);
  useEffect(() => () => imagesRef.current.forEach((item) => URL.revokeObjectURL(item.url)), []);

  const chooseImages = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!selected.length) return;
    if (images.length + selected.length > MAX_IMAGES) return onNotice('每次请假申请最多上传 3 张图片。');
    const invalid = selected.find((file) => !ALLOWED_IMAGE_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES);
    if (invalid) return onNotice(!ALLOWED_IMAGE_TYPES.has(invalid.type) ? '仅支持 JPG、PNG 或 WebP 格式图片。' : '图片过大，请将每张图片控制在 3MB 以内。');
    setImages((current) => [...current, ...selected.map((file, index) => ({ id: `${Date.now()}-${index}-${file.name}`, file, url: URL.createObjectURL(file) }))]);
  };

  const removeImage = (id: string) => {
    setImages((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return current.filter((item) => item.id !== id);
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = description.trim();
    if (!text || text.length > 2_000) return onNotice('请填写 1–2000 字的请假说明。');
    setSubmitting(true);
    try {
      const report = await submitReport(text, images.map((item) => item.file));
      images.forEach((item) => URL.revokeObjectURL(item.url));
      setImages([]);
      setDescription('');
      onNotice(report.images.length ? '请假申请已提交，管理员可在 3 小时内查看附件。' : '请假申请已提交，管理员已收到站内通知。');
    } catch (error) {
      onNotice(imageError(error));
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="page report-center-page">
    <section className="welcome-row"><div><p className="eyebrow">LEAVE CENTER</p><h1>请假<span>申请</span></h1><p>提交给本团队管理员处理。图片不会公开转发，并会在 3 小时后自动清理。</p></div></section>
    <div className="report-center-grid">
      <form className="blue-card report-form" onSubmit={submit}>
        <header><div className="report-form-icon"><FileWarning size={21} /></div><div><h2>提交请假申请</h2><p>请清晰说明请假原因、时间和需要管理员协助的事项；必要时补充最多三张证明图片。</p></div></header>
        <label>请假说明<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} placeholder="请说明请假原因、起止时间及需要管理员协助的事项…" rows={8} required /></label>
        <div className="report-form-count"><span>{description.trim().length}/2000</span><small>附件 {images.length}/{MAX_IMAGES}</small></div>
        <div className="report-drafts">{images.map((image) => <figure key={image.id}><img src={image.url} alt="待提交的请假附件" /><button type="button" onClick={() => removeImage(image.id)} aria-label={`移除 ${image.file.name}`}><X size={14} /></button><figcaption>{image.file.name}</figcaption></figure>)}</div>
        {images.length < MAX_IMAGES ? <label className="report-upload"><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={chooseImages} /><span><ImagePlus size={17} />添加 JPG、PNG 或 WebP 图片<small>每张最大 3MB</small></span></label> : null}
        <button className="profile-save report-submit" disabled={submitting}>{submitting ? '正在安全提交…' : '提交请假申请'}<Send size={16} /></button>
      </form>
      <aside className="report-help-stack">
        <article className="blue-card report-help-card"><Clock3 size={20} /><div><h2>图片保留 3 小时</h2><p>管理员只能通过受 JWT 保护的界面查看。到期后图片会被服务器自动清除。</p></div></article>
        <article className="blue-card report-help-card"><ShieldCheck size={20} /><div><h2>仅团队管理员可见</h2><p>不会生成公开图片链接，也不会将你的附件转发到第三方平台。</p></div></article>
        <article className="blue-card report-help-card"><CheckCircle2 size={20} /><div><h2>提交后有通知</h2><p>在线管理员会收到站内提醒；桌面端会在重新连接时补拉未读通知。</p></div></article>
      </aside>
    </div>
  </div>;
};
