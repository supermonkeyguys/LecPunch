# FocusTeam 打卡系统 - 前端 UI 架构执行任务书

本任务书旨在为前端开发（或 AI 代码生成）提供清晰的页面骨架、组件层级与状态流转设计。遵循 **UI 与 业务逻辑分离** 的原则进行组件化拆解。

## 零、 全局统一样式规范 (Design Tokens)

在构建任何组件前，需在全局（如 Tailwind Config 或 CSS Variables）定义以下样式基准：

| **类别**              | **规范参数 / CSS Class (以 Tailwind 为基准)**                | **应用场景说明**                             |
| --------------------- | ------------------------------------------------------------ | -------------------------------------------- |
| **主色调 (Primary)**  | `blue-600` (#2563eb), Hover: `blue-700`, Bg: `blue-50`       | 核心操作按钮、选中状态、品牌主色             |
| **状态色 (Status)**   | **成功:** `green-500` / **警告:** `orange-500` / **危险:** `red-500` | 在线绿点、作废警告、打卡超时警告             |
| **背景色 (Bg)**       | **底层:** `gray-50`, **卡片层:** `white`                     | 页面最底层使用浅灰，所有内容包裹在纯白卡片中 |
| **文字 (Typography)** | **标题:** `text-gray-900` font-bold **正文:** `text-gray-700` **辅助:** `text-gray-500` / `text-gray-400` **数据体:** `font-mono` (等宽字体) | 时长、时间戳等数字强依赖等宽字体 `font-mono` |
| **圆角 (Radius)**     | `rounded-2xl` (大卡片), `rounded-lg` (按钮/输入框), `rounded-full` (头像/打卡按钮) | 整体风格偏圆润现代                           |
| **阴影与边框**        | Border: `border-gray-200` Shadow: `shadow-sm` (通用卡片), `shadow-xl` (核心按钮) | 卡片采用 1px 极浅边框配合小阴影的微质感设计  |
| **特定动效 (Anim)**   | `@keyframes pulse-slow` (带色相的光晕呼吸效果)               | 仅用于“正在打卡”状态下的核心按钮和绿点       |

## 一、 核心全局状态字典 (Global Store / Context)

架构必须抽离出以下全局状态，供各个页面组件读取和修改：

- `currentView` (String): 当前路由状态。枚举值 `['login', 'dashboard', 'history', 'team']`。
- `selectedWeek` (String): 全局时间维度筛选器。枚举值 `['current', 'prev1', 'prev2', ...]`.
- `selectedMember` (Object | null): 团队页面中当前被查看详情的成员对象。
- `checkinState` (Object): 打卡核心引擎状态。包含：
  - `isCheckedIn` (Boolean): 是否正在打卡。
  - `elapsedSeconds` (Number): 当前累计打卡秒数。

## 二、 页面布局架构 (Layout Architecture)

系统被划分为两种完全独立的顶级 Layout：

### 1. AuthLayout (授权布局)

- **适用范围：** `LoginView`
- **布局构成：** 100vw * 100vh，横向 Flex。
  - `[Left区]`: 占幅 5/12，隐藏于移动端，品牌展示区 (深蓝背景)。
  - `[Right区]`: 占幅 7/12，居中展示业务表单卡片。

### 2. MainLayout (主工作区布局)

- **适用范围：** `DashboardView`, `HistoryView`, `TeamView`
- **布局构成：** 100vw * 100vh，横向 Flex。
  - `[Sidebar区]`: 宽度固定 256px (`w-64`)，纯白背景，右侧带 1px 边框。
  - `[Content区]`: 占据剩余宽度 (`flex-1`)，纵向 Flex，背景色 `gray-50`。
    - `[Header区]`: 高度固定 64px (`h-16`)，吸顶 (`sticky top-0`)。
    - `[Main区]`: 占据剩余高度 (`flex-1`)，内含纵向滚动条 (`overflow-y-auto`)。

## 三、 页面视图与组件拆解详情 (Views & Components)

### V1. LoginView (登录页)

基于 `AuthLayout` 构建。

| 构成组件 | 组件说明与内置逻辑 |

| :--- | :--- |

| `BrandPanel` | 纯视觉组件。展示 Logo、标题、副标题与背景网格特效。 |

| `LoginForm` | 包含手机号 Input、验证码 Input+获取按钮、登录 Submit 按钮。



**逻辑：** 拦截 `onSubmit` 事件，校验通过后调用全局 action 将 `currentView` 设为 `'dashboard'`。 |

### V2. DashboardView (工作台主页)

基于 `MainLayout -> Main区` 构建。页面最大宽度限制 `max-w-7xl`，居中。

- **布局构成：** 顶部标题栏区 + 核心内容网格区（左侧宽栏 占2/3 + 右侧窄栏 占1/3）。

| **构成组件**         | **页面内位置** | **组件逻辑与状态绑定**                                       |
| -------------------- | -------------- | ------------------------------------------------------------ |
| `PageHeader`         | 顶部           | 包含动态标题文本。依赖全局状态 `selectedWeek` 显示“当前显示：XXX数据”。挂载公共组件 `WeekSelector`。 |
| `CheckinCard`        | 左栏上方       | **【系统最核心组件】** 1. **时长展示：** 依赖 `checkinState.elapsedSeconds` 格式化为 HH:MM:SS。 2. **防呆进度条：** 计算 `elapsedSeconds / 18000 * 100`，>90% (4.5h) 时改变配色并显示警告文本。 3. **打卡主按钮：** 点击触发上卡/下卡 Action。**拦截判断：**若全局 `selectedWeek !== 'current'`，此按钮变为灰色禁用态（展示“历史周不可打卡”）。 |
| `HeatmapCard`        | 左栏下方       | 纯展示组件。接收 `[0,1,2,3]` 组成的一维数组，渲染 20x7 的 CSS Grid 热力方块图。 |
| `TeamOverviewWidget` | 右栏           | 轻量级列表。按 `isOnline` 状态降序排列。在线用户显示呼吸绿点。底部提供“查看完整排行榜”路由跳转按钮 (设置 `currentView='team'`)。 |

### V3. HistoryView (我的打卡记录)

基于 `MainLayout -> Main区` 构建。

- **布局构成：** 顶部控制区 + 下方数据表格区。

| **构成组件**   | **页面内位置** | **组件逻辑与状态绑定**                                       |
| -------------- | -------------- | ------------------------------------------------------------ |
| `PageHeader`   | 顶部           | 挂载 `WeekSelector` 和“导出 Excel”按钮。                     |
| `HistoryTable` | 主体           | 接收针对 `selectedWeek` 获取的历史流水数组 (Array of Objects)。 **UI逻辑：** 状态列需根据 `status` 字段映射不同配色的 Badge (正常->绿色，作废->红色)。对于作废记录，操作列渲染“申诉补卡”按钮。 |

### V4. TeamView (团队成员与排行榜)

基于 `MainLayout -> Main区` 构建。这是一个**包含两种子状态 (列表态 / 详情态)** 的复合页面。依靠全局状态 `selectedMember` 的值来决定渲染哪一种视图。

#### 状态 A：团队列表视图 (当 `selectedMember === null` 时)

| **构成组件**     | **页面内位置** | **组件逻辑与状态绑定**                                       |
| ---------------- | -------------- | ------------------------------------------------------------ |
| `TeamPageHeader` | 顶部           | 挂载 `WeekSelector`，额外挂载一个 `SearchInput`。            |
| `TeamRankTable`  | 主体           | 核心团队数据表格。接收依据 `selectedWeek` 获取的团队数据。 **业务逻辑：** 组件内部需针对传入的 `weekTotal` 字段进行**降序排序** (Sort)。 **UI逻辑：** 排名前3名序号高亮。Hover 行时显隐操作列的“查流水”按钮。点击该按钮，将该行数据对象写入全局 `selectedMember`。 |

#### 状态 B：成员详情视图 (当 `selectedMember !== null` 时)

| **构成组件**         | **页面内位置**   | **组件逻辑与状态绑定**                                       |
| -------------------- | ---------------- | ------------------------------------------------------------ |
| `MemberDetailHeader` | 顶部             | 包含一个 `BackBtn` (点击后设置 `selectedMember = null`)。动态展示头像和姓名。 |
| `MemberSummaryBar`   | 介于表头与表之间 | 灰色背景信息条。展示该成员的 `角色` 与 `选中周累计时长`。    |
| `HistoryTable`       | 主体             | **复用 V3 的组件。** 但传入的数据源应为 `selectedMember` 指定周的历史流水。 |

## 四、 公共基础组件 (Shared Components)

这些组件在 `MainLayout` 的不同部分被高频复用，需单独封装：

| **组件名**     | **建议 Props 接口**                      | **组件逻辑与说明**                                           |
| -------------- | ---------------------------------------- | ------------------------------------------------------------ |
| `Sidebar`      | `activeMenuId` (String)                  | 控制左侧导航高亮。点击内部项触发路由跳转事件。               |
| `Header`       | `wifiName` (String), `userInfo` (Object) | 顶部状态栏。包含 Wifi 标识胶囊、搜索图标、通知小红点和用户头像。 |
| `WeekSelector` | `value` (String), `onChange` (Function)  | 下拉选择器 UI 的定制化封装（去除原生外观）。绑定全局 `selectedWeek`。 |
| `StatusBadge`  | `type` ('success'                        | 'error'                                                      |