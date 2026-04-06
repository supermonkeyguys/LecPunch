# UI 组件重构计划（2026-04-04）

## 背景

当前前端页面大量使用手写 HTML，存在严重的重复代码问题。本文档记录需要统一封装的组件、对应的 Radix UI primitives 选择，以及执行顺序。

所有封装组件放在 `packages/ui/src/`，页面从 `@lecpunch/ui` 引用。

---

## 需要安装的 Radix 包

```bash
pnpm --filter @lecpunch/ui add \
  @radix-ui/react-select \
  @radix-ui/react-avatar \
  @radix-ui/react-progress \
  @radix-ui/react-label
```

其余组件（Button、Input、Badge、Alert、DataTable）用纯 HTML + Tailwind 封装，不需要额外 Radix 包。

---

## 组件清单

### 1. Button

**问题**：全应用 10+ 处手写 `<button className="...">` ，disabled/loading 状态不统一。

**实现**：纯 HTML button + `cva` 定义 variant/size，不需要 Radix（button 语义本身够用）。

**Variant**：
- `primary` — 蓝色实心，主操作（上卡、登录、提交）
- `ghost` — 无背景，次要操作（返回、退出登录）
- `danger` — 红色，危险操作

**Size**：`sm` / `md` / `lg`

**状态**：`loading`（显示 spinner + 禁用点击）、`disabled`

**替换位置**：
- `LoginPage` — 登录/注册切换按钮、提交按钮
- `DashboardPage` — 关闭 error banner 的 ✕ 按钮、"查看完整排行榜"按钮
- `MembersPage` — "查流水"按钮
- `MemberRecordsPage` — 返回按钮
- `Sidebar` — 退出登录按钮

---

### 2. Input

**问题**：`LoginPage` 3 个 input、`MembersPage` 1 个搜索框，各自手写 focus/border 样式，无统一 error 展示。

**实现**：纯封装，包含 `label`（用 Radix Label）+ `input` + `errorMessage`。

**Props**：`label`、`error`、`type`、`placeholder`、`prefix`（前置图标）

**替换位置**：
- `LoginPage` — displayName / username / password 三个字段
- `MembersPage` — 搜索框

---

### 3. Badge

**问题**：`StatusBadge` 组件在 `RecordsPage`、`MembersPage`、`MemberRecordsPage` 三处重复定义，代码完全相同。角色 Badge（管理员/普通成员）也重复出现。

**实现**：纯封装 `<span>`，用 `cva` 定义 variant。

**Variant**：
- `success` — 绿色（completed / 正常）
- `danger` — 红色（invalidated / 超时作废）
- `info` — 蓝色（active / 进行中）
- `purple` — 紫色（admin / 管理员）
- `gray` — 灰色（member / 普通成员）

**替换位置**：
- `RecordsPage` — StatusBadge
- `MembersPage` — StatusBadge + RoleBadge
- `MemberRecordsPage` — StatusBadge

---

### 4. Avatar

**问题**：AppHeader、DashboardPage 团队列表、MemberRecordsPage 页头，三处手写圆形首字母 div，无图片加载 fallback 处理。

**实现**：Radix Avatar（`@radix-ui/react-avatar`），支持图片 + 首字母 fallback。

**Props**：`src`（可选）、`fallback`（首字母）、`size`（sm/md/lg）、`color`（背景色，根据名字哈希）

**替换位置**：
- `AppHeader` — 右上角用户头像
- `DashboardPage` — 团队概览成员列表
- `MemberRecordsPage` — 页头成员头像

---

### 5. Select

**问题**：`WeekSelector` 使用原生 `<select>` + `appearance-none` 覆盖样式，跨平台渲染不一致，无完整键盘导航支持。

**实现**：Radix Select（`@radix-ui/react-select`），完整键盘支持 + 自定义样式。

