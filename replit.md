# CREATOR HUB Platform

A full-stack marketplace for artists who create custom personalized videos.

## Architecture

### Services

| Service | Port | Path |
|---------|------|------|
| API Server (`@workspace/api-server`) | 8080 | `/api` |
| Artist Platform (`@workspace/artist-platform`) | dynamic | `/` |

### Key Libraries
- `lib/api-spec` — OpenAPI spec (`openapi.yaml`) + Orval codegen config
- `lib/api-zod` — Generated Zod validation schemas
- `lib/api-client-react` — Generated React Query hooks + `customFetch`
- `lib/db` — Drizzle ORM schema + migrations

## Multi-Tenant Architecture (Hybrid RLS + Logical Schema)

### Roles
| Role | Powers |
|------|--------|
| `superadmin` | Platform owner — sees ALL data, manages all tenants (artists), platform analytics, can suspend/activate/delete artists |
| `artist` | Tenant owner — manages their own workspace: orders, media, reviews, clients, profile, dashboard |
| `client` | (future) — tracked as `tenant_clients` records; no login required at this stage |

### Tables
- `platform_users` — Clerk-backed users with roles; `tenant_id → artists.id` for artist role
- `artists` — Tenant profile/workspace (formerly just "artists")
- `tenant_clients` — CRM table: clients managed by each artist; auto-populated from orders
- `orders`, `payments`, `media`, `reviews` — tenant-scoped via `artist_id` FK

### Isolation Strategy
- **Primary**: Application-level enforcement — all DB queries include `WHERE tenant_id = req.artistId` (or superadmin bypass)
- **Secondary (defense-in-depth)**: PostgreSQL RLS policies on all tenant tables using `app.clerk_user_id` session variable
- **Schema-level**: Logical separation via `artist_id`/`tenant_id` columns on every tenant-owned table

### Auth Flow
1. User signs in with Clerk (Google or email)
2. `requireAuth` middleware: Clerk session → `platform_users` lookup by `clerkUserId`
3. If not found → 403 + `needsOnboarding: true` → frontend redirects to `/onboarding`
4. Artist role → `req.artistId = req.tenantId = platform_users.tenantId`
5. SuperAdmin role → `req.isSuperAdmin = true`, no tenant restriction

### SuperAdmin Bootstrap
- First user can self-promote via `POST /api/users/bootstrap-admin` (locked once a superadmin exists)
- Or: `UPDATE platform_users SET role='superadmin', tenant_id=NULL WHERE email='admin@example.com'`

## Authentication (Clerk)
- Clerk (Replit-managed) handles identity
- Social login: Google (enabled)
- New users → `/onboarding` → `POST /api/artists/onboard` creates both `artists` + `platform_users` records
- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` auto-provisioned
- Frontend: `ClerkProvider` + `ClerkTokenBridge` injects Clerk JWT as Bearer for all API calls
- `customFetch` (from `lib/api-client-react`) auto-injects Bearer token

## Role-Based Routing (Frontend)
| Path | Guard | Accessible by |
|------|-------|--------------|
| `/admin` | `AdminGate` | superadmin only |
| `/admin/artists` | `AdminGate` | superadmin only |
| `/admin/orders` | `AdminGate` | superadmin only |
| `/dashboard` | `ProfileGate` | artist only |
| `/orders`, `/media`, `/profile`, `/reviews` | `ProfileGate` | artist only |
| `/clients` | `ProfileGate` | artist only (CRM view) |
| `/onboarding`, `/sign-in`, `/sign-up`, `/p/:artistId` | public | anyone |

## Features

### SuperAdmin Panel (`/admin/*`)
- **Dashboard** — Platform-wide stats: total artists, orders, revenue, clients; recent sign-ups
- **Artistas** — Full artist list with search; suspend (with reason) / activate / delete actions
- **Todos os Pedidos** — Cross-tenant order view with pagination

### Artist Dashboard (`/dashboard`, etc.)
- **Dashboard** — Earnings chart, stats, recent orders, availability toggle
- **Pedidos** — Order list + status filter; urgency alerts
- **Pedido Detail** — State machine UI, Asaas checkout (PIX/Boleto/Credit Card)
- **Clientes** — CRM: list all clients, view client detail + order history, add/edit clients
- **Portfólio** — Drag-and-drop video upload (50MB max, MP4/MOV/AVI)
- **Perfil** — Inline editing, categories, tags, availability toggle
- **Avaliações** — Star rating chart, review list

### Backend (`artifacts/api-server`)
- `GET /users/me` — Current user role + profile
- `POST /users/bootstrap-admin` — Self-promote to superadmin (first user only)
- `GET /admin/stats` — Platform analytics (superadmin)
- `GET /admin/artists` — All artists with stats (superadmin)
- `PATCH /admin/artists/:id/suspend` — Suspend tenant (superadmin)
- `PATCH /admin/artists/:id/activate` — Re-activate tenant (superadmin)
- `DELETE /admin/artists/:id` — Permanently remove tenant (superadmin)
- `GET /admin/orders` — All orders across tenants (superadmin)
- `GET /clients` — Artist's client CRM list
- `GET /clients/:id` — Client detail + order history
- `POST /clients` — Manually add a client
- `PUT /clients/:id` — Update client notes/phone
- `DELETE /clients/:id` — Remove a client record
- Artist, Orders, Payments, Media, Reviews — tenant-isolated (unchanged endpoints)

### Database Schema (PostgreSQL via Drizzle)
- `platform_users` — All users with roles, clerk_user_id, tenant_id FK
- `artists` — Tenant workspace: profile, pricing, rating, availability, is_active, suspended_at
- `tenant_clients` — CRM: name, email, phone, notes, total_orders, total_spent per tenant
- `orders` — Tenant-scoped orders with state machine
- `payments` — Payment records (Asaas: PIX/Boleto/Credit Card)
- `media` — Uploaded video file metadata
- `reviews` — Client reviews with rating aggregation
- `refresh_tokens` — Legacy (unused after Clerk migration)

## Security (OWASP)
- Helmet (CSP, HSTS), CORS with origin allowlist, global + per-route rate limiters
- Path traversal protection on file uploads, artist ownership checks on mutations
- Asaas webhook token validation
- Input validation via Zod on all routes
- PostgreSQL RLS as defense-in-depth (backed by `app.clerk_user_id` session variable)
- SuperAdmin routes protected by `requireSuperAdmin` middleware (DB role check, NOT Clerk metadata)

## Environment Variables
- `DATABASE_URL` — PostgreSQL connection string
- `CLERK_SECRET_KEY` / `CLERK_PUBLISHABLE_KEY` / `VITE_CLERK_PUBLISHABLE_KEY` — Clerk auth
- `ASAAS_API_KEY` — Asaas sandbox API key for payments
- `SESSION_SECRET` — Session secret
- `PORT` — Assigned per workflow by Replit

## Development Notes
- Run codegen after OpenAPI changes: `pnpm --filter @workspace/api-spec run codegen`
- DB migration: use `psql "$DATABASE_URL" -c "..."` (drizzle-kit push is interactive)
- Never call service ports directly; use `localhost:80` through the shared proxy
- `customFetch` is exported from `lib/api-client-react` for endpoints not in generated hooks
- Use `api.get/post/put/patch/delete` from `@/lib/api` for custom endpoints in the frontend

## Brand
- Black Pro: `#0A0A0A`
- Gold Standard: `#C9A961`
- Off White: `#F8F8F8`
- Fonts: Plus Jakarta Sans (body), Crimson Text (headings)
- UI language: Portuguese (pt-BR)
