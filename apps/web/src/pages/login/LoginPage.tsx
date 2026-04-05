import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Alert } from '@lecpunch/ui';
import { useRootStore } from '@/app/store/root-store';
import { login } from '@/features/auth/auth.api';

export const LoginPage = () => {
  const navigate = useNavigate();
  const setAuth = useRootStore((state) => state.setAuth);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [realName, setRealName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!username.trim()) { setError('请输入用户名'); return; }
    if (password.length < 6) { setError('密码至少 6 位'); return; }
    if (mode === 'register') {
      const trimmedName = displayName.trim() || username.trim();
      if (trimmedName.length < 2) { setError('显示名称至少 2 个字符'); return; }
      if (realName.trim().length < 2) { setError('真实姓名至少 2 个字符'); return; }
      if (!/^\d{12}$/.test(studentId)) { setError('学号必须为 12 位数字'); return; }
    }

    setSubmitting(true);
    try {
      const payload =
        mode === 'login'
          ? await login({ username, password })
          : await login({
              username,
              password,
              displayName,
              studentId,
              realName,
              mode: 'register',
            });

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
            onClick={() => setMode(m)}
            className={`flex-1 rounded-lg px-3 py-2 font-medium transition-colors ${
              mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            {m === 'login' ? '登录' : '注册'}
          </button>
        ))}
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {mode === 'register' ? (
          <>
            <Input
              id="displayName"
              label="显示名称"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <Input
              id="realName"
              label="真实姓名"
              value={realName}
              onChange={(e) => setRealName(e.target.value)}
            />
            <Input
              id="studentId"
              label="学号（12位数字）"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              maxLength={12}
            />
          </>
        ) : null}

        <Input
          id="username"
          label="用户名"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <Input
          id="password"
          label="密码"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
