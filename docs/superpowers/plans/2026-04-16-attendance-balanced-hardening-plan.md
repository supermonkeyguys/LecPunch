# 打卡平衡版防挂卡改造计划（2026-04-16）

## 背景

当前仓库的原始打卡模型以“连续自然时间”为中心：

- `check-in` 创建 `active session`
- `check-out` 直接按 `checkOutAt - checkInAt` 结算
- 周统计按最终 `durationSeconds` 聚合

这套模型的核心问题不是某个具体脚本，而是业务真相定义本身过宽：

- 只要用户成功上卡，后续时间默认有效
- 服务端无法区分“真实持续出勤”与“页面被动挂着”
- 一旦上卡成功，即使用户离开允许网络、关闭页面、切后台或挂着无关脚本，仍然存在被错误累计的空间

2026-04-16 已先落一版止血修复：

- 增加 `keepalive`
- 活跃 session 超过阈值未续期则失效
- 失效原因记录为 `heartbeat_timeout`

这版能阻断“上卡后完全不管仍继续涨时长”的最低成本漏洞，但它仍然围绕“连续自然时间”做补丁，不是最终模型。

## 本次计划目标

本次计划采用“平衡版”方案，目标是：

- 不再让自然时间自动变成有效时长
- 改为服务端按时间切片累计有效时长
- 失联、断网、不可见或长时间无有效续期时停止累计，而不是继续白涨
- 在防止恶意挂卡的同时，尽量降低对正常用户的误伤

一句话定义：

> `check-in` 只代表开始一个会话，不代表后续自然时间自动有效；只有通过服务端校验的时间片才计入有效打卡时长。

## 方案定位

本次采用：

- 分段记账
- 服务端持有 `creditedSeconds`
- 前端周期性 `keepalive`
- `keepalive` 时服务端重验网络与会话状态
- 失联后暂停累计，不补记中断区间

本次不做：

- “证明用户一定在认真学习”的强认证
- 全量启用验证码 / 随机挑战
- 原生客户端或设备指纹方案
- 复杂风险分系统

## 为什么采用平衡版

和现有“连续时间结算”相比，平衡版有三点本质差异：

### 1. 结算口径变更

旧口径：

- `durationSeconds = checkOutAt - checkInAt`

新口径：

- `durationSeconds = creditedSeconds`
- `creditedSeconds` 仅来自已通过校验的有效时间片

### 2. 中断行为变更

旧口径：

- 只要最终能下卡，整段自然时间都可能被纳入

新口径：

- `keepalive` 中断、网络不合法或会话状态异常时，停止累计
- 恢复后可以继续累计，但中断区间不补记

### 3. 正常用户容错更好

止血版会更偏“硬失效”。

平衡版的目标是：

- 临时断网、浏览器挂起、短暂切后台不会让整场记录清零
- 但这些时段不会继续涨有效时长

## 核心业务规则

### 1. 上卡

前置条件：

- 已登录
- 用户状态正常
- 当前无 `active` 会话
- 当前网络命中允许范围

动作：

- 创建 `attendance_session`
- 初始化：
  - `status = active`
  - `checkInAt = now`
  - `lastKeepaliveAt = now`
  - `creditedSeconds = 0`
  - `lastCreditedAt = now`

### 2. Keepalive

建议默认：

- 每 `30s` 发送一次

服务端每次 `keepalive` 需要校验：

- 当前 session 仍是 `active`
- 当前网络仍然允许
- 未超单次最大时长
- 距上次有效 keepalive 未超过会话超时阈值

若校验通过：

- 更新 `lastKeepaliveAt`
- 根据当前时间与 `lastCreditedAt` 之间的有效区间，为 `creditedSeconds` 增量记账
- 更新 `lastCreditedAt`

若校验失败：

- 不增加 `creditedSeconds`
- 按失败类型做“暂停累计”或“会话结束”

### 3. 中断

本计划建议区分“暂停累计”和“作废”。

#### 暂停累计

适用于：

- keepalive 超时
- 前端离线
- 页面挂起
- 网络短时不满足要求

效果：

- session 不自动补记中断时段
- 恢复后可以继续累计

#### 作废

适用于：

- 单次会话累计自然时长超 5 小时
- 明确命中的业务失效规则

效果：

- `status = invalidated`
- `durationSeconds = 0`
- `invalidReason = overtime_5h`

### 4. 下卡

下卡时：

- 重验网络
- 若当前 session 仍可正常结束，则将 `durationSeconds = creditedSeconds`
- `checkOutAt = now`
- `status = completed`

结论：

- 最终展示与统计基于 `creditedSeconds`
- 不再直接依赖 `checkOutAt - checkInAt`

## 数据模型改造

## 现状

当前 `attendance_sessions` 已有：

