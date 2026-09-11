# ---- deps: install production dependencies with the pnpm lockfile ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --prod

# ---- runtime: Bun for the fastest Hono performance ----
FROM oven/bun:1-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY drizzle ./drizzle
COPY drizzle.config.ts package.json tsconfig.json ./
EXPOSE 3000
USER bun
CMD ["bun", "src/index.ts"]
