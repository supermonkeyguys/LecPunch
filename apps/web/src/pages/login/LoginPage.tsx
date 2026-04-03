import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRootStore } from '@/app/store/root-store';
import { login } from '@/features/auth/auth.api';

export const LoginPage = () => {
  const navigate = useNavigate();
  const setAuth = useRootStore((state) => state.setAuth);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload =
        mode === 'login'
          ? await login({ username, password })
          : await login({ username, password, displayName, mode: 'register' });

      localStorage.setItem('lecpunch.token', payload.accessToken);
      localStorage.setItem('lecpunch.user', JSON.stringify(payload.user));
      setAuth({ token: payload.accessToken, user: payload.user });
      navigate('/');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? '登录失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md w-full mx-auto bg-white shadow-card rounded-2xl p-10">
      <p className="text-sm text-gray-500 mb-2">欢迎来到 FocusTeam</p>
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">登录 LecPunch</h1>
      <p className="text-gray-500 mb-6">先完成登录，后续页面会基于真实接口展示当前打卡状态、周统计和记录列表。</p>

      <div className="mb-6 flex rounded-xl bg-slate-100 p-1 text-sm">
        <button
          type="button"
          className={`flex-1 rounded-lg px-3 py-2 ${mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          onClick={() => setMode('login')}
        >
          登录
        </button>
        <button
          type="button"
          className={`flex-1 rounded-lg px-3 py-2 ${mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          onClick={() => setMode('register')}
        >
          注册
        </button>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {mode === 'register' ? (
          <label className="block text-sm text-slate-700">
            显示名称
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-500"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>
        ) : null}

        <label className="block text-sm text-slate-700">
          用户名
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-500"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>

        <label className="block text-sm text-slate-700">
          密码
          <input
            type="password"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-500"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error ? <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div> : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {submitting ? '提交中...' : mode === 'login' ? '登录' : '注册并登录'}
        </button>
      </form>
    </div>
  );
};
