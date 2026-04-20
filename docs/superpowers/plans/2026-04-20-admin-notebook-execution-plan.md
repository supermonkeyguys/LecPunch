# 团队管理员记事本（小后台）执行计划（2026-04-20）

## 背景

当前 LecPunch 已具备管理员能力雏形（成员管理、网络策略、记录导出），并且同一 Web 应用承载成员端与管理员端。

你提出的新方向是扩展为“团队管理员专属记事本”，核心场景包含：

- 团费管理（流水记录）
- 团队活动日程（可追溯历史）
- 成员档案与注册准入（合法学号/实名决定能否注册）

本计划目标是把该方向拆成可执行、可验证、可迭代交付的任务路径。

## 已确认决策（本计划硬约束）

1. 注册必须命中准入规则（是）
2. 准入校验要求“学号 + 真实姓名”双匹配（是）
3. 不满足准入规则时直接拒绝注册（拒绝，不进入待审核）

## 架构边界（沿用现有原则）

- 业务真值在服务端，不下放前端
- 继续使用单 Web + `/admin/*` 路由分区
- 保持领域模块化拆分，不做“单体记事本文本”
- 所有新增核心数据保留 `teamId`
- 时间口径保持 `Asia/Shanghai`
- 管理能力必须受 `admin` 权限保护

## 产品范围

### P0（第一阶段必须落地）

- 成员准入白名单（学号 + 真实姓名）
- 注册门禁接入（不通过即拒绝）
- 管理端准入名单维护页（增删改查 + 搜索/筛选）

### P1（第二阶段）

- 团队日程管理（计划、变更、归档）
- 活动历史可检索（按日期、状态）

### P1（第三阶段）

- 团费流水管理（收入/支出）
- 时间范围检索、分类统计、导出预留

### 暂不纳入本轮

- 多团队流程
- 高级审批流（多级审核）
- 财务自动对账/报销流
- 移动端独立后台

---

## 总体实施顺序（建议）

1. 成员准入门禁（P0）
2. 管理端准入名单（P0）
3. 团队日程（P1）
4. 团费流水（P1）
5. 文档与交付加固（回归、观测、告警）

理由：

- 准入门禁直接影响账号安全边界，优先级最高
- 该能力与现有 `auth/register`、`users` 模块耦合最小，见效快
- 日程和流水可在后台框架稳定后并行演进

---

## 模块化设计与任务拆分

## Phase A：成员准入门禁（P0，后端优先）

### A1. 领域模型与共享契约

任务：

- 新增 `member-eligibility` 领域类型（shared）
- 新增准入状态枚举：`allowed | blocked`
- 新增准入错误码：
  - `AUTH_REGISTRATION_NOT_ELIGIBLE`
  - `AUTH_REGISTRATION_REALNAME_MISMATCH`
  - （可选）`AUTH_REGISTRATION_STUDENT_ID_BLOCKED`

验收：

- `packages/shared` 类型和错误码可被 `api/web` 编译引用

### A2. API 模块落地（Nest）

任务：

- 新建 `apps/api/src/modules/member-eligibility/`
- 新增 schema：`member_eligibilities`
- 索引：`{ teamId: 1, studentId: 1 } unique`
- Service 提供：
  - `assertEligible(teamId, studentId, realName)`
  - `listEntries(teamId, query)`
  - `createEntry(...)`
  - `updateEntry(...)`
  - `deleteEntry(...)`（或软删除）

验收：

- 服务层测试覆盖：
  - 命中 allowed + 姓名匹配 -> 通过
  - 学号不存在 -> 拒绝
  - 姓名不匹配 -> 拒绝
  - 状态 blocked -> 拒绝
  - 跨 team 查询/修改 -> 拒绝

### A3. 注册流程接入门禁

任务：

- 在 `AuthService.register` 中接入 `assertEligible`
- 保持现有用户名/学号冲突校验顺序清晰
- 对拒绝注册返回明确错误码和可读 message

验收：

- `auth` 模块测试新增：
  - 双匹配通过可注册
  - 学号不在白名单 -> 403
  - 学号存在但姓名不匹配 -> 403
  - blocked -> 403

### A4. 数据准备与迁移策略

任务：

- 制定初始化脚本：导入准入名单（CSV/JSON）
- 约定字段标准化（去首尾空格、姓名字符集）
- 明确上线前白名单准备流程

验收：

- 预发环境可导入并完成一次端到端注册验证

---

## Phase B：管理员准入名单页面（P0，前后联调）

### B1. 管理 API 路由

任务：

- 提供管理接口：
  - `GET /member-eligibility/admin/entries`
  - `POST /member-eligibility/admin/entries`
  - `PATCH /member-eligibility/admin/entries/:id`
  - `DELETE /member-eligibility/admin/entries/:id`（或 `PATCH status`）
- 统一 `admin` 权限拦截

验收：

- 非 admin 请求返回 403
- admin 跨 team 数据不可访问

### B2. Web 端 feature + page

任务：

- `features/member-eligibility/member-eligibility.api.ts`
- `pages/admin-member-eligibility/AdminMemberEligibilityPage.tsx`
- 侧边栏增加入口：`/admin/member-eligibility`
- 页面能力：
  - 列表（学号、姓名、状态、备注、更新时间）
  - 搜索（学号/姓名）
  - 新增/编辑/状态切换
  - 关键操作确认

验收：

- 管理员可完整 CRUD
- 普通成员不可见入口且不可访问路由

### B3. 前端交互与错误反馈

任务：

- 注册页保留现有字段，不新增业务逻辑分支
- 根据后端错误码显示明确提示：
  - 不在准入名单
  - 姓名与学号不匹配
  - 账号注册关闭（保留）

验收：

- 登录/注册页面错误提示可区分具体失败原因

---

