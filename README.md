<p align="center">
  <strong>CREATOR HUB</strong>
</p>

<p align="center">
  Marketplace premium de vídeos personalizados conectando artistas de elite com clientes corporativos.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-gold" alt="MIT License" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/PostgreSQL-Supabase-3FCF8E?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/pnpm-Monorepo-F69220?logo=pnpm&logoColor=white" alt="pnpm" />
</p>

---

## Visão Geral

**CreatorHub** é uma plataforma full-stack para artistas que vendem vídeos personalizados. O sistema oferece um portal completo onde artistas gerenciam pedidos, portfólio, clientes, avaliações e contratos — enquanto um painel SuperAdmin permite o controle total da plataforma.

A arquitetura multi-tenant garante isolamento de dados por artista, combinando enforcement em nível de aplicação com PostgreSQL Row-Level Security (RLS) como defesa em profundidade. A autenticação é feita via Clerk (Google/social login), e os pagamentos são processados pelo gateway Asaas (PIX, Boleto e Cartão de Crédito).

---

## Funcionalidades

### SuperAdmin (`/admin/*`)
- Dashboard com métricas da plataforma: total de artistas, pedidos, receita e clientes
- Gestão de artistas: buscar, suspender (com motivo), ativar e deletar
- Visão cross-tenant de todos os pedidos com paginação
- Bootstrap do primeiro admin via `POST /api/users/bootstrap-admin`

### Artista (`/dashboard`, `/orders`, `/media`, etc.)
- Dashboard com gráfico de ganhos, estatísticas e alternância de disponibilidade
- Gestão de pedidos com máquina de estados e alertas de urgência
- Detalhe do pedido com checkout Asaas integrado (PIX / Boleto / Cartão)
- CRM de clientes: listagem, detalhe com histórico de pedidos, adicionar/editar clientes
- Portfólio de mídia: upload drag-and-drop de vídeos (MP4/MOV/AVI, até 50MB)
- Perfil inline editável com categorias, tags e disponibilidade
- Página de avaliações com gráfico de estrelas
- Contratos digitais

### Cliente / Público
- Página pública do artista (`/p/:artistId`)
- Checkout integrado com múltiplos métodos de pagamento
- Onboarding guiado para novos artistas

---

## Arquitetura

### Estrutura do Monorepo

```
creatorhub/
├── artifacts/
│   ├── api-server/            # Backend — Express 5 + Drizzle ORM
│   │   ├── src/
│   │   │   ├── routes/        # Rotas REST (clients, orders, admin, etc.)
│   │   │   ├── middlewares/   # Auth, CORS, rate limiting, Clerk proxy
│   │   │   └── lib/           # Logger (Pino), rate limiters
│   │   └── build.mjs          # Bundle esbuild para produção
│   └── artist-platform/       # Frontend — React 19 + Vite 7
│       ├── src/
│       │   ├── pages/         # Dashboard, Orders, Media, Profile, Admin...
│       │   ├── components/    # UI (shadcn/ui), Layout, Admin Layout
│       │   ├── contexts/      # ThemeContext
│       │   └── hooks/         # useCurrentUser e outros
│       └── vite.config.ts
├── lib/
│   ├── api-spec/              # OpenAPI spec + Orval codegen
│   ├── api-zod/               # Schemas Zod gerados automaticamente
│   ├── api-client-react/      # React Query hooks gerados + customFetch
│   └── db/                    # Drizzle ORM schema, pool pg, Supabase client
├── scripts/                   # Scripts utilitários (check-clerk, drizzle query, etc.)
├── supabase/                  # Configuração Supabase
├── Dockerfile                 # Multi-stage: builder → runner (Alpine)
├── docker-compose.yml         # Serviço app + volume uploads
├── render.yaml                # Blueprint Render: API (Docker) + PostgreSQL
└── render-frontend.yaml       # Blueprint Render: Frontend (Static Site)
```

### Modelo Multi-Tenant

O isolamento é feito em três camadas:

| Camada | Estratégia |
|--------|-----------|
| **Aplicação** | Todas as queries incluem `WHERE tenant_id = req.artistId` (bypass para superadmin) |
| **Schema** | Colunas `artist_id`/`tenant_id` em todas as tabelas de dados do tenant |
| **Database (RLS)** | Políticas PostgreSQL RLS usando variável de sessão `app.clerk_user_id` |

### Perfis de Usuário

| Role | Descrição |
|------|-----------|
| `superadmin` | Dono da plataforma — vê todos os dados, gerencia todos os tenants, analytics |
| `artist` | Dono do workspace — gerencia seus pedidos, mídia, reviews, clientes, perfil |
| `client` | Registrado como `tenant_clients` — sem login próprio nesta fase |

### Fluxo de Autenticação

