import { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

export const AuthLayout = ({ children }: AuthLayoutProps) => {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12">
      <section className="hidden lg:flex col-span-5 bg-blue-600 text-white flex-col justify-between p-10">
        <div>
          <p className="text-sm uppercase tracking-widest text-blue-100">FocusTeam</p>
          <h1 className="text-4xl font-semibold mt-6">LecPunch 打卡系统</h1>
          <p className="mt-4 text-blue-100">
            纯 Web MVP，先完成成员侧登录、打卡、记录和周统计闭环。
          </p>
        </div>
        <p className="text-xs text-blue-100/70">© {new Date().getFullYear()} LecPunch</p>
      </section>
      <section className="col-span-7 flex items-center justify-center bg-slate-50 p-8">{children}</section>
    </div>
  );
};
