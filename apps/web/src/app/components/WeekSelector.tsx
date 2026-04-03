type WeekKey = 'current' | 'prev1' | 'prev2' | 'prev3';

interface WeekSelectorProps {
  value: WeekKey;
  onChange: (value: WeekKey) => void;
}

const labels: Record<WeekKey, string> = {
  current: '本周',
  prev1: '上周',
  prev2: '前两周',
  prev3: '前三周'
};

export const WeekSelector = ({ value, onChange }: WeekSelectorProps) => {
  return (
    <select
      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
      value={value}
      onChange={(event) => onChange(event.target.value as WeekKey)}
    >
      {Object.entries(labels).map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </select>
  );
};