```
Usuário faz login com Clerk (Google/email)
        │
        ▼
  Middleware requireAuth
  Clerk session → platform_users lookup (clerk_user_id)
        │
        ├── Não encontrado → 403 + needsOnboarding → /onboarding
        │
        ▼
  Role = artist  →  req.tenantId = platform_users.tenantId
  Role = superadmin →  req.isSuperAdmin = true (sem restrição de tenant)
```

### Máquina de Estados dos Pedidos

```
  ┌───────────┐     ┌──────────────────┐     ┌──────┐
  │ PROPOSED  │────▶│ PAYMENT_PENDING  │────▶│ PAID │
  └─────┬─────┘     └────────┬─────────┘     └──┬───┘
        │                    │                   │
        │                    ▼                   ▼
        │              ┌──────────┐        ┌─────────────┐
        │              │ (volta)  │        │ IN_PROGRESS │
        │              └──────────┘        └──┬──────┬───┘
        │                                    │      │
        ▼                                    ▼      ▼
  ┌────────────┐                       ┌───────────┐  ┌────────────┐
  │ CANCELLED  │◀──────────────────────│ DELIVERED │  │ CANCELLED  │
  └────────────┘                       └───────────┘  └────────────┘
```

---

## Stack Tecnológico

| Camada | Tecnologias |
|--------|------------|
| **Frontend** | React 19 · Vite 7 · Tailwind CSS 4 · shadcn/ui · TanStack React Query · Wouter · Framer Motion · Recharts |
| **Backend** | Express 5 · Drizzle ORM · PostgreSQL (Supabase) · Clerk Express · Helmet · Pino · Multer · Zod |
| **Pagamentos** | Asaas (PIX, Boleto, Cartão de Crédito) |
| **Infraestrutura** | Docker (Node 22 Alpine) · Render (Blueprint) · Supabase |
| **Ferramentas** | pnpm 9 Workspaces · Orval (OpenAPI → Zod + React Query Hooks) · TypeScript 5.9 · esbuild |

---

## Início Rápido

### Pré-requisitos

- **Node.js** 22+
- **pnpm** 9+
- **PostgreSQL** (via Supabase ou local)
- **Docker** (opcional, para containerização)

### 1. Clone o repositório

```bash
git clone https://github.com/micheltechEr/creatorhub.git
cd creatorhub
```

### 2. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Preencha as variáveis no `.env`. Veja a tabela de [Variáveis de Ambiente](#variáveis-de-ambiente) abaixo.

### 3. Instale as dependências

```bash
pnpm install
```

### 4. Execute o codegen (OpenAPI → Zod + Hooks)

```bash
pnpm --filter @workspace/api-spec run codegen
```

### 5. Rode em modo desenvolvimento

```bash
# API + Frontend em paralelo
pnpm dev

# Ou individualmente:
pnpm dev:api     # Somente API (porta 8080)
pnpm dev:front   # Somente Frontend (Vite)
```

---

## Docker

O projeto inclui um `Dockerfile` multi-stage otimizado para produção:

```bash
# Build e run com Docker Compose
pnpm docker:dev    # Desenvolvimento com hot-reload
pnpm docker:up     # Produção em background
pnpm docker:down   # Parar containers
pnpm docker:logs   # Ver logs
```

- **Base**: `node:22-alpine`
- **Builder**: instala dependências, roda codegen, build API (esbuild) + Frontend (Vite)
- **Runner**: cópia mínima — bundle API + arquivos estáticos do frontend
- **Porta**: 8080
- **Healthcheck**: `GET /api/healthz`

---

## Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `pnpm dev` | Rode API + Frontend em paralelo |
| `pnpm dev:api` | Rode somente o servidor API |
| `pnpm dev:front` | Rode somente o frontend |
| `pnpm build` | Typecheck + build de todos os pacotes |
| `pnpm build:api` | Build somente do servidor API |
| `pnpm build:front` | Build somente do frontend |
| `pnpm start` | Inicie o servidor API (produção) |
| `pnpm typecheck` | Typecheck completo do monorepo |
| `pnpm docker:dev` | Docker Compose com hot-reload |
| `pnpm docker:up` | Docker Compose em background |
| `pnpm --filter @workspace/api-spec run codegen` | Regenere Zod + React Query hooks |

---

## Variáveis de Ambiente

Veja [`.env.example`](.env.example) para o template completo.