**替换位置**：
- `WeekSelector` 组件（被 DashboardPage、RecordsPage、MembersPage、WeeklyHistoryPage 使用）

---

### 6. Progress

**问题**：`DashboardPage` 打卡进度条、`WeeklyHistoryPage` 周统计进度条，两处手写 div 模拟进度条，缺少 ARIA `progressbar` role。

**实现**：Radix Progress（`@radix-ui/react-progress`），自带 `role="progressbar"` + `aria-valuenow`。

**替换位置**：
- `DashboardPage` — 单次打卡 5 小时进度条
- `WeeklyHistoryPage` — 各周时长相对进度条

---

### 7. Alert

**问题**：`LoginPage` 错误提示、`DashboardPage` 打卡操作错误 banner，两处手写 div，样式略有差异。

**实现**：纯封装，支持 variant（error / warning / info）+ 可关闭（onClose 回调）。

**替换位置**：
- `LoginPage` — 登录/注册失败错误提示
- `DashboardPage` — 打卡操作失败 banner

---

### 8. DataTable

**问题**：`RecordsPage`、`MembersPage`、`MemberRecordsPage`、`WeeklyHistoryPage` 四处完整重复的 `<table>/<thead>/<tbody>/<tr>/<td>` 结构 + 样式。

**实现**：纯封装，column 配置驱动，内置 loading/empty state。

**API 设计**：

```tsx
<DataTable
  columns={[
    { key: 'weekKey', header: '周标识' },
    { key: 'checkInAt', header: '上卡时间', render: (v) => formatDateTime(v) },
    { key: 'duration', header: '时长', render: (_, row) => formatDuration(row.durationSeconds) },
    { key: 'status', header: '状态', render: (v) => <Badge /> },
  ]}
  data={records}
  loading={loading}
  emptyText="暂无打卡记录"
/>
```

**替换位置**：
- `RecordsPage` — 我的打卡记录表格
- `MembersPage` — 团队排行榜表格
- `MemberRecordsPage` — 成员打卡记录表格
- `WeeklyHistoryPage` — 周历史统计表格

---

## 执行顺序

按依赖关系从底层到上层：

```
阶段 1（基础原子组件，无依赖）
  ├── Badge
  ├── Button
  ├── Avatar（依赖 Radix Avatar）
  └── Progress（依赖 Radix Progress）

阶段 2（表单组件）
  ├── Input（依赖 Radix Label）
  ├── Alert
  └── Select（依赖 Radix Select，替换 WeekSelector）

阶段 3（复合组件）
  └── DataTable（依赖 Badge）

阶段 4（页面替换）
  ├── 用 Badge 替换三处 StatusBadge / RoleBadge
  ├── 用 Button 替换全部手写 button
  ├── 用 Input 替换 LoginPage + MembersPage
  ├── 用 Avatar 替换三处圆形 div
  ├── 用 Alert 替换两处 error banner
  ├── 用 Progress 替换两处进度条 div
  ├── 用 Select 替换 WeekSelector
  └── 用 DataTable 替换四处 table
```

---

## packages/ui 目录结构（目标）

```
packages/ui/src/
  components/
    Button.tsx
    Input.tsx
    Badge.tsx
    Avatar.tsx
    Select.tsx
    Progress.tsx
    Alert.tsx
    DataTable.tsx
  index.ts          ← 统一导出
```

---

## 注意事项

- `packages/ui` 保持纯展示层，不引入业务请求或 Zustand store
- 所有样式用 Tailwind 类，不引入 CSS-in-JS
- `cva`（class-variance-authority）已安装，直接用
- `cn`（clsx + tailwind-merge）工具函数已在 `apps/web/src/shared/lib/utils.ts`，需要在 `packages/ui` 里也提供一份
- Radix 包安装在 `packages/ui`，不在 `apps/web`
- `packages/ui` 的 `tsconfig.json` 需要配置 JSX 支持（`"jsx": "react-jsx"`）
