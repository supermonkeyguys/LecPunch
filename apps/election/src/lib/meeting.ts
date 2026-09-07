export interface LocalMeetingSettings {
  meetingOrigin: string;
}

export const MEETING_ROOM_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const BROWSER_MEETING_SETTINGS_KEY = 'lecpunch.election.meeting-settings';

const isPrivateMeetingHost = (hostname: string) => {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local')) return true;
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168);
};

/** Mirrors the main-process gate before an origin may be used in an iframe. */
export const normalizeMeetingOrigin = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('会议地址格式无效。');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) {
    throw new Error('会议地址必须是无路径、无账号信息的 HTTPS 局域网地址。');
  }
  if (!isPrivateMeetingHost(url.hostname)) throw new Error('仅允许配置局域网 IP、localhost 或 .local 会议主机。');
  return url.origin;
};

export const validateMeetingRoom = (value: string) => {
  const room = value.trim();
  if (!MEETING_ROOM_PATTERN.test(room)) throw new Error('房间名仅可使用字母、数字、下划线和连字符，长度 1–64，且必须以字母或数字开头。');
  return room;
};

const readBrowserSettings = (): LocalMeetingSettings => {
  try {
    const parsed = JSON.parse(localStorage.getItem(BROWSER_MEETING_SETTINGS_KEY) || '{}') as Partial<LocalMeetingSettings>;
    return { meetingOrigin: normalizeMeetingOrigin(parsed.meetingOrigin || '') };
  } catch {
    return { meetingOrigin: '' };
  }
};

export const getLocalMeetingSettings = async (): Promise<LocalMeetingSettings> => {
  if (window.lecpunchDesktop?.getMeetingSettings) return window.lecpunchDesktop.getMeetingSettings();
  return readBrowserSettings();
};

/** Stores only a LAN address locally. It never calls the LecPunch server. */
export const saveLocalMeetingSettings = async (input: LocalMeetingSettings): Promise<LocalMeetingSettings> => {
  const next = { meetingOrigin: normalizeMeetingOrigin(input.meetingOrigin) };
  if (window.lecpunchDesktop?.updateMeetingSettings) return window.lecpunchDesktop.updateMeetingSettings(next);
  localStorage.setItem(BROWSER_MEETING_SETTINGS_KEY, JSON.stringify(next));
  return next;
};

export const buildMeetingUrl = (origin: string, room: string, token: string) =>
  `${normalizeMeetingOrigin(origin)}/${encodeURIComponent(validateMeetingRoom(room))}?jwt=${encodeURIComponent(token)}`;
