# LecPunch

LecPunch 是一个面向团队成员的 Web 打卡 MVP。当前仓库已经具备可运行的 monorepo 骨架、NestJS API、React Web 前端，以及最小业务闭环页面。

## 当前能力

- 用户名/密码登录与注册
- Dashboard 查看当前打卡状态
- 上卡 / 下卡
- 我的打卡记录
- 团队成员列表
- 成员记录详情
- 个人周历史统计

## 技术栈

- pnpm workspace + Turbo
- `apps/api`: NestJS + MongoDB
- `apps/web`: React + Vite + Zustand + Axios + Tailwind
- `packages/shared`: 前后端共享类型与常量

## 环境准备

- Node.js 20+
- pnpm 8+
- MongoDB 本地实例

## 安装依赖

```bash
pnpm install
```

## 环境变量

### API

复制：

```bash
cp apps/api/.env.example apps/api/.env
```

关键变量：

- `MONGODB_URI`
- `AUTH_SECRET`
- `ALLOW_OPEN_REGISTRATION`
- `ALLOW_ANY_NETWORK`

开发阶段可保持：

```env
ALLOW_OPEN_REGISTRATION=true
ALLOW_ANY_NETWORK=true
```

### Web

复制：

```bash
cp apps/web/.env.example apps/web/.env
```

默认前端请求 API：

```env
VITE_API_BASE_URL=http://localhost:4000
```

## 启动开发环境

### 启动 API

```bash
pnpm --filter @lecpunch/api dev
```

默认监听：`http://localhost:4000`

### 启动 Web

```bash
pnpm --filter @lecpunch/web dev
```

默认监听：`http://localhost:4173`

## 常用命令

### 全仓

```bash
pnpm test
pnpm typecheck
pnpm build
```

### 单独运行 API 测试

```bash
pnpm --filter @lecpunch/api test
```

### 单独运行 Web 测试

```bash
pnpm --filter @lecpunch/web test
```

## 当前说明

- 当前页面已经接上主要 API，但 UI 仍是 MVP 级别
- 网络限制默认可放开；若要验证限制逻辑，请在 API `.env` 中关闭 `ALLOW_ANY_NETWORK`
- 当前没有完整 seed 脚本，建议先通过注册页面创建测试账号

## 参考文档

- 架构设计：`docs/superpowers/specs/2026-03-31-lecpunch-architecture-design.md`
- 执行交接：`docs/superpowers/specs/2026-04-02-lecpunch-handoff-design.md`
