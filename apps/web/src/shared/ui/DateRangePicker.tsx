import { X } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  onClear: () => void;
}

export const DateRangePicker = ({ startDate, endDate, onStartChange, onEndChange, onClear }: DateRangePickerProps) => {
  const hasValue = startDate || endDate;

  return (
    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 h-[38px] text-sm">
      <input
        type="date"
        value={startDate}
        max={endDate || undefined}
        onChange={(e) => onStartChange(e.target.value)}
        className="outline-none text-gray-700 w-[130px] cursor-pointer"
      />
      <span className="text-gray-400 select-none">—</span>
      <input
        type="date"
        value={endDate}
        min={startDate || undefined}
        onChange={(e) => onEndChange(e.target.value)}
        className="outline-none text-gray-700 w-[130px] cursor-pointer"
      />
      {hasValue && (
        <button
          onClick={onClear}
          className="text-gray-400 hover:text-gray-600 ml-1 flex-shrink-0"
          title="清除"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
