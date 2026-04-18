import { memo, useMemo, useState } from 'react';
import { History } from 'lucide-react';
import type { AttendanceRecordItem } from '@/features/records/records.api';
import { PageSection } from '@/shared/ui/PageSection';
import { PageState } from '@/shared/ui/PageState';
import { buildHeatmap, cellDate, getMonday, HEATMAP_WEEKS, type HeatmapCell } from './dashboard.lib';

interface DashboardHeatmapWidgetProps {
  loading: boolean;
  records: AttendanceRecordItem[];
}

const DashboardHeatmapWidgetComponent = ({ loading, records }: DashboardHeatmapWidgetProps) => {
  const [hoveredCell, setHoveredCell] = useState<{
    dateStr: string;
    cell: HeatmapCell;
    x: number;
    y: number;
    flip: boolean;
  } | null>(null);

  const heatmapMap = useMemo(() => buildHeatmap(records), [records]);
  const todayMonday = useMemo(() => getMonday(), []);
  const totalHours = useMemo(() => {
    const totalSeconds = records.reduce((sum, record) => sum + (record.durationSeconds ?? 0), 0);
    return Math.floor(totalSeconds / 3600);
  }, [records]);

  return (
    <PageSection className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="flex items-center font-bold text-gray-800">
            <History className="mr-2 h-5 w-5 text-gray-400" />
            近 20 周打卡活跃度
          </h3>
          <p className="mt-1 text-sm text-gray-500">基于最近同步到前端的 100 条个人记录绘制</p>
        </div>
        <div className="text-sm text-gray-500">
          累计：<span className="font-bold text-gray-900">{totalHours}</span> 小时
        </div>
      </div>

      {loading && records.length === 0 ? (
        <PageState
          tone="loading"
          title="正在加载活跃度..."
          description="正在同步最近的打卡记录。"
          className="px-0 py-10"
        />
      ) : records.length === 0 ? (
        <PageState
          tone="empty"
          title="暂无打卡记录"
          description="开始完成第一条打卡后，这里会显示最近 20 周的活跃度分布。"
          className="px-0 py-10"
        />
      ) : (
        <>
          <div className="mt-2 overflow-x-auto pb-2">
            <div
              className="relative inline-grid min-w-max"
              style={{ gridTemplateRows: 'repeat(7, 1fr)', gridTemplateColumns: 'auto', gap: 6 }}
            >
              {['一', '二', '三', '四', '五', '六', '日'].map((day, index) => (
                <div
                  key={day}
                  className="flex items-center pr-3 text-xs text-gray-400"
                  style={{ gridRow: index + 1, gridColumn: 1 }}
                >
                  {day}
                </div>
              ))}

              {Array.from({ length: HEATMAP_WEEKS }).map((_, weekIndex) =>
                Array.from({ length: 7 }).map((__, dayIndex) => {
                  const dateStr = cellDate(todayMonday, weekIndex, dayIndex);
                  const cell = heatmapMap.get(dateStr) ?? { count: 0, totalSeconds: 0 };
                  const colorClass =
                    cell.count === 0
                      ? 'bg-gray-100'
                      : cell.count === 1
                        ? 'bg-blue-200'
                        : cell.count === 2
                          ? 'bg-blue-400'
                          : 'bg-blue-600';

                  return (
                    <div
                      key={`${weekIndex}-${dayIndex}`}
                      className={`h-4 w-4 cursor-pointer rounded-[3px] ${colorClass} transition-transform hover:scale-125 hover:ring-2 hover:ring-blue-400`}
                      style={{ gridRow: dayIndex + 1, gridColumn: weekIndex + 2 }}
                      onMouseEnter={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        const flip = rect.top < 60;

                        setHoveredCell({
                          dateStr,
                          cell,
                          x: rect.left + rect.width / 2,
                          y: flip ? rect.bottom : rect.top,
                          flip
                        });
                      }}
                      onMouseLeave={() => setHoveredCell(null)}
                    />
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-end gap-1.5 text-xs text-gray-400">
            <span>少</span>
            {['bg-gray-100', 'bg-blue-200', 'bg-blue-400', 'bg-blue-600'].map((colorClass) => (
              <div key={colorClass} className={`h-4 w-4 rounded-[3px] ${colorClass}`} />
            ))}
            <span>多</span>
          </div>
        </>
      )}

      {hoveredCell ? (
        <div
          className="pointer-events-none fixed z-50 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-xl"
          style={{
            left: hoveredCell.x,
            top: hoveredCell.flip ? hoveredCell.y + 8 : hoveredCell.y - 8,
            transform: hoveredCell.flip ? 'translate(-50%, 0)' : 'translate(-50%, -100%)'
          }}
        >
          <div className="font-medium">{hoveredCell.dateStr}</div>
          <div className="mt-0.5 text-gray-300">
            {hoveredCell.cell.count > 0
              ? `${hoveredCell.cell.count} 次打卡 · ${(hoveredCell.cell.totalSeconds / 3600).toFixed(1)}h`
              : '无打卡记录'}
          </div>
        </div>
      ) : null}
    </PageSection>
  );
};

export const DashboardHeatmapWidget = memo(DashboardHeatmapWidgetComponent);

DashboardHeatmapWidget.displayName = 'DashboardHeatmapWidget';
