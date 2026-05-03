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

## Test Credentials
- Email: `maria@artistflow.com`
- Password: `password`

## Features

### Frontend (`artifacts/artist-platform`)
- **Login / Register** — JWT-based auth stored in localStorage
- **Dashboard** — Earnings chart (Recharts), stats cards, recent orders, availability toggle
- **Orders** — List with status filter, urgency alerts
- **Order Detail** — Status state machine UI, Asaas checkout form (CPF/CNPJ + billing type selector), PIX QR code display, copia-e-cola copy button, invoice URL link
- **Media Portfolio** — Drag-and-drop video upload (25MB max, MP4/MOV/AVI), delete with confirmation
- **Profile** — Inline editing, category/tag management, availability toggle
- **Reviews** — Star rating distribution chart, review list

### Backend (`artifacts/api-server`)
- **Auth** — bcrypt + JWT access tokens (30min) + refresh tokens (7 days)
- **Artists** — CRUD, availability toggle, profile management
- **Orders** — State machine: PROPOSED → PAYMENT_PENDING → PAID → IN_PROGRESS → DELIVERED → CANCELLED
- **Payments** — Real Asaas sandbox payments (PIX/Boleto/Credit Card); `findOrCreateCustomer` patches CPF/CNPJ on existing customers; PIX QR code fetched post-creation; Asaas webhook updates order/payment state automatically
- **Media** — Multer disk upload, 25MB limit, file serving
- **Reviews** — Create (requires DELIVERED order), list by artist with rating aggregation
- **Dashboard** — Stats, recent orders, monthly earnings aggregation

### Database Schema (PostgreSQL via Drizzle)
- `artists` — Profile, pricing, rating, availability
- `orders` — Full order with state machine status + `client_cpf_cnpj` column (for Asaas)
- `payments` — Payment records linked to orders
- `media` — Uploaded video file metadata
- `reviews` — Client reviews with rating
- `refresh_tokens` — JWT refresh token store

## Environment Variables
- `DATABASE_URL` — PostgreSQL connection string
- `SESSION_SECRET` — JWT signing secret (falls back to `dev-jwt-secret` in dev)
- `PORT` — Assigned per workflow by Replit

## Development Notes
- Run codegen after OpenAPI changes: `pnpm --filter @workspace/api-spec run codegen`
- Drizzle push: `pnpm --filter @workspace/db run db:push`
- Never call service ports directly; use `localhost:80` through the shared proxy
