# LecPunch 管理员记事本运行手册（2026-04-20）

本文覆盖成员准入、团队日程、团费流水三块日常运维动作，并提供常见排障与最小回滚策略。

## 1. 运行前检查

1. API 已启动：`pnpm --filter @lecpunch/api dev`
2. Web 已启动：`pnpm --filter @lecpunch/web dev`
3. MongoDB 可用：`localhost:27017`
4. 管理员账号可登录，并可见以下页面：
   - `/admin/member-eligibility`
   - `/admin/events`
   - `/admin/ledger`

## 2. 成员准入名单操作

### 2.1 初始化导入

使用导入脚本批量导入准入名单：

```bash
pnpm --filter @lecpunch/api import-eligibility -- <csv_or_json_path>
```

导入规则（已在脚本内实现）：

- 学号：去空格，仅允许 12 位数字
- 真实姓名：去首尾空格
- 状态：`allowed | blocked`
- 备注：可空

### 2.2 管理端维护

页面：`/admin/member-eligibility`

- 支持按学号/姓名搜索
- 支持新增、编辑、状态切换、删除
- 非管理员访问会返回 403

### 2.3 导入后验证建议

至少准备 4 组注册样本：

1. 准入+姓名匹配（应成功）
2. 学号不在名单（应拒绝）
3. 学号存在但姓名不匹配（应拒绝）
4. 学号被 blocked（应拒绝）

## 3. 团队日程操作

### 3.1 管理端页面

页面：`/admin/events`

- 支持按月加载历史
- 支持创建、编辑、状态切换（planned/done/cancelled）
- 成员端可在 `/events` 只读查看

### 3.2 推荐操作规范

1. 新建活动时明确标题与时间
2. 活动完成后切换为 `done`
3. 取消活动切换为 `cancelled`，避免删除历史

## 4. 团费流水操作

### 4.1 管理端页面

页面：`/admin/ledger`

- 支持新增收入/支出流水
- 支持按月、类型、状态筛选
- 支持作废（void）与冲正（reversal）
- 提供收入/支出/净额汇总卡

### 4.2 记账规范

1. `amountCents` 使用整数分，前端输入元后转换
2. 优先通过“冲正”修正历史，不直接修改原流水
3. 需要失效记录时使用“作废”，保留审计信息（`voidedAt/voidedBy/voidReason`）

## 5. 常见排障

### 5.1 页面显示“后端服务不可达”

检查：

1. API 是否已启动
2. MongoDB 是否可连通
3. `VITE_API_BASE_URL` 是否正确（本地代理模式建议留空）

### 5.2 管理接口返回 403

检查：

1. 当前用户是否 `admin`
2. token 是否过期（重新登录）
3. 是否访问了跨 team 数据（服务端会拒绝）

### 5.3 新增类型后 API typecheck 报 shared 导出缺失

按顺序执行：

```bash
pnpm --filter @lecpunch/shared build
pnpm --filter @lecpunch/api exec tsc -b tsconfig.build.json --force
```

## 6. 最小回滚策略

### 6.1 紧急停止注册

将 API 环境变量设为：

```env
ALLOW_OPEN_REGISTRATION=false
```

重启 API 后，`/auth/register` 将被拒绝。

### 6.2 降级为“仅成员端可用”

若后台模块出现故障：

1. 保留成员端核心路由（打卡、记录）不变
2. 暂停管理员操作入口（前端隐藏 `/admin/*` 导航）
3. 保留数据库数据，不做硬删除，待修复后恢复入口

### 6.3 数据层回滚原则

1. 日程：优先改状态（`cancelled`）而非删除
2. 流水：优先“冲正/作废”而非删除
3. 准入：优先 `blocked` 而非直接删条目
