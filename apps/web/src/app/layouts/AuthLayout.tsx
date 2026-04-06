import { ReactNode } from 'react';
import { Clock } from 'lucide-react';

interface AuthLayoutProps {
  children: ReactNode;
}

export const AuthLayout = ({ children }: AuthLayoutProps) => {
  return (
    <div className="flex h-screen w-full bg-gray-50">
      <div className="hidden lg:flex flex-col justify-center items-center w-5/12 bg-blue-600 text-white p-12 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pattern-grid-lg" />
        <div className="z-10 text-center">
          <Clock className="w-24 h-24 mx-auto mb-8 opacity-90" />
          <h1 className="text-4xl font-bold mb-4">FocusTeam 打卡系统</h1>
          <p className="text-blue-100 text-lg max-w-sm mx-auto">
            连接专属网络，记录每一次专注。专为实验室与高效团队打造。
          </p>
        </div>
        <p className="absolute bottom-8 text-xs text-blue-100/70">© {new Date().getFullYear()} LecPunch</p>
      </div>
      <div className="flex-1 flex items-center justify-center p-8">
        {children}
      </div>
    </div>
  );
};
