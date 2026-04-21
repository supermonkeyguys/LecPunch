# 可视化曲线图实施计划（2026-04-21）

## 背景

当前系统已经具备以下数据基础：

- 团费流水管理（`/admin/ledger`，含收入/支出/净额汇总）
- 个人周历史打卡统计（`/weekly-history`，含每周累计时长与次数）

但页面仍以表格和卡片为主，缺少“趋势视图”。本计划目标是在不破坏现有业务边界的前提下，补齐趋势曲线图能力，用于：

- 团费趋势（收入、支出、净额）
- 打卡时长趋势（周累计时长）

## 已确认技术方向

### 图表库选型

采用：`Recharts`（React 19 兼容）

不采用（本轮）：

- `ECharts`：能力强但配置复杂、包体积大，不适合首轮快速落地
- `visx`：当前 React 19 兼容性与接入复杂度不优于 Recharts

选型理由：

1. 与当前 React + Vite 项目匹配度高
2. 组件式 API 更适合现有页面结构
3. 先满足“趋势可视化 + 可维护”而非复杂大屏能力

## 约束与边界（沿用现有架构）

- 业务真值在服务端，前端不做核心业务裁决
- 时间口径保持 `Asia/Shanghai`
- 现有 API 不做破坏式变更，仅做增量接口或兼容扩展
- 页面保持组合层角色，图表数据加工优先沉到 `features/*`

## 可视化范围（MVP）

## A. 团费趋势图（管理员）

页面：`/admin/ledger`

图表目标：

- 近一段时间收入/支出双折线
- 可选叠加净额线（或面积）
- 与现有月份筛选联动

### B. 打卡时长趋势图（成员）

页面：`/weekly-history`

图表目标：

- 最近 N 周累计时长折线
- 可显示目标时长参考线
- 与表格信息保持一致

## 数据与接口方案

## 1) 打卡时长趋势（优先复用现有接口）

直接复用：

- `GET /stats/me/weekly`

原因：

- 已返回 `weekKey`、`totalDurationSeconds`、`weeklyGoalSeconds`
- 满足周维度趋势图，不需要新增后端接口

## 2) 团费趋势（建议新增后端聚合接口）

新增（增量）：

- `GET /team-ledger/admin/trend`

建议 query：

- `from?`
- `to?`
- `status=active|voided|all`（默认与现有列表一致）
- `granularity=day|week`（MVP 默认 `day`）

建议 response：

```ts
{
  items: Array<{
    bucketKey: string; // 例：2026-04-21 或 2026-W17
    incomeCents: number;
    expenseCents: number;
    netCents: number;
    entryCount: number;
  }>;
}
```

说明：

- `bucketKey` 由服务端按 `Asia/Shanghai` 归桶
- 前端只做展示，不承担账务真值聚合

## UI 与组件分层建议

## 1) 页面层（pages）

- `AdminLedgerPage`：保留现有卡片和表格，在筛选区下方新增“趋势图板块”
- `WeeklyHistoryPage`：在表格上方新增“周趋势图板块”

## 2) 业务层（features）

建议新增：

- `features/visualization/chart-formatters.ts`（图表点位格式化、单位转换）
- `features/team-ledger/team-ledger.api.ts` 扩展 `getAdminTeamLedgerTrend`

## 3) 展示层（widgets，可选）

可抽象：

- `LedgerTrendChart`
- `WeeklyDurationTrendChart`

首轮也可先在页面内实现，第二轮再抽离复用。

## 实施阶段与任务拆分

## Phase 0：依赖与脚手架（P0）

任务：

- 安装 `recharts`
- 新增通用图表样式约定（颜色、tooltip、axis 格式）

验收：

- `pnpm --filter @lecpunch/web typecheck` 通过
- `pnpm --filter @lecpunch/web test` 不回归

## Phase 1：打卡时长趋势图（P0）

任务：

