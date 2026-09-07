import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react';
import { ImagePlus, LockKeyhole, Save, ShieldCheck, UserRound } from 'lucide-react';
import { updatePassword, updateProfile } from '@/lib/api';
import { getLocalMeetingSettings, saveLocalMeetingSettings } from '@/lib/meeting';
import type { ElectionUser } from '@/types';
import { CompanionLayoutEditor } from '@/CompanionLayoutEditor';
import { AppearanceSettings, type AppearanceState, type ThemePreference } from '@/AppearanceSettings';

const imageToAvatarDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const maxSide = 512;
        const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('浏览器无法处理该头像。');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('无法读取该图片，请选择 JPG、PNG 或 WebP 图片。'));
    };
    image.src = objectUrl;
  });

export const ProfileSettingsPage = ({ user, onUserChanged, onNotice, themePreference, onThemePreferenceChanged, appearance, onAppearanceChanged }: {
  user: ElectionUser;
  onUserChanged: (user: ElectionUser) => void;
  onNotice: (notice: string) => void;
  themePreference: ThemePreference;
  onThemePreferenceChanged: (preference: ThemePreference) => void;
  appearance: AppearanceState;
  onAppearanceChanged: (appearance: AppearanceState) => void;
}) => {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [avatarDraft, setAvatarDraft] = useState<string | null>(null);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [meetingOrigin, setMeetingOrigin] = useState('');
  const [savingMeeting, setSavingMeeting] = useState(false);

  useEffect(() => {
    setDisplayName(user.displayName);
    setAvatarDraft(null);
  }, [user.displayName, user.avatarBase64]);

  useEffect(() => {
    void getLocalMeetingSettings()
      .then((settings) => setMeetingOrigin(settings.meetingOrigin))
      .catch((error: unknown) => onNotice(error instanceof Error ? error.message : '读取本机会议设置失败。'));
  }, [onNotice]);

  const selectAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return onNotice('请选择图片文件。');
    if (file.size > 8 * 1024 * 1024) return onNotice('头像原图请控制在 8MB 以内。');
    try {
      setAvatarDraft(await imageToAvatarDataUrl(file));
      onNotice('头像已载入，点击“保存个人信息”后同步到服务器。');
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '头像处理失败。');
    }
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    const nextName = displayName.trim();
    if (nextName.length < 2) return onNotice('昵称至少需要 2 个字符。');
    setSavingProfile(true);
    try {
      const updated = await updateProfile({ displayName: nextName, ...(avatarDraft ? { avatarBase64: avatarDraft } : {}) });
      onUserChanged(updated);
      setAvatarDraft(null);
      onNotice('个人信息和头像已同步到服务器。');
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '个人信息保存失败。');
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 6) return onNotice('新密码至少需要 6 位。');
    if (newPassword !== confirmPassword) return onNotice('两次输入的新密码不一致。');
    setSavingPassword(true);
    try {
      await updatePassword(oldPassword, newPassword);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onNotice('密码已修改，请妥善保管。');
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '密码修改失败，请确认当前密码。');
    } finally {
      setSavingPassword(false);
    }
  };

  const avatar = avatarDraft ?? user.avatarBase64;
  const saveMeeting = async (event: FormEvent) => {
    event.preventDefault();
    setSavingMeeting(true);
    try {
      const saved = await saveLocalMeetingSettings({ meetingOrigin });
      setMeetingOrigin(saved.meetingOrigin);
      onNotice(saved.meetingOrigin ? '局域网会议地址已保存到本机。' : '已清除本机局域网会议地址。');
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '会议地址保存失败。');
    } finally {
      setSavingMeeting(false);
    }
  };
  return <div className="page profile-page">
    <section className="welcome-row"><div><p className="eyebrow">ACCOUNT SETTINGS</p><h1>个人<span>设置</span></h1><p>头像与昵称会同步保存到服务器，并在桌面端的成员和管理员列表中展示。</p></div><div className="profile-hero-avatar profile-avatar-image">{avatar ? <img src={avatar} alt={`${user.displayName} 的头像`} /> : user.avatarEmoji || user.displayName.slice(0, 1)}</div></section>
    <section className="profile-grid"><form className="profile-card blue-card" onSubmit={saveProfile}><div className="profile-card-title"><UserRound size={19} /><div><h2>基本信息</h2><p>已有的服务器头像会自动读取；选择新图片后会压缩至适合传输的尺寸。</p></div></div><label>显示昵称<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={32} /></label><label className="avatar-upload">上传头像<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void selectAvatar(event)} /><span><ImagePlus size={16} />选择 JPG、PNG 或 WebP 图片</span></label><div className="profile-readonly-grid"><InfoRow label="真实姓名" value={user.realName || '未设置'} /><InfoRow label="登录账号" value={user.username} /><InfoRow label="学号" value={user.studentId || '未设置'} /><InfoRow label="入学年份" value={user.enrollYear ? String(user.enrollYear) : '未设置'} /><InfoRow label="团队角色" value={user.role === 'admin' ? '管理员' : '成员'} /></div><button className="profile-save" disabled={savingProfile}>{savingProfile ? '正在保存…' : '保存个人信息'}<Save size={16} /></button></form><form className="profile-card blue-card" onSubmit={savePassword}><div className="profile-card-title"><LockKeyhole size={19} /><div><h2>登录安全</h2><p>修改密码后，当前桌面端仍保持登录。</p></div></div><label>当前密码<input type="password" value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} autoComplete="current-password" required /></label><label>新密码<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={6} required /></label><label>确认新密码<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={6} required /></label><div className="profile-security-note"><ShieldCheck size={16} /><span>密码仅通过加密连接提交，桌面端不会保存明文密码。</span></div><button className="profile-save" disabled={savingPassword}>{savingPassword ? '正在修改…' : '更新密码'}<LockKeyhole size={16} /></button></form><form className="profile-card blue-card meeting-settings-card" onSubmit={saveMeeting}><div className="profile-card-title"><ShieldCheck size={19} /><div><h2>局域网会议</h2><p>仅保存在本机，不会提交到 LecPunch 服务器。更换队长机后在此更新一次即可。</p></div></div><label>局域网会议地址<input value={meetingOrigin} onChange={(event) => setMeetingOrigin(event.target.value)} placeholder="https://192.168.x.x:8443" inputMode="url" /></label><p className="meeting-settings-help">仅接受 HTTPS 局域网 IP、localhost 或 .local 地址；不能包含路径、账号、查询参数。</p><button className="profile-save" disabled={savingMeeting}>{savingMeeting ? '正在保存…' : '保存会议地址'}<Save size={16} /></button></form><AppearanceSettings preference={themePreference} onPreferenceChanged={onThemePreferenceChanged} appearance={appearance} onAppearanceChanged={onAppearanceChanged} onNotice={onNotice} /><CompanionLayoutEditor onNotice={onNotice} /></section>
  </div>;
};

const InfoRow = ({ label, value }: { label: string; value: string }) => <div><small>{label}</small><strong>{value}</strong></div>;
