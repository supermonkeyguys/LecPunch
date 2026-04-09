import { TIMEZONE } from '@lecpunch/shared';
import { DateTime } from 'luxon';

export function getWeekKey(date: Date) {
  const dt = DateTime.fromJSDate(date, { zone: TIMEZONE });
  const weekStart = dt.startOf('day').minus({ days: dt.weekday - 1 });
  return weekStart.toFormat('yyyy-LL-dd');
}

export function getShanghaiDateRange(startDate?: string, endDate?: string) {
  const range: { $gte?: Date; $lte?: Date } = {};

  if (startDate) {
    range.$gte = DateTime.fromISO(startDate, { zone: TIMEZONE }).startOf('day').toJSDate();
  }

  if (endDate) {
    range.$lte = DateTime.fromISO(endDate, { zone: TIMEZONE }).endOf('day').toJSDate();
  }

  return Object.keys(range).length > 0 ? range : undefined;
}
