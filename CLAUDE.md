# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start dev server on http://localhost:3000
pnpm build        # Production build
pnpm typecheck    # TypeScript check (tsc --noEmit)
pnpm lint         # ESLint
pnpm format       # Prettier + ESLint --fix

pnpm db:up        # Start local Postgres via Docker Compose
pnpm db:generate  # Generate Drizzle migrations from schema changes
pnpm db:migrate   # Apply pending migrations to the database
pnpm db:studio    # Open Drizzle Studio (visual DB browser)
pnpm db:push      # Push schema directly (skip migration files — dev only)
```

**Required before first run:** `pnpm db:up && pnpm db:migrate`

**Note:** Docker Desktop must be installed for `db:up`. Alternative: set `DATABASE_URL` in `.env.local` to a hosted Postgres (Neon free tier works).

## Architecture

**Stack:** TanStack Start (React fullstack, Vite) · TanStack Router (file-based) · TanStack DB (Query Collections) · Drizzle ORM + Postgres · Better Auth · Tailwind v4 + shadcn/ui · Zod · @zxing/browser · Open Food Facts API

**Domain:** Pantry inventory with barcode scanning, grocery lists. Recipes/meal planning are a **v2 feature** — the schema is designed to support them without migration changes.

### Data flow
```
Browser → createServerFn (HTTP) → Drizzle → Postgres
         ↕ optimistic via TanStack DB collections
```

Server functions (`src/server/functions/`) handle all DB access. Each function gets the session from Better Auth (`auth.api.getSession()`), scopes queries by `userId`, validates input with Zod.

TanStack DB `queryCollectionOptions` collections (`src/db-collections/`) wrap server functions: the `queryFn` calls a server function on the server; `onInsert`/`onUpdate`/`onDelete` handlers call mutation server functions with automatic optimistic rollback.

The `QueryClient` is a module-level singleton exported from `src/integrations/tanstack-query/root-provider.tsx` — imported by both the router context and the db-collections module.

### Key directories
- `src/routes/` — File-based routes. `__root.tsx` = shell + nav. `api/auth/$.ts` = Better Auth handler.
- `src/server/functions/` — `createServerFn` handlers (food, pantry, grocery, session).
- `src/server/off.ts` — Open Food Facts API fetch + `off_product_cache` table logic.
- `src/db/schema.ts` — All Drizzle table definitions including Better Auth tables.
- `src/db-collections/` — TanStack DB collections (module-level singletons).
- `src/components/pantry/ScanSheet.tsx` — Camera barcode scanner using `@zxing/browser`.
- `src/lib/units.ts` — `Unit` type and helpers shared across schema and UI.

### Auth
Better Auth with email/password. Auth tables (`user`, `session`, `account`, `verification`) are defined in `src/db/schema.ts` and mapped to the drizzle adapter in `src/lib/auth.ts`. The auth API is at `/api/auth/*` via `src/routes/api/auth/$.ts`. Client-side calls use `authClient` from `src/lib/auth-client.ts`.

### Environment variables
See `.env.local` (gitignored) — copy from `.env.example`:
- `DATABASE_URL` — Postgres connection string
- `BETTER_AUTH_SECRET` — generate with `pnpm dlx @better-auth/cli secret`
- `BETTER_AUTH_URL` — app base URL (e.g. `http://localhost:3000`)
- `OFF_USER_AGENT` — identifies app to Open Food Facts API

### v2 compatibility
The `food.defaultUnit` enum, `food.nutritionPer100g` JSONB, and `pantry_item.foodId`/`grocery_list_item.foodId` FKs are all present in MVP specifically to allow `recipe` and `recipe_ingredient` tables to be added in v2 without schema backfills.
