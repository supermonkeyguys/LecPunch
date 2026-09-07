export const ATTENDANCE_MAX_SECONDS = 5 * 60 * 60; // 18000s
// Warn once, fifteen minutes before the five-hour attendance limit.
export const WARNING_THRESHOLD_SECONDS = ATTENDANCE_MAX_SECONDS - 15 * 60; // 17100s
export const ATTENDANCE_KEEPALIVE_INTERVAL_SECONDS = 30;
export const ATTENDANCE_KEEPALIVE_TIMEOUT_SECONDS = 180;
export const TIMEZONE = 'Asia/Shanghai';
export const WEEK_FIRST_DAY = 1; // Monday
