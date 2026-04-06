import { Calendar } from 'lucide-react';
import { Select } from '@lecpunch/ui';

type WeekKey = 'current' | 'prev1' | 'prev2' | 'prev3';

interface WeekSelectorProps {
  value: WeekKey;
  onChange: (value: WeekKey) => void;
}

const options = [
  { value: 'current', label: '本周' },
  { value: 'prev1',   label: '上周' },
  { value: 'prev2',   label: '前两周' },
  { value: 'prev3',   label: '前三周' },
];

export const WeekSelector = ({ value, onChange }: WeekSelectorProps) => {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as WeekKey)}
      options={options}
      prefix={<Calendar className="w-4 h-4" />}
    />
  );
};
