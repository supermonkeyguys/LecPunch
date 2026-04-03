# LecPunch 打卡系统技术方案设计

- 日期：2026-03-31
- 项目：LecPunch
- 范围：纯 Web 首版、成员端先行、同仓 Monorepo、后续可扩展后台能力

## 1. 目标与边界

### 1.1 当前目标
首版建设一个纯 Web 打卡系统，当前以成员端为先，满足以下核心闭环：

- 普通登录
- 上卡 / 下卡
- 查看自己的每次打卡记录
- 查看他人的每次打卡记录
- 查看个人按周历史统计
- 查看团队成员本周累计时长
- 每周自然周重计数
- 仅允许处于团队指定网络环境内的用户打卡

### 1.2 已确认约束

- 首版是纯 Web，不接入微信场景、不做 PWA
- 同一个 Web 项目承载成员端与未来管理员端
- 当前只做一个团队，但数据模型预留 `teamId`
- 当前采用普通登录，后续再接入更完整的身份验证体系
- 当前是全员可见：同团队成员都可以查看全团队所有成员的打卡记录
- 打卡规则中的“必须连接团队 WiFi”在纯 Web 首版中，技术落地为“必须处于团队 WiFi 对应的固定网络环境中”
- 团队网络环境相对固定，可通过出口 IP / 内网网段识别
- 每周统计按 `Asia/Shanghai` 时区下的自然周计算：周一 00:00:00 到周日 23:59:59

### 1.3 不在首版实现

- 多团队能力
- 完整管理员后台页面
- 补卡申诉
- 请假系统
- 导出 Excel
- 推送提醒
- 离线容错同步
- 排行榜和游戏化扩展

---

## 2. 总体技术选型

### 2.1 Monorepo
采用 **Monorepo + Turbo** 管理整个仓库。

建议工作区：

- 包管理器：`pnpm`
- 任务编排：`turbo`

目录建议：

```txt
LecPunch/
├─ apps/
│  ├─ web/
│  └─ api/
├─ packages/
│  ├─ ui/
│  ├─ shared/
│  ├─ eslint-config/
│  └─ tsconfig/
├─ docs/
│  └─ superpowers/
│     └─ specs/
├─ prd.md
├─ UI.md
├─ turbo.json
├─ package.json
└─ pnpm-workspace.yaml
```

### 2.2 前端技术栈

- React
- React Router
- Zustand
- ahooks
- Axios
- Tailwind CSS
- Radix UI
- class-variance-authority
- lucide-react
- react-hook-form
- zod

选型原则：

- 采用 headless 思路构建组件体系
- UI 与数据逻辑分离
- 页面可编排、组件可复用、业务逻辑可迁移
- 为后续同一应用内加入后台路由预留空间

### 2.3 后端技术栈

- NestJS
- TypeScript
- MongoDB

选型原则：

- 业务规则集中在服务端
- 模块按领域拆分
- 统计基于明细聚合，避免过早引入物化表

---

## 3. 总体架构原则

### 3.1 前后端职责边界

#### 前端负责

- 页面与路由组织
- 用户交互
- 组件展示
- 会话级 UI 状态管理
- 接口调用与结果呈现

#### 后端负责

- 登录认证
- 打卡状态机
- 5 小时作废规则
- 网络白名单校验
- 周统计聚合
- 数据权限控制

### 3.2 真值原则

以下信息以后端为绝对真相：

- 当前是否正在打卡
- 当前 session 的真实状态
- 某条打卡记录是否作废
- 某次请求是否允许打卡
- 某用户 / 团队的周统计结果

前端只做展示与交互编排，不做领域真值裁决。

### 3.3 共享包边界

`packages/shared` 仅放前后端共享的稳定共识：

- 领域类型
- 枚举
- 常量
- 轻量 schema / DTO 基础定义

不放：

- 前端 hooks
- 后端 service 实现
- 与具体框架强绑定的业务实现

