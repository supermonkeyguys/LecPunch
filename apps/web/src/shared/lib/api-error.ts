import { ERROR_CODES, type ErrorCode } from '@lecpunch/shared';

const ERROR_MESSAGE_MAP: Partial<Record<ErrorCode, string>> = {
  [ERROR_CODES.AUTH_INVALID_CREDENTIALS]: '用户名或密码错误',
  [ERROR_CODES.AUTH_UNAUTHORIZED]: '登录已失效，请重新登录',
  [ERROR_CODES.USER_DISABLED]: '当前账号已被禁用',
  [ERROR_CODES.ATTENDANCE_ALREADY_CHECKED_IN]: '您已有进行中的打卡，请勿重复上卡',
  [ERROR_CODES.ATTENDANCE_NO_ACTIVE_SESSION]: '当前没有进行中的打卡',
  [ERROR_CODES.ATTENDANCE_NETWORK_NOT_ALLOWED]: '当前网络不在允许范围内，无法打卡',
  [ERROR_CODES.ATTENDANCE_SESSION_INVALIDATED]: '当前打卡已失效，请重新上卡',
  [ERROR_CODES.ATTENDANCE_CROSS_TEAM_FORBIDDEN]: '您无权查看其他团队成员的数据'
};

const SERVICE_UNAVAILABLE_MESSAGE =
  '后端服务不可达，请先启动 API（localhost:4000）并确保 MongoDB（localhost:27017）可用';

const extractApiErrorPayload = (error: unknown) => {
  const response = (error as { response?: { data?: { code?: string; message?: string } } })?.response;
  return response?.data;
};

const extractApiErrorStatus = (error: unknown) => {
  return (error as { response?: { status?: number } })?.response?.status;
};

const isNetworkError = (error: unknown) => {
  const candidate = error as { code?: string; message?: string; response?: unknown };
  if (candidate?.response) {
    return false;
  }

  return (
    candidate?.code === 'ERR_NETWORK' ||
    candidate?.code === 'ECONNREFUSED' ||
    candidate?.message?.includes('ECONNREFUSED') === true ||
    candidate?.message?.includes('Network Error') === true
  );
};

export const getApiErrorCode = (error: unknown) => {
  return extractApiErrorPayload(error)?.code;
};

export const getApiErrorMessage = (error: unknown, fallback = '操作失败，请稍后重试') => {
  const status = extractApiErrorStatus(error);
  if (status === 502 || status === 503 || status === 504 || isNetworkError(error)) {
    return SERVICE_UNAVAILABLE_MESSAGE;
  }

  const payload = extractApiErrorPayload(error);
  const mappedMessage = payload?.code ? ERROR_MESSAGE_MAP[payload.code as ErrorCode] : undefined;
  return mappedMessage ?? payload?.message ?? fallback;
};
