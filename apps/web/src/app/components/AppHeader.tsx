import { Wifi } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '@lecpunch/ui';
import { useRootStore } from '../store/root-store';

export const AppHeader = () => {
  const user = useRootStore((s) => s.auth.user);
  const navigate = useNavigate();

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 z-10 flex-shrink-0">
      <div className="flex items-center text-sm">
        <div className="flex items-center px-3 py-1.5 bg-green-50 text-green-700 rounded-full border border-green-100">
          <Wifi className="w-4 h-4 mr-2" />
          <span className="font-medium">已连接团队网络</span>
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
