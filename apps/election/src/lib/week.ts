const ISO_WEEK_PATTERN = /^\d{4}-W\d{2}$/;

const pad = (value: number) => String(value).padStart(2, '0');

const datePartsInShanghai = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: read('year'), month: read('month'), day: read('day') };
};

const isoForUtcDate = (date: Date) => {
  const thursday = new Date(date.valueOf());
  const weekday = thursday.getUTCDay() || 7;
  thursday.setUTCDate(thursday.getUTCDate() + 4 - weekday);
  const isoYear = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstWeekday = firstThursday.getUTCDay() || 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() + 4 - firstWeekday);
  const week = 1 + Math.round((thursday.valueOf() - firstThursday.valueOf()) / 604_800_000);
  return `${isoYear}-W${pad(week)}`;
};

/** Returns the current ISO week from the server's Asia/Shanghai calendar. */
export const getShanghaiIsoWeek = (date = new Date()) => {
  const parts = datePartsInShanghai(date);
  return isoForUtcDate(new Date(Date.UTC(parts.year, parts.month - 1, parts.day)));
};

export const isIsoWeek = (value: string) => ISO_WEEK_PATTERN.test(value);

/** Converts an ISO week to the API's Monday YYYY-MM-DD weekKey without guessing a user/team. */
export const isoWeekToShanghaiMonday = (week: string) => {
  if (!isIsoWeek(week)) throw new Error('周格式应为 YYYY-Www，例如 2026-W36。');
  const [yearText, numberText] = week.split('-W');
  const year = Number(yearText);
  const number = Number(numberText);
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const januaryFourthWeekday = januaryFourth.getUTCDay() || 7;
  const monday = new Date(Date.UTC(year, 0, 4 - (januaryFourthWeekday - 1) + (number - 1) * 7));
  if (isoForUtcDate(monday) !== week) throw new Error('该 ISO 周不存在，请检查周数。');
  return `${monday.getUTCFullYear()}-${pad(monday.getUTCMonth() + 1)}-${pad(monday.getUTCDate())}`;
};
