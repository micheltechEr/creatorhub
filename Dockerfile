# =============================================================================
# CREATOR HUB — Multi-stage Docker build (Render / Docker Compose)
# Base: node:22-alpine (Node.js 22 LTS)
# Multi-stage: builder installs + builds, runner copies only what's needed
# =============================================================================

# ── Shared base ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS base
# Pin pnpm@9 — evita problemas com pnpm@11 (node:sqlite, onlyBuiltDependencies)
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# ── Builder ──────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

# Vite variáveis de ambiente (substituídas em tempo de build)
# Docker-compose passa via build.args; valores padrão evitam undefined
ARG VITE_CLERK_PUBLISHABLE_KEY=""
ARG VITE_SUPABASE_URL=""
ARG VITE_SUPABASE_PUBLISHABLE_KEY=""
ARG VITE_API_BASE_URL=""

ENV VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY} \
    VITE_SUPABASE_URL=${VITE_SUPABASE_URL} \
    VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY} \
    VITE_API_BASE_URL=${VITE_API_BASE_URL}

# 1) Copy workspace manifests first (layer cache for pnpm install)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml \
     tsconfig.base.json tsconfig.json .npmrc ./

# 2) Copy only the package.json of each workspace package so pnpm can
#    resolve the workspace graph without invalidating the install cache
#    when source code changes.
COPY lib/api-spec/package.json lib/api-spec/package.json
COPY lib/api-client-react/package.json lib/api-client-react/package.json
COPY lib/api-zod/package.json lib/api-zod/package.json
COPY lib/db/package.json lib/db/package.json
COPY scripts/package.json scripts/package.json
COPY artifacts/api-server/package.json artifacts/api-server/package.json
COPY artifacts/artist-platform/package.json artifacts/artist-platform/package.json

# 3) Install all dependencies (dev deps included — needed for build tools)
RUN pnpm install

# 4) Copy workspace packages needed for the build
COPY lib/ lib/
COPY scripts/ scripts/
COPY artifacts/api-server/ artifacts/api-server/
COPY artifacts/artist-platform/ artifacts/artist-platform/

# 5) Generate Zod schemas + React Query hooks from the OpenAPI spec
RUN pnpm --filter @workspace/api-spec run codegen

# 6) Build the API server — esbuild bundles everything into dist/index.mjs
RUN pnpm --filter @workspace/api-server run build

# 7) Build the React frontend — Vite outputs to artifacts/artist-platform/dist/public
ENV PORT=8080
ENV BASE_PATH=/
RUN pnpm --filter @workspace/artist-platform run build

# ── Runner ───────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

# Install wget for healthchecks
RUN apk add --no-cache wget

ENV NODE_ENV=production \
    PORT=8080

# API server bundle — mantém o mesmo path do builder para que pino/thread-stream
# resolva os workers no caminho correto (esbuild-plugin-pino usa paths absolutos)
COPY --from=builder /app/artifacts/api-server/dist ./artifacts/api-server/dist

# Frontend static files — Express serves them at / in production mode
COPY --from=builder /app/artifacts/artist-platform/dist/public ./public

# Uploads directory (videos uploaded at runtime)
RUN mkdir -p uploads

EXPOSE 8080

# Run as non-root for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app
USER appuser

CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]
