# Profile Page Design

**Date:** 2026-04-05  
**Scope:** 个人信息页，包含头像自定义、基本信息编辑、修改密码

---

## 1. 数据层变更

### User Schema 新增字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `studentId` | string | 新用户必填 | 12位学号，唯一索引，注册后不可更改 |
| `realName` | string | 新用户必填 | 真实姓名，注册后不可更改；旧用户可为空 |
| `avatarBase64` | string | 否 | 上传图片的 Base64 字符串 |
| `avatarColor` | string | 否 | 预设颜色值（hex），无图片/emoji时显示首字母+背景色 |
| `avatarEmoji` | string | 否 | 选中的 emoji 字符 |

`enrollYear` 字段保留，但注册时改为由 `studentId` 前4位自动解析，不再由前端传入。

**头像优先级（Avatar 组件渲染逻辑）：**
1. `avatarBase64` 存在 → `<img>` 显示
2. `avatarEmoji` 存在 → 大字 emoji 居中显示
3. `avatarColor` 存在 → 首字母 + 该背景色
4. 都没有 → 首字母 + 默认灰色（当前行为）

### 学号解析规则

```ts
function parseStudentId(studentId: string): { enrollYear: number } {
  // 学号前4位为入学年份，如 202431060351 → 2024
  const enrollYear = parseInt(studentId.slice(0, 4), 10);
  return { enrollYear };
}
```

后续如需解析更多字段（院系、专业等），在此函数扩展。

---

## 2. API

### 现有接口变更

**`POST /auth/register`** — 新增字段：
- `studentId: string` — 必填，12位，唯一
- `realName: string` — 必填
- 移除 `enrollYear`（改为后端解析）

**`GET /auth/me`** — 返回值新增：`studentId`, `realName`, `avatarBase64`, `avatarColor`, `avatarEmoji`

### 新增接口

**`PATCH /users/me`**
```json
// Request（所有字段可选，只传要改的）
{
  "displayName": "新昵称",
  "avatarBase64": "data:image/png;base64,...",
  "avatarColor": "#6366f1",
  "avatarEmoji": "🦊"
}
// 三个 avatar 字段互斥：传哪个就用哪个，其余两个清空
```

**`PATCH /users/me/password`**
```json
// Request
{ "oldPassword": "xxx", "newPassword": "yyy" }
// 验证旧密码，失败返回 400 WRONG_PASSWORD
// 新密码最少6位
```

---

## 3. 前端页面：`/profile`

### 入口
AppHeader 右上角头像 → 点击跳转 `/profile`

### 页面结构

```
┌─────────────────────────────────┐
│  头像区                          │
│  [头像预览]  [更换头像 按钮]      │
├─────────────────────────────────┤
│  基本信息                        │
│  昵称        [可编辑输入框]       │
│  真实姓名    [只读]               │
│  学号        [只读]               │
│  入学年份    [只读，由学号解析]    │
│  登录账号    [只读]               │
│  角色        [只读]               │
│                    [保存修改]     │
├─────────────────────────────────┤
│  修改密码                        │
│  当前密码    [输入框]             │
│  新密码      [输入框]             │
│  确认新密码  [输入框]             │
│                    [修改密码]     │
└─────────────────────────────────┘
```

### 头像编辑面板（点击「更换头像」弹出 Dialog）

两个 Tab：

**Tab 1 — 预设**
- 颜色区：10种预设色块，点选高亮
- Emoji 区：~48个精选 emoji，分组（表情、动物、食物、自然、物品），点选高亮
- 颜色和 emoji 互斥：选了 emoji 则颜色取消，反之亦然

**Tab 2 — 上传图片**
- 拖拽或点击上传，格式 jpg/png，最大 2MB
- 上传后前端裁剪为 200×200（使用 canvas），转 Base64
- 预览裁剪结果

面板底部：「确认」按钮 → 调用 `PATCH /users/me` → toast 提示成功 → 关闭面板

---

## 4. Avatar 组件更新

`packages/ui/src/components/Avatar.tsx` 扩展 props：

```ts
interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  // 新增
  avatarBase64?: string;
  avatarEmoji?: string;
  avatarColor?: string;
}
```

渲染优先级按第1节定义。

---

## 5. 注册流程变更

`LoginPage.tsx` 的注册表单新增两个字段：
- 学号（12位数字，实时校验格式）
- 真实姓名
- 移除「入学年份」选择器

---

## 6. 测试重点

**后端：**
- 学号格式校验（非12位拒绝）
- 学号唯一性（重复注册拒绝）
- enrollYear 正确由学号解析
- PATCH /users/me 三个 avatar 字段互斥清空
- 修改密码旧密码错误返回 400

**前端：**
- Avatar 四种渲染路径
- 上传图片超过 2MB 被拦截
- 注册表单新字段校验
