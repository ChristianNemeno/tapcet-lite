# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`tapcet-lite` is a minimal full-stack quiz application built as an interview demo. Single quiz, no auth, no user accounts. Flow: load quiz → select answers → submit → view scored results.

## Commands

```bash
# Install dependencies for both workspaces
npm run install:all

# Build (Vite client → tsc server → copy dist to server/public/)
npm run build

# Development with hot reload
npm run dev:server    # Express on :3001 (tsx watch)
npm run dev:client    # Vite on :5173 (proxies /api to :3001)

# Full Docker stack
docker compose up --build

# Reset database (wipes volumes)
docker compose down -v && docker compose up --build
```

No linting or test tooling is configured — the project is intentionally minimal.

## Architecture

**Stack:** React 18 + Vite (client) · Express 4 + Node 20 (server) · PostgreSQL 16 · Docker Compose + Caddy

### Frontend (`client/src/`)

- **No router** — `App.tsx` holds a single `results` state; `null` → `<QuizPage>`, populated → `<ResultsPage>`
- `api.ts` — thin `fetch()` wrappers for the two API endpoints
- CSS Modules for scoped styles; global design tokens and `.glass` utility in `index.css`
- Types mirrored from server in `client/src/types.ts` (kept in sync manually)

### Backend (`server/src/`)

- `index.ts` — Express setup: CORS (dev only), JSON body parsing, `/api` router, static SPA serving + fallback (prod only), error handler
- `routes/quiz.ts` — two routes:
  - `GET /api/quiz` — returns first quiz with questions; **`answer` column is never returned**
  - `POST /api/quiz/submit` — grades answers server-side against the `answer` column, returns score breakdown
- `data/db.ts` — `pg` connection pool, reads `DATABASE_URL`
- `data/init.ts` — idempotent migrations (`CREATE TABLE IF NOT EXISTS`) + seed data run on every startup; skips seeding if any row exists in `quizzes`

### Database Schema

```sql
quizzes   (id UUID PK, title TEXT)
questions (id UUID PK, quiz_id UUID FK, text TEXT, options JSONB, answer INT, order_index INT)
```

`options` is a JSONB array of strings; `answer` is a zero-based index into that array.

### Dev Proxy

Vite proxies `/api/*` → `http://localhost:3001` in development. In production, Express serves both the API and the built SPA from the same origin.

### Docker / Production

Multi-stage `Dockerfile`: client build (Vite) → server build (tsc) → runtime (copies `client/dist` into `server/public/`). Compose starts `db` (postgres:16-alpine with healthcheck), `app` (waits for healthy DB), and `caddy` (reverse proxy; edit `caddy/Caddyfile` to toggle dev `:80` vs. production domain + auto TLS).

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | Express port |
| `NODE_ENV` | `development` | Controls CORS and static serving |
| `DATABASE_URL` | `postgresql://quizuser:quizpass@localhost:5432/quizdb` | Postgres connection |
| `CLIENT_ORIGIN` | `http://localhost:5173` | CORS allowed origin (dev only) |

## Key Reference

`DEVELOPER_REFERENCE.md` contains the full API reference (request/response shapes), deployment instructions (including Google Cloud), and common extension points (new routes, multiple quizzes, auth).
