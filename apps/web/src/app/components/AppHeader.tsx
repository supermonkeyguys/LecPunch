import { useRootStore } from '../store/root-store';
import { WeekSelector } from './WeekSelector';

export const AppHeader = () => {
  const selectedWeek = useRootStore((state) => state.selectedWeek);
  const setSelectedWeek = useRootStore((state) => state.setSelectedWeek);

  return (
    <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400">当前视图</p>
        <p className="text-sm font-medium text-gray-900">团队打卡面板</p>
      </div>
      <WeekSelector value={selectedWeek} onChange={setSelectedWeek} />
    </header>
  );
};
