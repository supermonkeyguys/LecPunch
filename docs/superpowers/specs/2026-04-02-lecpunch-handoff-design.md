---
name: lecpunch-handoff-design-2026-04-02
description: Concise handoff spec consolidating the agreed V1 scope and immediate execution order for LecPunch MVP delivery.
type: project
---

# LecPunch 执行交接设计（2026-04-02）

## 1. 目的

这份文档不是重新设计产品，而是把已经确认的架构结论与最近执行计划收敛成一份可直接开工的交接说明，降低后续实现时反复在多份文档之间切换的成本。

最终仍以以下文档为上位约束：

- `docs/superpowers/specs/2026-03-31-lecpunch-architecture-design.md`
- `CLAUDE.md`

如本文件与上位文档冲突，以上位文档为准。

---

## 2. 当前确认范围

### 2.1 V1 必做

V1 是纯 Web MVP，优先完成成员端闭环：

- 用户名/密码登录
- 上卡 / 下卡
- 查看当前打卡状态
- 查看自己的打卡记录
- 查看同团队成员的打卡记录
- 查看个人周统计
- 查看团队成员本周累计
- 5 小时自动作废规则
- 基于后端 IP / CIDR allowlist 的网络限制

### 2.2 V1 暂不做

以下内容明确不进入当前实现范围：

- 多团队能力落地
- 管理后台完整功能
- 补卡申请
- 请假系统
- Excel 导出
- 推送通知
- 离线同步
- 排行榜/游戏化能力

虽然当前只支持一个团队，但领域模型中仍保留 `teamId`。

---

## 3. 推荐仓库结构

项目按 pnpm + Turbo monorepo 落地：

```txt
apps/
  web/
  api/
packages/
  ui/
  shared/
  eslint-config/
  tsconfig/
docs/
  superpowers/
    specs/
    plans/
```

### 结构约束

- `apps/web`：React 成员端 Web 应用
- `apps/api`：NestJS API
- `packages/ui`：纯展示层 UI 基础组件，不包含业务请求与业务状态
- `packages/shared`：前后端共享类型、枚举、常量、轻量 schema
- 不额外发明新的顶层应用结构

---

## 4. 后端实现边界

后端业务真值必须保留在服务端，尤其是：

- 是否存在 active session
- 打卡记录是否有效
- 当前网络是否允许打卡
- 周统计聚合结果
- 同团队/跨团队访问权限

### 4.1 后端优先模块

按以下模块边界落地：

- `auth`
- `users`
- `teams`
- `attendance`
- `records`
- `stats`
- `network-policy`

### 4.2 必须保持的 API 形状

首轮实现保持以下接口命名：

- `POST /auth/login`
- `GET /auth/me`
- `GET /attendance/current`
- `POST /attendance/check-in`
- `POST /attendance/check-out`
- `GET /records/me`
- `GET /records/member/:userId`
- `GET /stats/me/weekly`
- `GET /stats/team/current-week`
- `GET /stats/member/:userId/weekly`

### 4.3 关键业务规则

必须严格实现：

- 上卡：已登录、用户有效、无 active session、网络允许
- 下卡：存在 active session、网络允许
- 若 session 时长 `>= 18000` 秒，则：
  - `status = invalidated`
  - `durationSeconds = 0`
  - `invalidReason = overtime_5h`
- 周统计按 `Asia/Shanghai` 自然周计算
- 同团队成员可互相查看记录，跨团队必须拒绝

---

## 5. 前端实现边界

前端按既定分层结构落地：

```txt
apps/web/src/
  app/
  pages/
  widgets/
  features/
  entities/
  shared/
```

### 5.1 关键约束

- 页面只做编排，不承载业务真值
- Zustand 只保存 UI 会话态与轻量登录态，不承载服务端业务真值
- 请求层按领域拆分
- `packages/ui` 保持纯展示

### 5.2 当前优先页面

优先完成：

- `/login`
- `/dashboard`
- `/records`
- `/members`
- `/members/:userId/records`
- `/weekly-history`

### 5.3 当前优先 widgets/features

优先落地：

- `features/auth`
- `widgets/dashboard-checkin-panel`
- `widgets/dashboard-week-summary`
- `widgets/team-overview`
- records / members 相关表格与详情流转

---

## 6. 最近执行顺序

为了尽快形成可运行 MVP，执行顺序固定为：

### Phase A：基础工程

- 初始化 pnpm workspace + turbo
- 建立 apps/packages 目录
- 配置 tsconfig / eslint 基础共享配置
- 建立 web/api 最小可启动骨架

### Phase B：后端核心闭环

- `auth`：登录、当前用户
- `attendance`：上卡、下卡、当前状态、5 小时作废
- `network-policy`：allowlist 校验与错误返回
- `records` / `stats`：明细与聚合查询

### Phase C：前端核心闭环

- 登录页与路由保护
- Dashboard 的打卡卡片与本周摘要
- 记录页、成员页、成员详情页
- 统一错误展示与 loading 状态

### Phase D：验证与文档

- 后端关键业务规则测试优先
- 前端关键交互测试其次
- README、`.env.example`、CLAUDE.md 命令补全最后做

---

## 7. 当前实现策略

为了尽快开工，本阶段采用以下策略：

1. 先完成最小可运行 monorepo，而不是过度打磨工程细节
2. 先保证后端业务闭环，再做前端完整体验
3. 测试优先覆盖核心规则，不追求一开始就补全 E2E
4. 不做超出 V1 范围的管理端、补卡、导出等扩展功能
5. 任何结构性决策都不要偏离 `2026-03-31-lecpunch-architecture-design.md`

---

## 8. 下一步

从这一刻起，后续工作默认按以下顺序推进：

1. 写出实施计划（implementation plan）
2. 搭建 monorepo 基础结构
3. 落地 API 与共享包
4. 落地前端关键页面与业务流
5. 补测试与文档

这份交接设计的目标只有一个：让后续实现以最少歧义快速推进。
