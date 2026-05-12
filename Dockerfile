# =============================================================================
# CREATOR HUB — Multi-stage Docker build (Render / Docker Compose)
# Base: node:20-alpine (~5 MB)
# Multi-stage: builder installs + builds, runner copies only what's needed
# =============================================================================

# ── Shared base ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# ── Builder ──────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

# 1) Copy workspace manifests first (layer cache for pnpm install)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml \
     tsconfig.base.json tsconfig.json .npmrc ./

# 2) Copy workspace packages needed for the build
COPY lib/ lib/
COPY scripts/ scripts/
COPY artifacts/api-server/ artifacts/api-server/
COPY artifacts/artist-platform/ artifacts/artist-platform/

# 3) Install all dependencies (dev deps included — needed for build tools)
RUN pnpm install --frozen-lockfile

# 4) Generate Zod schemas + React Query hooks from the OpenAPI spec
RUN pnpm --filter @workspace/api-spec run codegen

# 5) Build the API server — esbuild bundles everything into dist/index.mjs
RUN pnpm --filter @workspace/api-server run build

# 6) Build the React frontend — Vite outputs to artifacts/artist-platform/dist/public
ENV PORT=8080
ENV BASE_PATH=/
RUN pnpm --filter @workspace/artist-platform run build

# ── Runner ───────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Install wget for healthchecks
RUN apk add --no-cache wget

ENV NODE_ENV=production \
    PORT=8080

# API server bundle (self-contained — no node_modules required)
COPY --from=builder /app/artifacts/api-server/dist ./dist

# Frontend static files — Express serves them at / in production mode
COPY --from=builder /app/artifacts/artist-platform/dist/public ./public

# Uploads directory (videos uploaded at runtime)
RUN mkdir -p uploads

EXPOSE 8080

# Run as non-root for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app
USER appuser

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]