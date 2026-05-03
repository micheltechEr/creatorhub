# =============================================================================
# ArtistFlow — Multi-stage Docker build
# Final image: node:20-alpine  (~5 MB base)
# No native bindings, no node_modules in the runner — esbuild bundles everything
# =============================================================================

# ── Shared base ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# ── Builder ──────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

# Copy workspace manifests first so Docker can cache the install layer
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml \
     tsconfig.base.json tsconfig.json ./

# Copy only the packages that are needed for the build
COPY lib/ lib/
COPY scripts/ scripts/
COPY artifacts/api-server/ artifacts/api-server/
COPY artifacts/artist-platform/ artifacts/artist-platform/

# Install all dependencies (dev included — needed for build tools)
RUN pnpm install --frozen-lockfile

# Generate Zod schemas + React Query hooks from the OpenAPI spec
RUN pnpm --filter @workspace/api-spec run codegen

# Build the API server — esbuild bundles everything into dist/index.mjs
RUN pnpm --filter @workspace/api-server run build

# Build the React frontend — Vite outputs to artifacts/artist-platform/dist/
RUN pnpm --filter @workspace/artist-platform run build

# ── Runner ───────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080

# API server bundle (self-contained — no node_modules required)
COPY --from=builder /app/artifacts/api-server/dist ./dist

# Frontend static files — Express serves them at / in production mode
COPY --from=builder /app/artifacts/artist-platform/dist ./public

# Uploads directory (videos uploaded at runtime)
RUN mkdir -p uploads

EXPOSE 8080

# Run as non-root for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app
USER appuser

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