## Phase C：团队日程管理（P1）

### C1. 领域模型

任务：

- 新建 `team-events` 模块
- 字段建议：`teamId`、`title`、`description`、`eventAt`、`status(planned|done|cancelled)`、`createdBy`、`updatedBy`
- 索引建议：`{ teamId: 1, eventAt: -1 }`

验收：

- 支持时间范围查询与状态筛选

### C2. 管理端页面

任务：

- 新增 `/admin/events`
- 支持创建、编辑、取消、完结、归档视图

验收：

- 可按月查看历史活动并回看变更

### C3. 成员端只读（可选）

任务：

- 成员侧展示近期活动（不提供写操作）

验收：

- 同 team 可读，跨 team 拒绝

---

## Phase D：团费流水（P1）

### D1. 领域模型

任务：

- 新建 `team-ledger` 模块
- 字段建议：
  - `teamId`
  - `occurredAt`
  - `type(income|expense)`
  - `amountCents`（整数分，避免浮点误差）
  - `category`
  - `counterparty`
  - `note`
  - `createdBy`
- 索引建议：`{ teamId: 1, occurredAt: -1 }`

验收：

- 支持按日期范围、类型、分类筛选

### D2. 账务操作策略

任务：

- 默认“追加式记账”
- 不直接改历史余额
- 提供冲正/作废标记机制（优于硬删除）

验收：

- 任意账目变更可追溯来源与操作者

### D3. 管理页面

任务：

- 新增 `/admin/ledger`
- 列表 + 汇总卡片（总收入/总支出/净额）
- 导出能力先预留 API 契约

验收：

- 团队管理员可完成日常流水维护

---

## Phase E：回归、发布与运维加固

### E1. 测试矩阵

后端重点：

- 准入门禁规则
- admin 权限
- team 隔离
- 关键错误码稳定性

前端重点：

- admin 路由守卫
- 准入名单页面交互
- 注册失败提示路径

### E2. 文档与交付

任务：

- 更新 `CLAUDE.md` 当前管理面说明
- 增补运行手册（如何导入白名单、如何排错）
- 编写最小回滚策略（关开关/禁注册）

### E3. 发布策略

任务：

- 先上线 P0（准入门禁 + 管理名单）
- 观察注册失败率与误拒绝率
- 再灰度上线日程和流水模块

---

## 任务分片与原子提交建议

建议每个子任务一个 commit，避免大包提交。

1. `shared` 准入类型与错误码
2. `api` member-eligibility 模块（schema/service/controller + tests）
3. `api` auth.register 门禁接入 + tests
4. `web` member-eligibility API + admin 页面 + router/sidebar
5. `web` 注册错误提示优化 + tests
6. `docs` 运维与功能文档

---

## 风险与应对

### 风险 1：姓名格式导致误拒绝

应对：

- 注册与白名单统一 normalize（trim、全半角策略）
- 明确姓名匹配规则并写入文档

### 风险 2：白名单初始数据不全

应对：

- 上线前先导入并抽样校验
- 提供“管理员快速补录”能力

### 风险 3：管理员误删准入条目

应对：

- 删除操作二次确认
- 优先采用 `blocked` 状态替代硬删除

### 风险 4：后续模块范围膨胀

应对：

- 严格按 P0/P1 分阶段
- 每阶段先闭环再扩展

---

## 完成定义（Definition of Done）

P0 完成标准：

- 注册严格执行“学号 + 真实姓名”双匹配
- 不符合准入直接拒绝注册
- 管理员可维护准入名单
- 后端/前端关键路径测试通过
- 文档可支持团队运营使用

P1 完成标准：

- 管理员可管理团队活动并回看历史
- 管理员可记账并查看收支汇总
- 保持 team 隔离与权限安全边界

---

## 立即可执行的下一步（从现在开始）

1. 先落地 Phase A（后端准入门禁）
2. 然后 Phase B（管理端准入名单页）
3. 通过后再开启 Phase C / D

---

## 执行进度

- 2026-04-20: [x] Phase A1（`shared` 准入类型与错误码）
  - 新增 `member-eligibility` 共享类型：`MemberEligibilityStatus`、`MemberEligibilityEntry`
  - 新增错误码：`AUTH_REGISTRATION_NOT_ELIGIBLE`、`AUTH_REGISTRATION_REALNAME_MISMATCH`、`AUTH_REGISTRATION_STUDENT_ID_BLOCKED`
  - 导出已接入 `packages/shared/src/index.ts`
- 2026-04-20: [x] Phase A2（`api` member-eligibility 模块核心能力）
  - 新增模块与 schema：`apps/api/src/modules/member-eligibility/`，集合 `member_eligibilities`
  - 索引已落地：`{ teamId: 1, studentId: 1 } unique`
  - service 已提供：`assertEligible`、`listEntries`、`createEntry`、`updateEntry`、`deleteEntry`
  - service 测试已覆盖：allowed、学号不存在、姓名不匹配、blocked、跨 team 修改拒绝
- 2026-04-20: [x] Phase A3（注册流程接入门禁）
  - `AuthService.register` 已接入 `assertEligible(teamId, studentId, realName)`
  - `AuthModule` 已引入 `MemberEligibilityModule`
  - 新增 `auth.service.spec.ts`，覆盖 4 条场景：双匹配通过、学号不在白名单、姓名不匹配、blocked
- 2026-04-20: [x] Phase A4（数据准备与迁移策略）
  - 新增导入脚本：`pnpm --filter @lecpunch/api import-eligibility -- <csv|json>`
  - 脚本与 service 共享标准化规则（学号/实名/status/note）
  - 新增运行手册：`docs/superpowers/specs/2026-04-20-member-eligibility-import-runbook.md`
  - 明确了预发环境导入与四类注册样本校验流程
