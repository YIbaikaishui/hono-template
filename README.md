# hono-template

高性能 Hono API 模板：**Bun 运行时 + PostgreSQL (Drizzle ORM) + Redis**，开箱即含生产级最佳实践。

## 技术选型（为什么这套组合性能最高）

| 层 | 选择 | 原因 |
|---|---|---|
| 运行时 | Bun 1.2+ | Hono 官方基准测试中最快的运行时，冷启动和请求吞吐均优于 Node |
| 框架 | Hono 4 | 极小的核心（<14KB），基于 RegExpRouter 的路由匹配是所有 Node 框架中最快的 |
| 数据库驱动 | postgres.js | 纯 JS 驱动中最快，连接内管道（pipelining），与 Drizzle 官方推荐组合 |
| ORM | Drizzle ORM | 零运行时开销（没有重查询构建器/标识映射），SQL 近乎手写，类型 100% 推导 |
| 缓存/限流 | Redis (ioredis) | 读穿透缓存 + 分布式固定窗口限流，多副本共享状态 |
| 校验 | Zod 4 | 类型即校验，与 @hono/zod-validator 无缝集成 |
| 日志 | pino | 基准测试中最快的 Node/Bun 日志库，生产输出结构化 JSON |

## 目录结构

```
src/
├── index.ts                  # 入口：启动服务、优雅停机、全局兜底
├── app.ts                    # 组装中间件与路由
├── env.ts                    # Zod 校验的环境变量（启动即失败，fail fast）
├── db/
│   ├── index.ts              # postgres.js 连接池 + Drizzle 实例
│   ├── schema.ts             # 表定义（示例 users 表）
│   └── seed.ts               # 种子数据脚本
├── redis/index.ts            # ioredis 惰性单例
├── lib/
│   ├── logger.ts             # pino 结构化日志
│   ├── cache.ts              # 读穿透缓存 + SCAN 前缀失效
│   └── errors.ts             # AppError（业务错误）
├── middleware/
│   ├── error-handler.ts      # 统一错误响应信封 + 404
│   └── rate-limit.ts         # Redis 分布式限流（Redis 挂了自动 fail-open）
└── modules/                  # 按业务模块分层：routes → service → db
    ├── health/               # /health 存活探针 + /ready 就绪探针
    └── users/                # 完整 CRUD 示例（含缓存读写与失效）
```

## 快速开始

```bash
# 1. 安装依赖
pnpm install

# 2. 配置环境变量
cp .env.example .env

# 3. 启动 PostgreSQL + Redis（需要 Docker）
pnpm docker:up

# 4. 建表 + 灌入示例数据
pnpm db:migrate
pnpm db:seed

# 5. 启动开发服务（--hot 热重载）
pnpm dev
```

服务默认跑在 <http://localhost:3000>。

## API 示例

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/health` | 存活探针（不触碰任何依赖） |
| GET | `/ready` | 就绪探针（Postgres + Redis 连通性） |
| GET | `/api/users?page=1&pageSize=20` | 分页列表（Redis 缓存，响应头 `X-Cache` 标记命中） |
| GET | `/api/users/:id` | 详情（读穿透缓存） |
| POST | `/api/users` | 创建 `{ "email": "...", "name": "..." }` |
| PATCH | `/api/users/:id` | 更新（自动失效该模块缓存） |
| DELETE | `/api/users/:id` | 删除（自动失效该模块缓存） |

错误响应统一为 `{ "error": { "code", "message", "details?" }, "requestId" }`。

## 常用脚本

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 开发模式（--hot 热重载，日志经 pino-pretty 美化） |
| `pnpm start` | 生产模式启动 |
| `pnpm typecheck` / `pnpm lint` | 类型检查 / ESLint |
| `pnpm db:generate` | 由 schema 变更生成迁移 SQL |
| `pnpm db:migrate` | 执行迁移 |
| `pnpm db:studio` | Drizzle Studio（数据库可视化管理） |
| `pnpm db:seed` | 重置并灌入示例数据 |
| `pnpm docker:up` / `docker:down` | 启停 PostgreSQL + Redis |

## 生产部署

```bash
docker build -t hono-template .
docker run --rm -p 3000:3000 --env-file .env hono-template
```

镜像分两阶段：Node + pnpm 安装锁文件依赖，最终运行镜像为 `oven/bun:1-alpine`（仅含生产依赖与源码）。

## 内置最佳实践清单

- **fail fast**：启动时用 Zod 校验全部环境变量，缺配置直接退出并给出可读原因
- **统一错误信封**：`AppError` + `app.onError`，业务代码无需 try/catch；未知错误返回 500 且不泄露内部信息
- **优雅停机**：SIGINT/SIGTERM 后停止接收新连接，依次关闭 Redis/PG 连接池，10 秒强制退出
- **健康探针**：liveness 与 readiness 分离，readiness 带超时，避免数据库挂起拖垮探针
- **分布式限流**：固定窗口 INCR 原子计数，多副本共享；Redis 不可用时 fail-open（可用性优先）
- **读穿透缓存**：`cached()` 助手 + 写操作 SCAN 前缀失效；缓存项带 TTL，坏数据自动剔除
- **请求追踪**：每请求生成 requestId，访问日志与错误日志全部携带
- **安全基线**：secureHeaders、CORS 白名单、pino redact（authorization/cookie 脱敏）
- **数据库连接池**：显式 max/idle/connect 超时，连接数与部署规模匹配