- `checkInAt`
- `checkOutAt`
- `durationSeconds`
- `status`
- `invalidReason`
- `lastKeepaliveAt`

## 建议新增字段

在 `attendance_sessions` 上新增：

- `creditedSeconds: number`
- `lastCreditedAt?: Date`
- `pausedAt?: Date`
- `pauseReason?: 'heartbeat_timeout' | 'network_not_allowed' | 'client_offline'`
- `segmentsCount?: number`

字段说明：

- `creditedSeconds`
  - 当前 session 已被服务端认可的有效时长
- `lastCreditedAt`
  - 最近一次完成切片记账的时间
- `pausedAt`
  - 当前累计暂停的开始时间
- `pauseReason`
  - 暂停原因，便于审计与运营查看
- `segmentsCount`
  - 已成功记账的时间片数量，便于风控分析

## 现有字段处理

- `durationSeconds`
  - 改为“最终持久化有效时长”
  - 只在 `completed` / `invalidated` 终态写入
- `lastKeepaliveAt`
  - 保留，用于判定 session 是否持续在线

## 是否需要新集合

首轮不建议增加独立 `attendance_segments` 集合。

理由：

- 当前目标是修正记账真相，不是做全量审计日志平台
- 以 `creditedSeconds + lastCreditedAt + pausedAt` 即可支撑首轮闭环
- 保持改造面适中，避免多表一致性复杂度

后续若需要更强审计，再考虑单独引入 `attendance_segments` 或事件日志表。

## API 改造

## 保留接口

- `GET /attendance/current`
- `POST /attendance/check-in`
- `POST /attendance/check-out`
- `POST /attendance/keepalive`

## 返回字段调整

### `GET /attendance/current`

新增返回：

- `creditedSeconds`
- `lastKeepaliveAt`
- `pauseReason?`
- `isPaused?`

说明：

- 前端当前展示的“实时累计”应基于：
  - 已持久化的 `creditedSeconds`
  - 以及仅在当前活跃切片中允许乐观展示的少量秒数

### `POST /attendance/check-out`

返回：

- `status`
- `invalidReason?`
- `durationSeconds`

注意：

- 这里的 `durationSeconds` 不再等于自然时间差，而是最终有效累计

## Keepalive 契约

建议 `keepalive` 返回精简但稳定的状态：

- `status`
- `creditedSeconds`
- `lastKeepaliveAt`
- `isPaused`
- `pauseReason?`

前端据此决定：

- 是否继续本地展示递增
- 是否显示“已暂停累计”
- 是否提示用户恢复网络 / 返回页面

## 前端改造

### 1. 工作台展示口径调整

当前工作台的实时计时更接近“自然经过时长”。

改造后应拆成两个概念：

- `creditedDuration`
  - 已被服务端认可的有效时长
- `liveSliceDuration`
  - 当前有效切片内，允许本地按秒乐观显示的部分

最终展示：

- `displayDuration = creditedDuration + liveSliceDuration`

一旦 session 进入暂停：

- 停止本地递增
- 展示“当前暂停累计”提示

### 2. Keepalive 行为

前端继续每 30 秒发 `keepalive`，但语义从“保活会话”改为“续记账”。

需要新增处理：

- keepalive 成功：
  - 同步最新 `creditedSeconds`
- keepalive 返回暂停：
  - 停止本地递增
  - 提示用户当前不再累计
- keepalive 恢复：
  - 从最新 `creditedSeconds` 重新开始当前切片显示

### 3. 记录页与统计页

记录页无需大改结构，但要明确：

- `durationSeconds` 是有效时长
- 不是自然挂卡时长

若后续要加强可解释性，可在成员记录详情补充：

- 自然时长
- 有效时长
- 暂停原因

本计划首轮不强制增加该 UI。

## 后端实现策略

## 服务端真相

必须保持：

- 是否累计由后端决定
- 当前网络是否合法由后端决定
- 当前会话是否暂停由后端决定
- 周统计只信任服务端持久化的有效时长

## 切片记账方式

建议首轮采用：

- 固定切片 `30s`
- 每次 `keepalive` 计算自 `lastCreditedAt` 以来可确认的有效区间

保守原则：

- 不追求“每秒精确”
- 追求“规则稳定、难以白嫖”

换句话说：

- 宁可少记边缘秒数，也不要多记未经校验的时长

## 状态机建议

建议引入比当前更明确的会话语义：

- `active`
- `paused`
- `completed`
- `invalidated`

如果不想扩展 `status` 枚举，也至少要在 `active + pauseReason` 上表达“当前不累计”。

从交接和可维护性角度，我更推荐直接扩展 `status`，但这会影响现有 shared 契约和部分前端判断。

首轮可二选一：

### 方案 A. 扩展 `status`

优点：