- 在 `WeeklyHistoryPage` 接入折线图
- X 轴：`weekKey`
- Y 轴：`totalDurationSeconds`（展示为小时）
- 目标线：`weeklyGoalSeconds`

验收：

- 表格与图表数据一致
- 空状态、加载态、错误态显示正确

## Phase 2：团费趋势后端接口（P0）

任务：

- `team-ledger` 模块新增 `trend` service/controller
- 支持 `from/to/status/granularity`
- 使用 Mongo 聚合生成归桶结果

验收：

- 新增后端测试：
  - 聚合正确
  - status 过滤正确
  - admin 权限与 team 隔离正确

## Phase 3：团费趋势图（P0）

任务：

- `AdminLedgerPage` 接入趋势图
- 展示收入/支出/净额（至少两条线）
- 与月份筛选联动

验收：

- 筛选改变后图表与卡片数据方向一致
- 无数据时展示空态

## Phase 4：交互增强与文档（P1）

任务：

- Tooltip 增加“金额/时长”格式化
- 图例开关（可选）
- 更新运行手册与页面说明

验收：

- UI 可读性满足日常运营使用
- 文档可指导后续扩展（例如团队趋势、成员对比）

## 测试策略

后端：

- `team-ledger.service.spec.ts`
- `team-ledger.controller.spec.ts`

前端：

- `WeeklyHistoryPage.test.tsx`：新增图表渲染与关键文本断言
- `AdminLedgerPage.test.tsx`：新增趋势图渲染与筛选联动断言

全量验证：

- `pnpm test`
- `pnpm typecheck`
- `pnpm build`

## 风险与应对

风险 1：图表与表格口径不一致  
应对：所有图表数据从同一 API 响应对象派生，避免二次请求导致偏差

风险 2：日期归桶跨时区偏差  
应对：后端统一按 `Asia/Shanghai` 归桶，前端只做 label 展示

风险 3：图表引入导致包体积上涨  
应对：首轮仅引入单一库 Recharts，不并行引入多套图表依赖

## 完成定义（DoD）

满足以下条件视为本计划完成：

1. `/weekly-history` 可展示周打卡时长趋势图（含目标参考）
2. `/admin/ledger` 可展示团费趋势图（收入/支出/净额）
3. 团费趋势聚合接口可复用，且具备权限与 team 隔离
4. 关键前后端测试通过，未破坏现有功能
5. 文档可持续记录后续迭代进度

## 执行进度（持续更新）

- 2026-04-21: [x] 方案确认（图表库选型、范围、接口策略）
- 2026-04-21: [x] 创建执行计划文档
- 2026-04-21: [x] Phase 0 依赖与脚手架
  - 已安装 `recharts` 与 `react-is`
  - 新增 `apps/web/src/shared/lib/chart.ts` 作为图表主题与格式化约定
- 2026-04-21: [x] Phase 1 打卡时长趋势图
  - `WeeklyHistoryPage` 新增“周时长趋势”折线图（累计时长 + 周目标）
  - 复用 `shared/lib/chart.ts` 的颜色与格式化约定
  - 更新 `WeeklyHistoryPage.test.tsx` 并通过 web 全量测试
- 2026-04-21: [x] Phase 2 团费趋势后端接口
  - `team-ledger` 新增 `GET /team-ledger/admin/trend`（`from/to/status/granularity`）
  - 服务端按 `Asia/Shanghai` 归桶并返回收入/支出/净额/笔数趋势项
  - 补充 `team-ledger.service.spec.ts` 趋势聚合测试与 `team-ledger.controller.spec.ts` 权限覆盖
- 2026-04-21: [x] Phase 3 团费趋势图
  - `AdminLedgerPage` 新增“团费趋势”图表区块（收入/支出/净额三线）
  - 扩展前端 API：`getAdminTeamLedgerTrend` 对接 `/team-ledger/admin/trend`
  - 更新 `AdminLedgerPage.test.tsx` 并通过 web 定向+全量测试与 typecheck
- 2026-04-21: [ ] Phase 4 交互增强与文档收口