| Variável | Serviço | Descrição |
|----------|---------|-----------|
| `DATABASE_URL` | Supabase | Connection string PostgreSQL (porta 5432 ou 6543) |
| `SUPABASE_URL` | Supabase | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | Supabase | Chave anônima do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Chave service role (backend only) |
| `VITE_SUPABASE_URL` | Supabase (Frontend) | URL do Supabase para o Vite |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase (Frontend) | Chave publishable para o Vite |
| `JWT_SECRET` | Auth | Secret para JWT (gerar com `openssl rand -hex 64`) |
| `REFRESH_SECRET` | Auth | Secret para refresh tokens |
| `CLERK_SECRET_KEY` | Clerk | Chave secreta do Clerk ([Dashboard](https://dashboard.clerk.com)) |
| `CLERK_PUBLISHABLE_KEY` | Clerk | Chave pública do Clerk |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk (Frontend) | Chave pública do Clerk para o Vite |
| `ASAAS_API_KEY` | Asaas | API key do gateway de pagamentos ([Developer](https://www.asaas.com/developer)) |
| `ASAAS_ENV` | Asaas | `sandbox` ou `production` |
| `CORS_ORIGIN` | CORS | URL do frontend permitida |
| `VITE_API_BASE_URL` | Frontend | URL base da API para o frontend |
| `PORT` | Servidor | Porta do servidor (padrão: 8080) |
| `NODE_ENV` | Servidor | `development` ou `production` |

---

## Deploy (Produção)

### Render (Recomendado)

O projeto inclui Blueprints prontos para deploy no [Render](https://render.com):

1. **API + PostgreSQL** — use `render.yaml`:
   - Conecte o repositório no Render Dashboard → "New" → "Blueprint"
   - O Render provisiona PostgreSQL automaticamente via `serviceLink`
   - Configure as variáveis secretas no Dashboard (Environment → Secret Files)

2. **Frontend (Static Site)** — use `render-frontend.yaml`:
   - Crie um Static Site vinculado ao mesmo repositório
   - Build automático com pnpm + Vite
   - SPA fallback configurado

**Região**: São Paulo (`sa-paulo`)

### Docker (Qualquer VPS)

```bash
# Build a imagem
docker compose build

# Subir em background
docker compose up -d

# Verificar health
curl http://localhost:8080/api/healthz
```

---

## Endpoints da API

Todas as rotas da API são prefixadas com `/api`.

### Auth & Users

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/users/bootstrap-from-clerk` | Auto-registra Clerk user no banco |
| `POST` | `/users/bootstrap-admin` | Promove primeiro usuário a superadmin |
| `GET` | `/users/me` | Retorna perfil e role do usuário logado |

### Admin (superadmin only)

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/admin/stats` | Métricas da plataforma |
| `GET` | `/admin/artists` | Lista todos os artistas com stats |
| `PATCH` | `/admin/artists/:id/suspend` | Suspender artista (com motivo) |
| `PATCH` | `/admin/artists/:id/activate` | Reativar artista |
| `DELETE` | `/admin/artists/:id` | Deletar artista permanentemente |
| `GET` | `/admin/orders` | Todos os pedidos cross-tenant |

### Clients / CRM (artist only)

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/clients` | Listar clientes do artista (com busca) |
| `GET` | `/clients/:id` | Detalhe do cliente + histórico de pedidos |
| `POST` | `/clients` | Criar cliente manualmente |
| `PUT` | `/clients/:id` | Atualizar notas/telefone do cliente |
| `DELETE` | `/clients/:id` | Remover cliente |

### Orders, Payments, Media, Reviews

Endpoints tenant-scoped com isolamento por `artist_id`. Detalhes disponíveis no spec OpenAPI (`lib/api-spec`).

### Health

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/healthz` | Healthcheck (usado pelo Docker e Render) |

---

## Segurança (OWASP)

| Medida | Descrição |
|--------|-----------|
| **Helmet** | CSP, HSTS, X-Content-Type-Options e outros headers de segurança |
| **CORS** | Allowlist de origens configurável |
| **Rate Limiting** | Limiter global + por rota (express-rate-limit) |
| **Validação** | Zod em todas as rotas da API |
| **Path Traversal** | Proteção em uploads de arquivos |
| **Ownership Checks** | Verificação de posse do artista em mutações |
| **Webhook Validation** | Validação de token em webhooks do Asaas |
| **RLS (PostgreSQL)** | Políticas Row-Level Security como defesa em profundidade |
| **SuperAdmin Guard** | Middleware `requireSuperAdmin` com verificação no banco (não Clerk metadata) |
| **Body Size Limit** | JSON e URL-encoded limitados a 1MB |
| **Non-root Docker** | Container roda como usuário não-root |

---

## Identidade Visual

| Elemento | Valor |
|----------|-------|
| **Black Pro** | `#0A0A0A` |
| **Gold Standard** | `#C9A961` |
| **Off White** | `#F8F8F8` |
| **Fonte Body** | Plus Jakarta Sans |
| **Fonte Headings** | Crimson Text |
| **Idioma da UI** | Português (pt-BR) |
| **Estilo** | Minimalista, corporativo, sofisticado |

---

## Licença

Este projeto está sob a licença **MIT**. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.