---

## 4. Monorepo 包与应用设计

### 4.1 apps/web
职责：

- 登录页
- 成员首页
- 打卡交互
- 历史记录查询
- 成员查看
- 周历史统计
- 后续后台路由区

不负责：

- 打卡合法性最终判定
- 网络白名单判定
- 5 小时超时规则判定
- 跨团队权限判定

### 4.2 apps/api
职责：

- 登录认证
- 当前用户信息
- 打卡 session 生命周期管理
- 网络环境校验
- 周统计聚合
- 明细记录查询
- 后续后台接口

### 4.3 packages/ui
职责：

- 设计 Token
- Button / Card / Dialog / Table / Badge / Empty / StatCard
- Layout 壳
- 通用表单外观组件

要求：

- 纯前端 UI 复用
- 不耦合业务请求
- 不直接依赖具体业务状态

### 4.4 packages/shared
职责：

- 类型：`User`、`AttendanceSession`、`WeeklyStat`
- 枚举：`UserRole`、`AttendanceStatus`、`InvalidReason`
- 常量：打卡时长阈值、默认分页参数、week key 规则约定

---

## 5. 前端架构设计

前端采用以下分层：

```txt
apps/web/src/
├─ app/
├─ pages/
├─ widgets/
├─ features/
├─ entities/
└─ shared/
```

### 5.1 app
负责：

- 路由注册
- Provider 装配
- Zustand store 初始化
- Axios 实例挂载
- 全局样式与主题

### 5.2 pages
负责页面级编排，只描述“页面由哪些区块组成”。

建议页面：

- `login-page`
- `dashboard-page`
- `records-page`
- `members-page`
- `member-records-page`
- `weekly-history-page`

### 5.3 widgets
负责页面中的大区块拼装，例如：

- `dashboard-checkin-panel`
- `dashboard-week-summary`
- `members-ranking-panel`
- `records-table-panel`

### 5.4 features
负责业务动作与业务组件，是前端业务逻辑核心层。

建议按领域拆：

- `auth/login`
- `attendance/check-in`
- `attendance/check-out`
- `attendance/current-session`
- `records/list-records`
- `stats/query-weekly`
- `members/view-member-records`

该层包含：

- 请求调用
- 业务 hooks
- 与 store 的连接
- 面向页面使用的业务组件

### 5.5 entities
负责稳定领域对象与其展示单元，例如：

- `user`
- `attendance-session`
- `weekly-stat`

可包含：

- `UserAvatar`
- `AttendanceStatusBadge`
- `WeeklyStatCard`

### 5.6 shared
负责无业务语义的公共能力：

- `ui`
- `lib`
- `hooks`
- `constants`
- `http`

### 5.7 Zustand 使用边界
适合放入 Zustand 的状态：

- 当前用户基础信息
- token
- 当前 UI 筛选项
- 当前查看中的成员
- 局部页面会话态

不适合放入 Zustand 的状态：

- 全量打卡记录真值
- 周统计真值
- 强一致业务数据

这些应通过接口查询获取。

---

## 6. 后端架构设计

建议 NestJS 模块按领域划分：

```txt
apps/api/src/
├─ modules/
│  ├─ auth/
│  ├─ users/
│  ├─ teams/
│  ├─ attendance/
│  ├─ records/
│  ├─ stats/
│  └─ network-policy/
├─ common/
├─ database/
└─ main.ts
```

### 6.1 auth
负责：

- 普通登录
- JWT 签发与校验
- 当前用户信息
- 后续身份体系扩展点

### 6.2 users
负责：

- 用户资料
- 用户角色
- 团队归属

### 6.3 teams
负责：

- 当前团队信息
- 未来多团队扩展
- 团队与 network policy 的关联

### 6.4 attendance
负责：

- 上卡
- 下卡
- 当前进行中的 session
- 5 小时失效规则
- 打卡状态机

