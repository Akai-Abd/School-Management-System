FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @school-erp/contracts --filter @school-erp/api
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN pnpm --filter @school-erp/api db:generate && pnpm --filter @school-erp/contracts build && pnpm --filter @school-erp/api build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/contracts ./packages/contracts
COPY --from=builder /app/apps/api ./apps/api
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/server.js"]
