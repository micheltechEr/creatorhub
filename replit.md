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
- `lib/api-client-react` — Generated React Query hooks
- `lib/db` — Drizzle ORM schema + migrations

## Authentication (Clerk)
- Clerk (Replit-managed) replaces the old JWT system
- Social login: Google (enabled); X/Twitter can be enabled via the Auth pane
- New users complete `/onboarding` after their first sign-up to create their artist profile
- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` are auto-provisioned secrets
- `requireAuth` middleware uses `getAuth(req)` from `@clerk/express`, looks up artist by `clerkUserId`
- Frontend: `ClerkProvider` in `App.tsx`, `ClerkTokenBridge` injects Clerk JWT as Bearer token for API calls
- Auth pane in Replit workspace controls login providers and OAuth credentials

## Features

### Frontend (`artifacts/artist-platform`)
- **Sign In / Sign Up** — Clerk-powered pages at `/sign-in` and `/sign-up`, branded dark theme, Google social login
- **Onboarding** — New Clerk users fill in artist profile data (name, email, categories, tags, price, delivery days)
- **Dashboard** — Earnings chart (Recharts), stats cards, recent orders, availability toggle
- **Orders** — List with status filter, urgency alerts
- **Order Detail** — Status state machine UI, Asaas checkout form (CPF/CNPJ + billing type selector), PIX QR code display, copia-e-cola copy button, invoice URL link
- **Media Portfolio** — Drag-and-drop video upload (25MB max, MP4/MOV/AVI), delete with confirmation
- **Profile** — Inline editing, category/tag management, availability toggle
- **Reviews** — Star rating distribution chart, review list

### Backend (`artifacts/api-server`)
- **Auth** — Clerk middleware (`@clerk/express`); `requireAuth` validates Clerk session + looks up artist by `clerkUserId`
- **Artists** — CRUD, availability toggle, profile management; `POST /api/artists/onboard` creates profile for new Clerk users
- **Orders** — State machine: PROPOSED → PAYMENT_PENDING → PAID → IN_PROGRESS → DELIVERED → CANCELLED
- **Payments** — Real Asaas sandbox payments (PIX/Boleto/Credit Card); `findOrCreateCustomer` patches CPF/CNPJ; PIX QR code fetched post-creation; Asaas webhook updates order/payment state
- **Media** — Multer disk upload, 25MB limit, file serving
- **Reviews** — Create (requires DELIVERED order), list by artist with rating aggregation
- **Dashboard** — Stats, recent orders, monthly earnings aggregation

### Database Schema (PostgreSQL via Drizzle)
- `artists` — Profile, pricing, rating, availability, `clerk_user_id` (unique, nullable for legacy rows), `hashed_password` (nullable for social-login users)
- `orders` — Full order with state machine status + `client_cpf_cnpj` column (for Asaas)
- `payments` — Payment records linked to orders
- `media` — Uploaded video file metadata
- `reviews` — Client reviews with rating
- `refresh_tokens` — Legacy JWT refresh token store (unused after Clerk migration)

## Security (OWASP)
- Helmet (CSP, HSTS), CORS with origin allowlist, global + per-route rate limiters
- Path traversal protection on file uploads, artist ownership checks on mutations
- Asaas webhook token validation
- Input validation via Zod on all routes

## Environment Variables
- `DATABASE_URL` — PostgreSQL connection string
- `CLERK_SECRET_KEY` / `CLERK_PUBLISHABLE_KEY` / `VITE_CLERK_PUBLISHABLE_KEY` — Auto-provisioned by Clerk setup
- `ASAAS_API_KEY` — Asaas sandbox API key for payments
- `PORT` — Assigned per workflow by Replit

## Development Notes
- Run codegen after OpenAPI changes: `pnpm --filter @workspace/api-spec run codegen`
- DB migration: use `psql "$DATABASE_URL" -c "..."` (drizzle-kit push is interactive)
- Never call service ports directly; use `localhost:80` through the shared proxy
- To enable X (Twitter) or other social logins: use the Auth pane in the Replit workspace toolbar
