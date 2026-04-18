import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Avatar, Button, Input } from '@lecpunch/ui';
import { useRootStore } from '@/app/store/root-store';
import { showToast } from '@/shared/ui/toast';
import { updateProfile, updatePassword } from '@/features/users/users.api';
import { getApiErrorCode } from '@/shared/lib/api-error';
import { AvatarEditor, type AvatarSelection } from './AvatarEditor';

const profileFormSchema = z.object({
  displayName: z.string().trim().min(2, '显示名称至少 2 个字符')
});

const passwordFormSchema = z
  .object({
    oldPassword: z.string().min(1, '请输入当前密码'),
    newPassword: z.string().min(6, '新密码至少 6 位'),
    confirmPassword: z.string().min(1, '请确认新密码')
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ['confirmPassword'],
    message: '两次输入的密码不一致'
  });

type ProfileFormValues = z.infer<typeof profileFormSchema>;
type PasswordFormValues = z.infer<typeof passwordFormSchema>;

export const ProfilePage = () => {
  const user = useRootStore((s) => s.auth.user);
  const setAuth = useRootStore((s) => s.setAuth);
  const token = useRootStore((s) => s.auth.token);

  const [showAvatarEditor, setShowAvatarEditor] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: user?.displayName ?? ''
    }
  });
  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      oldPassword: '',
      newPassword: '',
      confirmPassword: ''
    }
  });

  useEffect(() => {
    profileForm.reset({
      displayName: user?.displayName ?? ''
    });
  }, [profileForm, user?.displayName]);

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

  const handleProfileSave = profileForm.handleSubmit(async (values) => {
    setSavingProfile(true);
    try {
      const updated = await updateProfile({ displayName: values.displayName.trim() });
      const newUser = { ...user!, ...updated };
      setAuth({ token, user: newUser });
      localStorage.setItem('lecpunch.user', JSON.stringify(newUser));
      profileForm.reset({ displayName: newUser.displayName });
      showToast('资料已保存');
    } catch {
      showToast('保存失败，请稍后重试', 'error');
    } finally {
      setSavingProfile(false);
    }
  });

  const handlePasswordSave = passwordForm.handleSubmit(async (values) => {
    passwordForm.clearErrors();
    setSavingPassword(true);
    try {
      await updatePassword(values.oldPassword, values.newPassword);
      showToast('密码已修改');
      passwordForm.reset();
    } catch (err: unknown) {
      const code = getApiErrorCode(err);
      if (code === 'WRONG_PASSWORD') {
        passwordForm.setError('oldPassword', { message: '当前密码不正确' });
      } else {
        passwordForm.setError('root', { message: '修改失败，请稍后重试' });
      }
    } finally {
      setSavingPassword(false);
    }
  });

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
      <form className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4" onSubmit={handleProfileSave}>
        <h2 className="font-bold text-gray-800">基本信息</h2>

        <Controller
          control={profileForm.control}
          name="displayName"
          render={({ field }) => (
            <Input
              id="displayName"
              label="显示名称"
              value={field.value}
              onChange={field.onChange}
              error={profileForm.formState.errors.displayName?.message}
            />
          )}
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
          <Button type="submit" loading={savingProfile}>
            保存修改
          </Button>
        </div>
      </form>

      {/* Password Section */}
      <form className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4" onSubmit={handlePasswordSave}>
        <h2 className="font-bold text-gray-800">修改密码</h2>

        <Controller
          control={passwordForm.control}
          name="oldPassword"
          render={({ field }) => (
            <Input
              id="oldPassword"
              label="当前密码"
              type="password"
              value={field.value}
              onChange={field.onChange}
              error={passwordForm.formState.errors.oldPassword?.message}
            />
          )}
        />
        <Controller
          control={passwordForm.control}
          name="newPassword"
          render={({ field }) => (
            <Input
              id="newPassword"
              label="新密码"
              type="password"
              value={field.value}
              onChange={field.onChange}
              error={passwordForm.formState.errors.newPassword?.message}
            />
          )}
        />
        <Controller
          control={passwordForm.control}
          name="confirmPassword"
          render={({ field }) => (
            <Input
              id="confirmPassword"
              label="确认新密码"
              type="password"
              value={field.value}
              onChange={field.onChange}
              error={passwordForm.formState.errors.confirmPassword?.message}
            />
          )}
        />

        {passwordForm.formState.errors.root?.message ? (
          <p className="text-sm text-red-600">{passwordForm.formState.errors.root.message}</p>
        ) : null}

        <div className="flex justify-end pt-2">
          <Button type="submit" loading={savingPassword}>
            修改密码
          </Button>
        </div>
      </form>

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
