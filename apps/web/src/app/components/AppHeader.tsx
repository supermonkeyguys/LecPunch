import { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '@lecpunch/ui';
import { getCurrentNetworkStatus, type CurrentNetworkStatus } from '@/features/network-policy/network-policy.api';
import { NETWORK_STATUS_REFRESH_MS } from '@/shared/constants/timing';
import { useRootStore } from '../store/root-store';

export const AppHeader = () => {
  const user = useRootStore((s) => s.auth.user);
  const token = useRootStore((s) => s.auth.token);
  const navigate = useNavigate();
  const [networkStatus, setNetworkStatus] = useState<CurrentNetworkStatus | null>(null);
  const [networkStatusLoaded, setNetworkStatusLoaded] = useState(false);
  const [networkStatusError, setNetworkStatusError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const setIntervalFn =
      typeof globalThis.setInterval === 'function' ? globalThis.setInterval : window.setInterval.bind(window);
    const clearIntervalFn =
      typeof globalThis.clearInterval === 'function' ? globalThis.clearInterval : window.clearInterval.bind(window);

    if (!token) {
      setNetworkStatus(null);
      setNetworkStatusLoaded(false);
      setNetworkStatusError(true);
      return;
    }

    const loadNetworkStatus = async () => {
      try {
        const nextStatus = await getCurrentNetworkStatus();
        if (cancelled) {
          return;
        }

        setNetworkStatus(nextStatus);
        setNetworkStatusLoaded(true);
        setNetworkStatusError(false);
      } catch {
        if (cancelled) {
          return;
        }

        setNetworkStatus(null);
        setNetworkStatusLoaded(true);
        setNetworkStatusError(true);
      }
    };

    setNetworkStatus(null);
    setNetworkStatusLoaded(false);
    setNetworkStatusError(false);
    void loadNetworkStatus();

    const interval = setIntervalFn(() => {
      void loadNetworkStatus();
    }, NETWORK_STATUS_REFRESH_MS);

    return () => {
      cancelled = true;
      clearIntervalFn(interval);
    };
  }, [token]);

  const isAllowed = networkStatus?.isAllowed ?? false;
  const isBlocked = networkStatusLoaded && Boolean(networkStatus) && !isAllowed;
  const statusLabel = !networkStatusLoaded
    ? '检测网络中'
    : isAllowed
      ? '已连接团队网络'
      : networkStatusError
        ? '网络状态待确认'
        : '当前网络未放行';
  const statusClassName = isAllowed
    ? 'bg-green-50 text-green-700 border-green-100'
    : isBlocked
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : 'bg-slate-100 text-slate-700 border-slate-200';
  const StatusIcon = isAllowed ? Wifi : WifiOff;

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 z-10 flex-shrink-0">
      <div className="flex items-center text-sm">
        <div
          className={`flex items-center rounded-full border px-3 py-1.5 ${statusClassName}`}
          title={networkStatus?.clientIp ? `服务端识别 IP: ${networkStatus.clientIp}` : undefined}
        >
          <StatusIcon className="mr-2 h-4 w-4" />
          <span className="font-medium">{statusLabel}</span>
        </div>
      </div>
      <div
        className="flex items-center space-x-3 cursor-pointer"
        onClick={() => navigate('/profile')}
      >
        <Avatar
          name={user?.displayName ?? '用户'}
          size="sm"
          avatarBase64={user?.avatarBase64}
          avatarEmoji={user?.avatarEmoji}
          avatarColor={user?.avatarColor}
        />
        <span className="text-sm font-medium text-gray-700 hidden md:block">
          {user?.displayName ?? '用户'}
        </span>
      </div>
    </header>
  );
};