- 语义清晰
- 后续风控更好扩展

缺点：

- 改动面更大

### 方案 B. 保持 `status` 不变，新增 `isPaused`

优点：

- 与当前实现兼容更强

缺点：

- 语义没有单独状态清晰

本计划建议：

- Phase 1 先采用 `isPaused / pauseReason`
- Phase 2 再判断是否需要升级为独立 `paused` 状态

## 统计改造

当前统计服务按 `durationSeconds` 聚合。

改造后要求：

- 只有终态 session 的 `durationSeconds` 参与周统计
- `durationSeconds` 的来源必须是 `creditedSeconds`
- 不允许任何地方再以 `checkOutAt - checkInAt` 回推有效时长

额外要求：

- 风控或审计页面若需要自然时长，应单独计算，不进入业务统计真值

## 迁移与兼容策略

## 已有历史数据

历史 session 只有：

- `checkInAt`
- `checkOutAt`
- `durationSeconds`

没有切片信息，因此无法精确回溯历史有效时长。

本计划建议：

- 老数据原样保留
- 新规则只对新产生的 session 生效
- 不尝试“回算历史 session 的 creditedSeconds”

兼容策略：

- 历史记录页照常显示已有 `durationSeconds`
- 新 session 采用新模型

## 灰度方式

建议加环境开关：

- `ATTENDANCE_BALANCED_ACCOUNTING_ENABLED=true|false`

用途：

- 先在测试环境验证
- 再在生产灰度启用
- 必要时可快速回退到止血版

## 分阶段执行计划

## Phase 1. 共享契约与模型准备

- 扩展 shared attendance 类型
- 增加 `creditedSeconds` / `pauseReason` 等字段
- 明确前后端契约文案

验证：

- typecheck 通过
- 共享契约测试通过

## Phase 2. 后端记账真相改造

- 重构 `attendance.service`
- 引入切片累计逻辑
- `check-out` 改为结算 `creditedSeconds`
- 周统计继续使用终态 `durationSeconds`

验证：

- service 测试覆盖：
  - 正常累计
  - keepalive 丢失后停止累计
  - 网络不允许后停止累计
  - 恢复后继续累计
  - 超 5 小时仍作废

## Phase 3. 前端工作台改造

- 工作台显示口径切换到 `creditedSeconds`
- keepalive 成功后同步服务端累计
- 暂停累计时停止本地递增并展示明确提示

验证：

- DashboardPage 测试覆盖：
  - 正常累计显示
  - 暂停提示
  - 恢复后继续
  - 下卡结果与有效时长一致

## Phase 4. 记录与统计语义收口

- 复查 records / stats / member-records 页面文案
- 确保不会误导为“自然在线时长”

验证：

- 记录页、周统计页相关测试通过

## Phase 5. 灰度与交接

- 增加配置说明
- 更新运维说明
- 更新产品口径说明

验证：

- 本地 typecheck
- 关键 API / web 测试
- 手工走查上卡、暂停、恢复、下卡流程

## 风险与权衡

### 1. 仍不能绝对证明“人在现场”

平衡版能阻断“挂着就白涨”，但不能完全防住高级自动化。

它解决的是：

- 无成本挂机
- 低成本恶意挂卡

它不解决：

- 高级浏览器自动化
- 远程控制合法网络环境内的机器

### 2. 切片边缘损耗

因为采用保守记账，切片边界可能少记少量秒数。

这是可接受权衡，优先级高于“绝不漏一秒”。

### 3. 状态复杂度上升

从简单的“active / completed / invalidated”走向“累计中 / 暂停中 / 结束”，会让代码和前端状态判断更复杂。

需要用测试把状态流转锁住。

## 验收标准

满足以下条件即可视为平衡版首轮完成：

- `check-out` 最终有效时长不再直接等于 `checkOutAt - checkInAt`
- 只有通过服务端校验的时间片会进入有效累计
- keepalive 中断或网络不合法时，session 停止累计
- 恢复后允许继续累计，但中断区间不补记
- 统计结果与记录页展示均基于有效时长
- 当前前后端类型、接口与核心测试保持一致

## 推荐执行顺序

1. 先锁 shared 契约与 session 字段
2. 再改后端记账真相
3. 然后改工作台显示和 keepalive 消费
4. 最后收口 records / stats 语义

## 交接说明

当前仓库状态可作为本计划起点：

- 止血版 keepalive 已存在
- 活跃 session 超时可失效
- 当前 commit 基线可参考 `fix(attendance): expire stale active sessions`

后续实现者应将这版视为“短期防护层”，而不是最终记账模型。

下一步真正要完成的不是“进一步强化连续计时”，而是：

> 把有效时长的业务真相从“自然经过时间”切换为“服务端认可的分段累计时间”。