### 6.5 records
负责：

- 单次打卡记录查询
- 个人 / 他人流水查询
- 分页、筛选、排序

### 6.6 stats
负责：

- 周统计
- 团队成员本周汇总
- 个人历史周统计

### 6.7 network-policy
负责：

- 网络白名单
- IP / CIDR 命中判断
- 代理头信任规则
- 打卡前网络环境校验

---

## 7. MongoDB 数据模型设计

虽然当前只有一个团队，但所有核心数据模型均保留 `teamId`。

### 7.1 users

```ts
{
  _id: ObjectId,
  teamId: ObjectId,
  username: string,
  passwordHash: string,
  displayName: string,
  phone?: string,
  role: 'member' | 'admin',
  status: 'active' | 'disabled',
  createdAt: Date,
  updatedAt: Date
}
```

### 7.2 teams

```ts
{
  _id: ObjectId,
  name: string,
  status: 'active' | 'inactive',
  createdAt: Date,
  updatedAt: Date
}
```

### 7.3 network_policies

```ts
{
  _id: ObjectId,
  teamId: ObjectId,
  allowPublicIps: string[],
  allowCidrs: string[],
  trustProxy: boolean,
  trustedProxyHops?: number,
  description?: string,
  createdAt: Date,
  updatedAt: Date
}
```

### 7.4 attendance_sessions

```ts
{
  _id: ObjectId,
  teamId: ObjectId,
  userId: ObjectId,
  checkInAt: Date,
  checkOutAt?: Date,
  durationSeconds?: number,
  status: 'active' | 'completed' | 'invalidated',
  invalidReason?: 'overtime_5h',
  sourceIpAtCheckIn: string,
  sourceIpAtCheckOut?: string,
  weekKey: string,
  createdAt: Date,
  updatedAt: Date
}
```

### 7.5 为什么首版不建 weekly_stats
首版周统计建议直接从 `attendance_sessions` 聚合，不单独建立 `weekly_stats` 持久化表。

原因：

- 当前数据量较小
- 业务规则仍可能变化
- 避免过早引入双写一致性问题
- 明细是真相，统计是派生结果

后续如需优化，可再增加：

- 周统计物化表
- 定时预聚合
- 缓存层

### 7.6 索引建议

`attendance_sessions`：

- `{ userId: 1, status: 1 }`
- `{ teamId: 1, weekKey: 1, userId: 1 }`
- `{ userId: 1, checkInAt: -1 }`
- `{ teamId: 1, checkInAt: -1 }`

`users`：

- `{ username: 1 }` unique
- `{ teamId: 1, role: 1 }`

---

## 8. 打卡核心规则设计

### 8.1 上卡
前置条件：

- 已登录
- 用户状态正常
- 当前无 active session
- 当前请求网络命中团队白名单

动作：

- 创建 `attendance_session`
- 状态设为 `active`

### 8.2 下卡
前置条件：

- 当前存在 active session
- 当前请求网络命中团队白名单

动作：

- 计算时长
- 若 `durationSeconds >= 18000`：
  - `status = invalidated`
  - `durationSeconds = 0`
  - `invalidReason = overtime_5h`
- 否则：
  - `status = completed`
  - 保存实际时长

### 8.3 周统计规则

- 统计口径：`Asia/Shanghai`
- 周定义：自然周
- 周区间：周一 00:00:00 到周日 23:59:59
- 前后端统一使用服务端生成的 `weekKey`

---

## 9. “团队 WiFi 才能打卡”的 Web 落地方案

### 9.1 产品规则
产品规则仍然定义为：

> 只有连接团队内指定 WiFi 的用户，才能上卡 / 下卡。

### 9.2 纯 Web 技术限制
纯 Web 浏览器无法直接读取用户当前连接的 SSID / BSSID，因此首版不能直接通过浏览器获取 WiFi 名称来判断。

### 9.3 首版技术实现
首版将该规则技术落地为：

