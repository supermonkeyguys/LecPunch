# MC-1 队长机局域网会场：方案包

状态：**本机初始化与单机安全检查已通过；尚待 MC-2 签发端部署后的双设备音视频联测。**

## 范围

- 会场机：当届队长 Windows + Docker Desktop 主机。
- 会议网页与音视频：仅在队长机局域网 IP 上提供服务。
- 认证：Jitsi JWT，使用独立的 `MEET_JWT_SECRET`。
- 不包含：LecPunch API 路由、Electron 页面、服务器部署、真实 `.env`、证书与任何密钥。

## 文件清单

| 文件 | 用途 |
| --- | --- |
| `compose.lan.override.yml` | 使用 Compose `!override` 完整替换官方端口映射，只保留队长机 LAN IP 的两项端口。 |
| `.env.example` | 非敏感变量模板；真实 `.env` 被 Git 忽略。 |
| `.gitignore` | 独立忽略真实 `.env`、证书、下载的上游文件与运行目录，交接包脱离主仓库时仍有效。 |
| `scripts/Initialize-LanMeet.ps1` | 下载固定官方版本、生成本地配置与密钥占位、生成证书、建立防火墙规则。 |
| `scripts/Start-LanMeet.ps1` | 以官方 compose + LAN 覆盖启动/停止会场。 |
| `scripts/Test-LanMeet.ps1` | 本机暴露面、容器状态与端口绑定检查。 |
| `templates/custom-config.js` | 禁用 P2P 与分析类前端配置。 |
| `docs/*` | 交接、端口/防火墙和双设备验收说明。 |

## 安全裁决

1. **禁止**把 `AUTH_SECRET` 写入队长机；仅使用独立 `MEET_JWT_SECRET`。
2. `MEET_JWT_SECRET` 泄露只影响会议准入；轮换不影响 LecPunch 登录态。
3. 会议媒体端口只绑定 `LAN_BIND_IP`：HTTPS `8443/TCP`、JVB `10000/UDP`。
4. 不启用 TURN、STUN、P2P、录制、直播、JaaS、rtcstats、Sentry 或 tracing。
5. 本地 CA/证书、`.env`、下载的 Jitsi 上游文件和运行数据均不入库。

## MC-2 对接契约

| 事项 | 已确认设计 |
| --- | --- |
| 环境变量 | 新增 `MEET_JWT_APP_ID` 与 `MEET_JWT_SECRET`，并拒绝后者与 `AUTH_SECRET` 相同。 |
| 路由 | `GET /meet/token?room=<name>`，认证成员可用，零存储。 |
| 有效期 | `exp - iat <= 5 分钟`。 |
| 房间 | `room` 必须等于请求的经校验房间名。 |
| JWT 声明 | `iss`、`aud` 与 `sub` 都等于 `MEET_JWT_APP_ID`（当前为 `lecpunch-lan-meet`）；成员 ID 仅置于 `context.user.id`。 |

> 签发端与队长机必须使用相同的 `MEET_JWT_APP_ID` 与 `MEET_JWT_SECRET`；真实密钥只能由队长本人通过受控渠道同步，不进入源码、审计包或对话记录。
