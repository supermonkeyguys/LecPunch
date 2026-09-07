import { useEffect, useMemo, useRef, useState } from 'react';
import { Clipboard, Clock3, KeyRound, Maximize2, Minimize2, RefreshCw, Settings2, Video, VideoOff } from 'lucide-react';
import { fetchMeetToken, isAdminPreviewSession } from '@/lib/api';
import { buildMeetingUrl, getLocalMeetingSettings, type LocalMeetingSettings, validateMeetingRoom } from '@/lib/meeting';
import type { ElectionUser, MeetTokenResponse } from '@/types';

const formatRemaining = (seconds: number) => {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
};

const teamRoomSuggestion = (teamId: string) => {
  const suffix = teamId.replace(/[^A-Za-z0-9]/g, '').slice(0, 10) || 'room';
  return `team-${suffix}-meeting`;
};

export const MeetingPage = ({ user, onNotice, onOpenSettings }: {
  user: ElectionUser;
  onNotice: (message: string) => void;
  onOpenSettings: () => void;
}) => {
  const suggestedRoom = useMemo(() => teamRoomSuggestion(user.teamId), [user.teamId]);
  const [room, setRoom] = useState(suggestedRoom);
  const [settings, setSettings] = useState<LocalMeetingSettings | null>(null);
  const [meeting, setMeeting] = useState<MeetTokenResponse | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [joining, setJoining] = useState(false);
  const [theater, setTheater] = useState(false);
  const stageRef = useRef<HTMLElement | null>(null);

  const toggleTheater = () => {
    const stage = stageRef.current;
    if (!stage) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void stage.requestFullscreen().catch(() => setTheater((current) => !current));
  };

  useEffect(() => {
    void getLocalMeetingSettings()
      .then(setSettings)
      .catch((error: unknown) => onNotice(error instanceof Error ? error.message : '读取本地会议设置失败。'));
  }, [onNotice]);

  useEffect(() => {
    if (!meeting) return;
    const expiresAt = Date.parse(meeting.expiresAt);
    const updateRemaining = () => {
      const seconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1_000));
      setRemaining(seconds);
      if (seconds === 0) setMeeting(null);
    };
    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1_000);
    return () => window.clearInterval(timer);
  }, [meeting]);

  useEffect(() => {
    const syncFullscreen = () => setTheater(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  const join = async () => {
    let safeRoom: string;
    try {
      safeRoom = validateMeetingRoom(room);
    } catch (error) {
      return onNotice(error instanceof Error ? error.message : '房间名无效。');
    }
    if (!settings?.meetingOrigin) return onNotice('请先在“个人设置”中保存局域网会议地址。');
    if (isAdminPreviewSession()) {
      setMeeting(null);
      return onNotice('本地演示模式不会请求会议令牌或连接局域网会议。');
    }
    setJoining(true);
    try {
      const token = await fetchMeetToken(safeRoom);
      setMeeting(token);
      setRemaining(token.expiresInSeconds);
      onNotice('会议令牌已取得，将在到期前自动显示剩余时间。');
    } catch (error) {
      setMeeting(null);
      onNotice(error instanceof Error ? error.message : '获取会议令牌失败。');
    } finally {
      setJoining(false);
    }
  };

  const copyInvitation = async () => {
    let safeRoom: string;
    try {
      safeRoom = validateMeetingRoom(room);
    } catch (error) {
      return onNotice(error instanceof Error ? error.message : '房间名无效。');
    }
    if (!settings?.meetingOrigin) return onNotice('请先在“个人设置”中保存局域网会议地址。');
    if (isAdminPreviewSession()) return onNotice('本地演示模式不会请求会议令牌。');
    setJoining(true);
    try {
      const invite = await fetchMeetToken(safeRoom);
      const link = buildMeetingUrl(settings.meetingOrigin, safeRoom, invite.token);
      await navigator.clipboard.writeText(`【LEC 视频会议】房间：${safeRoom}\n5 分钟内点击链接直接入会（浏览器 / 客户端均可）：${link}\n若提示选择摄像头与麦克风，请允许；仅限团队局域网访问。令牌过期后请重新复制邀请。`);
      onNotice('带令牌的会议链接已复制：5 分钟内有效，请尽快发给成员入会。');
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '生成会议邀请失败，请稍后重试。');
    } finally {
      setJoining(false);
    }
  };

  const meetingUrl = meeting && settings?.meetingOrigin
    ? buildMeetingUrl(settings.meetingOrigin, meeting.room, meeting.token)
    : null;

  return <div className="page meeting-page">
    <section className="welcome-row">
      <div><p className="eyebrow">LAN VIDEO MEETING</p><h1>视频<span>会议</span></h1><p>会议只在队长配置的局域网主机中运行。入会令牌由服务器短时签发，不会保存到本机。</p></div>
      <div className="week-pill"><Video size={17} /><span>{meeting ? `剩余 ${formatRemaining(remaining)}` : '局域网会议'}</span><i /></div>
    </section>

    <section className="meeting-layout">
      <article className="meeting-control blue-card">
        <header><Video size={20} /><div><p className="eyebrow">JOIN ROOM</p><h2>创建或加入房间</h2></div></header>
        <label>会议房间名<input value={room} onChange={(event) => setRoom(event.target.value)} maxLength={64} spellCheck={false} placeholder={suggestedRoom} /></label>
        <p className="meeting-field-help">建议使用团队前缀；仅支持字母、数字、下划线和连字符。</p>
        <div className="meeting-origin"><small>局域网会议地址</small><strong>{settings?.meetingOrigin || '尚未配置'}</strong></div>
        <button className="meeting-settings-button" onClick={onOpenSettings}><Settings2 size={16} />配置本机会议地址</button>
        <button className="meeting-invite-button" disabled={!settings?.meetingOrigin} onClick={() => void copyInvitation()}><Clipboard size={16} />复制邀请</button>
        <button className="profile-save meeting-join-button" disabled={joining || !settings?.meetingOrigin} onClick={() => void join()}>
          {joining ? '正在取得令牌…' : meeting ? '重新取得会议令牌' : '安全入会'} <KeyRound size={16} />
        </button>
        <p className="meeting-security-note">只允许已配置的 HTTPS 局域网主机请求摄像头和麦克风权限；其他网页默认拒绝。</p>
      </article>

      <article ref={stageRef} className={`meeting-stage blue-card ${meetingUrl ? 'meeting-connected' : ''} ${theater ? 'meeting-theater' : ''}`}>
        {meetingUrl && meeting ? <>
          <header><div><p className="eyebrow">IN MEETING</p><h2>{meeting.room}</h2></div><span><Clock3 size={14} />令牌剩余 {formatRemaining(remaining)}</span><button className="meeting-theater-button" title={theater ? '还原窗口大小' : '全屏显示会议画面'} onClick={toggleTheater}>{theater ? <Minimize2 size={16} /> : <Maximize2 size={16} />}{theater ? '还原' : '全屏'}</button></header>
          <iframe
            key={meetingUrl}
            className="meeting-frame"
            title={`LecPunch 视频会议：${meeting.room}`}
            src={meetingUrl}
            allow="camera; microphone; display-capture; fullscreen"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            referrerPolicy="no-referrer"
          />
          <p>若令牌到期，请点击左侧“重新取得会议令牌”。会议内外链将由系统浏览器打开。</p>
        </> : <div className="meeting-empty"><VideoOff size={35} /><h2>{isAdminPreviewSession() ? '会议演示模式' : '尚未进入会议'}</h2><p>{isAdminPreviewSession() ? '本地预览不会请求服务器或加载会议页面。' : '填写房间名并取得短时令牌后，会议将在此处内嵌打开。'}</p>{settings?.meetingOrigin ? <button onClick={() => void join()} disabled={joining}>{joining ? '正在连接…' : '加入当前房间'} <RefreshCw size={15} /></button> : null}</div>}
      </article>
    </section>
  </div>;
};
