# AGENTS.md — hono-template

Bun + Hono + PostgreSQL (Drizzle) + Redis 的高性能 API 模板。
Agent 克隆本仓库后，按下面的步骤把项目跑起来再开始开发。

## 启动步骤

1. `pnpm install`
2. `cp .env.example .env` — 修改 `DATABASE_URL` / `REDIS_URL` 为真实连接串（本机 5432/6379 已有服务时改密码即可）
3. 本机没有 PostgreSQL/Redis 时：`docker compose up -d`
4. `bun drizzle-kit migrate && bun run db:seed` — 建表并灌入示例数据
5. `pnpm dev` — 默认 <http://localhost:3000>，用 `GET /health`（存活）和 `GET /ready`（依赖就绪）验证

## 常用命令

| 场景 | 命令 |
|---|---|
| 开发（Bun --hot 热重载） | `pnpm dev` |
| 质量检查（提交前必须全绿） | `pnpm typecheck && pnpm lint` |
| 改了 schema 后生成迁移 | `pnpm db:generate` → 检查生成的 SQL → `pnpm db:migrate` |
| 数据库可视化管理 | `pnpm db:studio` |
| 重置示例数据 | `pnpm db:seed` |

## 写代码约定

- **新业务模块**：`src/modules/<name>/`，`routes.ts` 只做校验和响应组装，业务逻辑在 `service.ts`，SQL 只出现在 service 层
- **环境变量**：先加进 `src/env.ts` 的 zod schema 和 `.env.example`，代码里统一用 `env.X`，不要直接读 `process.env`
- **错误处理**：service 层 `throw new AppError(status, code, message)` 或 `notFound('Xxx')`；route 里不要 try/catch，统一由 `app.onError` 输出错误信封
- **缓存**：读用 `cached(key, ttl, loader)`；写操作之后 `cacheInvalidatePrefix('<模块前缀>')`
- **校验**：route 上用 `validate('json'|'query'|'param', schema)`（`src/lib/validation.ts`），它输出统一的 400 错误信封
- **日志**：`import { logger } from './lib/logger'`，结构化字段用第一个参数对象传