> 只有处于团队 WiFi 对应的固定网络环境中的请求，才允许打卡。

即后端根据固定网络环境白名单做准入校验。

### 9.4 校验流程
在 `check-in` / `check-out` 时：

1. 服务端解析客户端来源 IP
2. 根据 `trustProxy` 决定是否读取代理头
3. 判断是否命中：
   - `allowPublicIps`
   - `allowCidrs`
4. 命中则允许打卡
5. 不命中则拒绝

### 9.5 安全要求

- 不将网络判定逻辑下放到前端
- 不盲目信任客户端伪造 header
- 若使用反向代理，仅信任己方控制的代理链

### 9.6 前端表现
前端只在接口返回网络不允许时提示：

- “当前未连接团队指定网络，无法打卡”

---

## 10. API 契约设计

### 10.1 auth

#### `POST /auth/login`
输入：

```ts
{
  username: string
  password: string
}
```

输出：

```ts
{
  accessToken: string
  user: {
    id: string
    displayName: string
    role: 'member' | 'admin'
    teamId: string
  }
}
```

#### `GET /auth/me`
用于刷新登录态与拉取当前用户信息。

### 10.2 attendance

#### `GET /attendance/current`

```ts
{
  hasActiveSession: boolean,
  session: null | {
    id: string,
    checkInAt: string,
    elapsedSeconds: number
  }
}
```

#### `POST /attendance/check-in`

```ts
{
  sessionId: string,
  checkInAt: string
}
```

#### `POST /attendance/check-out`

```ts
{
  sessionId: string,
  checkInAt: string,
  checkOutAt: string,
  durationSeconds: number,
  status: 'completed' | 'invalidated',
  invalidReason?: 'overtime_5h'
}
```

### 10.3 records

#### `GET /records/me`
参数：

- `weekKey?`
- `page`
- `pageSize`

#### `GET /records/member/:userId`
参数同上。首版允许同团队成员查询。

### 10.4 stats

#### `GET /stats/me/weekly`
返回当前用户的周历史统计。

#### `GET /stats/team/current-week`
返回团队本周成员累计列表。

#### `GET /stats/member/:userId/weekly`
返回某成员的历史周统计。

### 10.5 records 与 stats 分离原则

- `records` 查询明细流水
- `stats` 查询聚合结果

这样查询职责更清晰，前后端都更稳定。

---

## 11. 错误处理设计

建议统一业务错误码：

- `AUTH_INVALID_CREDENTIALS`
- `AUTH_UNAUTHORIZED`
- `ATTENDANCE_ALREADY_CHECKED_IN`
- `ATTENDANCE_NO_ACTIVE_SESSION`
- `ATTENDANCE_NETWORK_NOT_ALLOWED`
- `ATTENDANCE_SESSION_INVALIDATED`
- `ATTENDANCE_CROSS_TEAM_FORBIDDEN`
- `USER_DISABLED`

建议响应格式：

```ts
{
  code: string,
  message: string,
  details?: unknown
}
```

这样前端可以按错误码精确处理，而不是依赖 message 文案解析。

---

## 12. 前端请求层设计

### 12.1 Axios 基础层
统一放在 `shared/http`：

- request interceptor：注入 token
- response interceptor：统一处理 401、统一提取业务错误码

### 12.2 API 按领域拆分

- `auth.api.ts`
- `attendance.api.ts`
- `records.api.ts`
- `stats.api.ts`

### 12.3 业务 hooks
建议放在 `features/*/model` 或 `features/*/api`：

- `useCurrentSession`
- `useCheckIn`
- `useCheckOut`
- `useMyRecords`
- `useMemberRecords`
- `useTeamWeeklyStats`

---

## 13. 页面与路由建议

首版成员端建议路由：

- `/login`
- `/dashboard`
- `/records`
- `/members`
- `/members/:userId/records`
- `/weekly-history`

