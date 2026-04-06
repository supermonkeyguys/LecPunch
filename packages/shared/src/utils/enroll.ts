/** 根据入学年份返回每周打卡目标秒数 */
export function weeklyGoalSeconds(enrollYear: number): number {
  return enrollYear >= 2025 ? 28 * 3600 : 38 * 3600;
}

/** 根据当前日期返回当前在校届别数组 */
export function activeEnrollYears(now: Date = new Date()): number[] {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const latest = month >= 9 ? year : year - 1;
  const earliest = latest - 3;
  return Array.from({ length: 4 }, (_, i) => earliest + i);
}
