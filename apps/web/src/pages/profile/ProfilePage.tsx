import { useState } from 'react';
import { Avatar, Button, Input } from '@lecpunch/ui';
import { useRootStore } from '@/app/store/root-store';
import { showToast } from '@/shared/ui/toast';
import { updateProfile, updatePassword } from '@/features/users/users.api';
import { getApiErrorCode } from '@/shared/lib/api-error';
import { AvatarEditor, type AvatarSelection } from './AvatarEditor';

export const ProfilePage = () => {
  const user = useRootStore((s) => s.auth.user);
  const setAuth = useRootStore((s) => s.setAuth);
  const token = useRootStore((s) => s.auth.token);

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [showAvatarEditor, setShowAvatarEditor] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleAvatarSave = async (selection: AvatarSelection) => {
    const input =
      selection.type === 'color'
        ? { avatarColor: selection.color }
        : selection.type === 'emoji'
          ? { avatarEmoji: selection.emoji }
          : { avatarBase64: selection.base64 };

    const updated = await updateProfile(input);
    // sync store and localStorage
    const newUser = { ...user!, ...updated };
    setAuth({ token, user: newUser });
    localStorage.setItem('lecpunch.user', JSON.stringify(newUser));
    showToast('头像已更新');
    setShowAvatarEditor(false);
  };

  const handleProfileSave = async () => {
    if (!displayName.trim() || displayName.trim().length < 2) {
      showToast('显示名称至少 2 个字符', 'error');
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await updateProfile({ displayName: displayName.trim() });
      const newUser = { ...user!, ...updated };
      setAuth({ token, user: newUser });
      localStorage.setItem('lecpunch.user', JSON.stringify(newUser));
      showToast('资料已保存');
    } catch {
      showToast('保存失败，请稍后重试', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSave = async () => {
    setPasswordError(null);
    if (!oldPassword) { setPasswordError('请输入当前密码'); return; }
    if (newPassword.length < 6) { setPasswordError('新密码至少 6 位'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('两次输入的密码不一致'); return; }

    setSavingPassword(true);
    try {
      await updatePassword(oldPassword, newPassword);
      showToast('密码已修改');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const code = getApiErrorCode(err);
      setPasswordError(code === 'WRONG_PASSWORD' ? '当前密码不正确' : '修改失败，请稍后重试');
    } finally {
      setSavingPassword(false);
    }
  };

  const roleLabel = user?.role === 'admin' ? '管理员' : '成员';

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">个人信息</h1>

      {/* Avatar Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex items-center gap-6">
        <Avatar
          name={user?.displayName ?? '用户'}
          size="lg"
          avatarBase64={user?.avatarBase64}
          avatarEmoji={user?.avatarEmoji}
          avatarColor={user?.avatarColor}
          className="w-20 h-20 text-2xl"
        />
        <div>
          <p className="text-sm text-gray-500 mb-2">头像</p>
          <Button variant="outline" size="sm" onClick={() => setShowAvatarEditor(true)}>
            更换头像
          </Button>
        </div>
      </div>

      {/* Basic Info Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
        <h2 className="font-bold text-gray-800">基本信息</h2>

        <Input
          id="displayName"
          label="显示名称"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">真实姓名</p>
            <p className="text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">{user?.realName ?? '—'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">学号</p>
            <p className="text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">{user?.studentId ?? '—'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">入学年份</p>
            <p className="text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">{user?.enrollYear ?? '—'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">登录账号</p>
            <p className="text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">{user?.username ?? '—'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">角色</p>
            <p className="text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">{roleLabel}</p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button loading={savingProfile} onClick={handleProfileSave}>
            保存修改
          </Button>
        </div>
      </div>

      {/* Password Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
        <h2 className="font-bold text-gray-800">修改密码</h2>

        <Input
          id="oldPassword"
          label="当前密码"
          type="password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
        />
        <Input
          id="newPassword"
          label="新密码"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <Input
          id="confirmPassword"
          label="确认新密码"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        {passwordError ? (
          <p className="text-sm text-red-600">{passwordError}</p>
        ) : null}

        <div className="flex justify-end pt-2">
          <Button loading={savingPassword} onClick={handlePasswordSave}>
            修改密码
          </Button>
        </div>
      </div>

      {/* Avatar Editor Modal */}
      {showAvatarEditor ? (
        <AvatarEditor
          initialColor={user?.avatarColor}
          initialEmoji={user?.avatarEmoji}
          onSave={handleAvatarSave}
          onClose={() => setShowAvatarEditor(false)}
        />
      ) : null}
    </div>
  );
};
