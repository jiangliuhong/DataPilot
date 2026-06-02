# 项目目录结构

## 概览

项目使用 Next.js App Router，采用严格的前后端分离架构。所有应用代码位于 `src/` 目录下。

```
datapilot/
├── docs/                    # 项目文档
├── public/                  # 静态资源
├── src/
│   ├── app/                 # 路由（仅路由相关代码）
│   │   ├── api/             #   后端 API 路由（transport layer）
│   │   ├── dashboard/       #   Dashboard 页面路由
│   │   ├── layout.tsx       #   根布局
│   │   ├── page.tsx         #   首页
│   │   ├── globals.css      #   全局样式
│   │   └── favicon.ico      #   网站图标
│   ├── features/            # 业务功能模块（按领域组织）
│   │   ├── auth/
│   │   │   ├── components/  #   认证相关组件
│   │   │   └── hooks/       #   认证相关 Hooks
│   │   └── user/
│   │       ├── components/  #   用户相关组件
│   │       └── hooks/       #   用户相关 Hooks
│   ├── components/          # 全局共享组件
│   │   ├── ui/              #   通用 UI 组件（基于 HeroUI 封装）
│   │   ├── layout/          #   布局组件（Header、Sidebar 等）
│   │   └── shared/          #   跨功能共享组件
│   ├── api-client/          # 前端 API 抽象层
│   ├── server/              # 后端代码
│   │   ├── services/        #   业务逻辑层
│   │   ├── repositories/    #   数据库访问层（Prisma）
│   │   ├── schemas/         #   Zod 校验规则
│   │   ├── middleware/      #   中间件
│   │   └── types/           #   服务端类型定义
│   ├── hooks/               # 全局自定义 Hooks
│   ├── lib/                 # 工具库/辅助函数
│   ├── constants/           # 全局常量
│   └── types/               # 全局类型定义
├── package.json
├── tsconfig.json
├── next.config.ts
├── eslint.config.mjs
├── postcss.config.mjs
└── AGENTS.md                # 项目架构规则
```

## 层级职责

### `app/` — 路由层

仅处理路由相关逻辑。

| 允许 | 禁止 |
|------|------|
| `page.tsx` | 数据库查询 |
| `layout.tsx` | 业务逻辑 |
| `loading.tsx` | Prisma 调用 |
| `error.tsx` | 校验逻辑 |
| `route.ts` | 复杂数据转换 |

### `app/api/` — API 传输层

仅负责接收请求、校验、调用 service、返回响应。

```ts
// ✅ 正确
export async function GET() {
  const users = await userService.findAll();
  return Response.json(users);
}

// ❌ 禁止在 route handler 中写 Prisma / SQL / 业务规则
```

### `server/services/` — 业务逻辑层

- 授权、工作流、业务规则、编排
- 可调用：repositories、外部 API、其他 services
- 禁止：渲染 UI、包含 React 代码

### `server/repositories/` — 数据访问层

- 所有数据库访问（Prisma / SQL）
- 禁止：业务规则、授权逻辑

### `api-client/` — 前端 API 抽象层

前端页面和组件必须通过 `api-client` 调用 API。

```ts
// ✅ 正确
const users = await userApi.list();

// ❌ 禁止直接 fetch
await fetch("/api/users");
```

### `features/` — 功能模块

每个业务领域一个文件夹，代码就近组织：

```
features/
└── user/
    ├── components/   # 该功能的组件
    ├── hooks/        # 该功能的 Hooks
    ├── types.ts      # 该功能的类型
    └── constants.ts  # 该功能的常量
```

## 导入规范

```ts
// ✅ 推荐：使用 @ 别名
@/features/user
@/components/ui
@/server/services

// ❌ 避免：深层相对路径
../../../../../components
```

## 数据访问规则

```
✅ 允许：Repository → Prisma

❌ 禁止：
  Page → Prisma
  Component → Prisma
  Service → Prisma
  API Route → Prisma
```

只有 repositories 可以直接访问 Prisma。

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router, Turbopack) |
| UI | HeroUI v3 |
| 样式 | Tailwind CSS v4 |
| 校验 | Zod |
| 语言 | TypeScript |
| 动画 | Framer Motion |
