# CREATOR HUB

Plataforma premium para artistas que vendem vídeos personalizados para clientes e empresas.

## O que é

O sistema combina:
- **Portal do artista** para gerenciar pedidos, portfólio, clientes, avaliações e contratos
- **Painel SuperAdmin** para controlar artistas, pedidos e métricas da plataforma
- **Backend Express + PostgreSQL** com isolamento multi-tenant e controle de acesso por perfil
- **Autenticação Clerk** para login seguro

## Perfis

- **superadmin**: administra a plataforma inteira
- **artist**: gerencia o próprio tenant, pedidos, clientes, mídia e contratos
- **client**: representado no CRM do artista

## Stack

- React + Vite
- Express 5
- PostgreSQL
- Drizzle ORM
- Clerk
- pnpm workspace

## Como rodar

### 1. Instalar dependências
```bash
pnpm install
```

### 2. Configurar variáveis de ambiente
Você vai precisar de:
- `DATABASE_URL`
- `SESSION_SECRET`
- `CLERK_SECRET_KEY`
- `CLERK_PUBLISHABLE_KEY`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `ASAAS_API_KEY`

### 3. Rodar o projeto
```bash
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/artist-platform run dev
```

## Acesso

- API: `/api`
- App web: `/`

## Deploy

A aplicação já possui configuração base para deploy do backend e do frontend no Render.