### 页面职责建议

#### Dashboard

- 当前打卡状态
- 上卡 / 下卡
- 本周累计
- 当前 session 时长展示

#### Records

- 查看自己的单次打卡记录

#### Members

- 查看团队成员本周累计列表

#### Member Records

- 查看指定成员的单次打卡记录

#### Weekly History

- 查看自己的按周历史统计

后续后台能力可通过 `/admin/*` 扩展进同一应用。

---

## 14. 权限与安全边界

虽然首版为单团队 + 全员可见，但后端仍需保留基础限制：

- 成员只能查看同 `teamId` 的数据
- 不能因传入任意 `userId` 而越权
- token 中至少包含：
  - `userId`
  - `teamId`
  - `role`

---

## 15. 测试策略

### 15.1 后端优先测试业务真值
后端必须优先覆盖核心业务规则。

必测用例：

1. 上卡成功
2. 重复上卡被拒绝
3. 下卡成功
4. 超 5 小时自动作废
5. 非允许网络禁止打卡
6. 同团队可查他人记录，跨团队禁止
7. 周统计按自然周 + Asia/Shanghai 正确计算

建议工具：

- Nest Testing
- Jest

### 15.2 前端关键交互测试
首版前端测试聚焦关键路径：

1. 登录态路由保护
2. 打卡按钮状态切换
3. 当前打卡计时展示
4. 记录页列表渲染
5. 成员页跳转成员详情
6. 网络受限错误提示

建议工具：

- Vitest
- React Testing Library

### 15.3 E2E 策略
首版可暂缓完整 E2E，优先确保单元测试与模块测试覆盖核心规则。后续再补 Playwright。

---

## 16. 实施迭代顺序

建议按“能力闭环”推进，而不是按页面堆叠推进。

### Phase 1：基础工程

- 搭建 Monorepo + Turbo
- 初始化 `apps/web` / `apps/api`
- 初始化 `packages/ui` / `packages/shared`
- 配置 ESLint / TSConfig / 基础脚本
- 接通 React Router / Tailwind / Zustand / Axios / Nest / Mongo

### Phase 2：认证与基础骨架

- 登录接口
- JWT
- 登录页
- 路由守卫
- 主布局框架

### Phase 3：打卡核心闭环

- `attendance` + `network-policy`
- 上卡 / 下卡
- 当前状态查询
- 5 小时作废规则
- Dashboard 可用

### Phase 4：记录与成员查看

- 我的记录
- 团队成员本周累计列表
- 查看成员记录
- 同团队权限限制

### Phase 5：周统计

- 我的周历史
- 团队本周累计
- 成员周历史
- 周切换展示

### Phase 6：后台预留能力

- 路由分区
- role 模型
- network policy 管理入口预留
- 用户管理入口预留

---

## 17. 首版 MVP 结论

### 17.1 首版必须实现

- 普通登录
- Dashboard 上卡 / 下卡
- 当前打卡状态查询
- 5 小时作废规则
- 团队网络白名单校验
- 我的记录
- 全员记录可见
- 团队本周累计
- 个人周历史

### 17.2 首版推荐方案总结

- Monorepo：Turbo + pnpm
- 前端：React + React Router + Zustand + Axios + ahooks + Tailwind + Radix UI
- 后端：NestJS + MongoDB
- 架构：单 Web 应用承载成员端 / 后续后台，前端按 `app / pages / widgets / features / entities / shared` 分层
- 业务真值：以后端为准
- 网络限制：后端通过固定 IP / CIDR 白名单实现“团队 WiFi 才能打卡”的纯 Web 落地
- 数据策略：单团队实现，模型保留 `teamId`

### 17.3 方案价值

该方案既能尽快支撑成员端 MVP 落地，也为后续后台、身份验证、多团队扩展保留了演进空间；同时满足 UI 与数据逻辑分离、便于 AI 交接与持续协作的要求。
