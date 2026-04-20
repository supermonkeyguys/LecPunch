import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Input, Alert } from '@lecpunch/ui';
import { ERROR_CODES } from '@lecpunch/shared';
import { useAuthStore } from '@/app/store/auth-store';
import { login } from '@/features/auth/auth.api';
import { getApiErrorCode, getApiErrorMessage } from '@/shared/lib/api-error';

const loginModeSchema = z.enum(['login', 'register']);

const loginFormSchema = z
  .object({
    mode: loginModeSchema,
    username: z.string().trim().min(1, '请输入用户名'),
    password: z.string().min(6, '密码至少 6 位'),
    displayName: z.string(),
    realName: z.string(),
    studentId: z.string()
  })
  .superRefine((value, context) => {
    if (value.mode !== 'register') {
      return;
    }

    const displayName = value.displayName.trim() || value.username.trim();
    if (displayName.length < 2) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['displayName'],
        message: '显示名称至少 2 个字符'
      });
    }

    if (value.realName.trim().length < 2) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['realName'],
        message: '真实姓名至少 2 个字符'
      });
    }

    if (!/^\d{12}$/.test(value.studentId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['studentId'],
        message: '学号必须为 12 位数字'
      });
    }
  });

type LoginFormValues = z.infer<typeof loginFormSchema>;

export const LoginPage = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    clearErrors,
    formState: { errors }
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      mode: 'login',
      username: '',
      password: '',
      displayName: '',
      realName: '',
      studentId: ''
    }
  });
  const mode = watch('mode');

  const onSubmit = async (values: LoginFormValues) => {
    setError(null);

    setSubmitting(true);
    try {
      const displayName = values.displayName.trim() || values.username.trim();
      const payload =
        values.mode === 'login'
          ? await login({ username: values.username, password: values.password })
          : await login({
              username: values.username,
              password: values.password,
              displayName,
              studentId: values.studentId,
              realName: values.realName,
              mode: 'register',
            });

      setAuth({ token: payload.accessToken, user: payload.user });
      navigate('/');
    } catch (error) {
      const errorCode = getApiErrorCode(error);
      if (values.mode === 'register' && errorCode === ERROR_CODES.AUTH_UNAUTHORIZED) {
        setError('当前未开放注册，请联系管理员');
      } else {
        setError(getApiErrorMessage(error, values.mode === 'login' ? '登录失败，请稍后重试' : '注册失败，请稍后重试'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white p-10 rounded-2xl shadow-xl border border-gray-100">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">欢迎回来 👋</h2>
        <p className="text-gray-500">请登录您的账号继续使用</p>
      </div>

      {/* Mode tabs */}
      <div className="mb-6 flex rounded-xl bg-gray-100 p-1 text-sm">
        {(['login', 'register'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setValue('mode', m);
              clearErrors();
              setError(null);
            }}
            className={`flex-1 rounded-lg px-3 py-2 font-medium transition-colors ${
              mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            {m === 'login' ? '登录' : '注册'}
          </button>
        ))}
      </div>

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        {mode === 'register' ? (
          <>
            <Controller
              control={control}
              name="displayName"
              render={({ field }) => (
                <Input
                  id="displayName"
                  label="显示名称"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.displayName?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="realName"
              render={({ field }) => (
                <Input
                  id="realName"
                  label="真实姓名"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.realName?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="studentId"
              render={({ field }) => (
                <Input
                  id="studentId"
                  label="学号（12位数字）"
                  value={field.value}
                  onChange={field.onChange}
                  maxLength={12}
                  error={errors.studentId?.message}
                />
              )}
            />
          </>
        ) : null}

        <Controller
          control={control}
          name="username"
          render={({ field }) => (
            <Input
              id="username"
              label="用户名"
              value={field.value}
              onChange={field.onChange}
              error={errors.username?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <Input
              id="password"
              label="密码"
              type="password"
              value={field.value}
              onChange={field.onChange}
              error={errors.password?.message}
            />
          )}
        />

        {error ? (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        ) : null}

        <Button type="submit" size="lg" loading={submitting} className="w-full mt-2">
          {mode === 'login' ? '登录系统' : '注册并登录'}
        </Button>
      </form>
    </div>
  );
};
