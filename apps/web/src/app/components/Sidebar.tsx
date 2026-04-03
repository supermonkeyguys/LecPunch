import { NavLink } from 'react-router-dom';

const navItems = [
  { label: 'Dashboard', to: '/' },
  { label: '我的记录', to: '/records' },
  { label: '团队成员', to: '/members' },
  { label: '周历史', to: '/weekly-history' }
];

export const Sidebar = () => {
  return (
    <aside className="hidden lg:flex w-64 flex-col border-r border-gray-200 bg-white">
      <div className="px-6 py-8 border-b border-gray-200">
        <p className="text-sm uppercase tracking-wide text-gray-400">FocusTeam</p>
        <p className="text-xl font-semibold text-gray-900">LecPunch</p>
      </div>
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center rounded-xl px-4 py-2 text-sm font-medium transition hover:bg-blue-50 ${
                isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-600'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};
