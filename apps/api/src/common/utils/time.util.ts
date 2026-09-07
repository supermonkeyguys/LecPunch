import { TIMEZONE } from '@lecpunch/shared';
import { DateTime } from 'luxon';

export function getWeekKey(date: Date) {
  const dt = DateTime.fromJSDate(date, { zone: TIMEZONE });
  const weekStart = dt.startOf('day').minus({ days: dt.weekday - 1 });
  return weekStart.toFormat('yyyy-LL-dd');
}

export function parseIsoWeekKey(weekKey: string) {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!match) {
    return null;
  }

  const weekYear = Number(match[1]);
  const weekNumber = Number(match[2]);
  const monday = DateTime.fromObject({ weekYear, weekNumber, weekday: 1 }, { zone: TIMEZONE }).startOf('day');
  if (!monday.isValid || monday.weekYear !== weekYear || monday.weekNumber !== weekNumber) {
    return null;
  }

  return monday;
}

export function getIsoWeekKey(date: Date) {
  const dt = DateTime.fromJSDate(date, { zone: TIMEZONE });
  return `${dt.weekYear}-W${String(dt.weekNumber).padStart(2, '0')}`;
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
