# Quiz App — Developer Reference

> React 18 + Vite · Node.js + Express · PostgreSQL · Docker · Caddy · Google Cloud

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Project Structure](#2-project-structure)
3. [Database](#3-database)
4. [API Reference](#4-api-reference)
5. [Frontend Architecture](#5-frontend-architecture)
6. [Local Development](#6-local-development)
7. [Environment Variables](#7-environment-variables)
8. [Docker & Production Build](#8-docker--production-build)
9. [Google Cloud Deployment](#9-google-cloud-deployment)
10. [Common Extension Points](#10-common-extension-points)

---

## 1. Project Overview

A minimal quiz application built for a live interview demo. No users, no authentication. The visitor loads a quiz, selects one answer per question, submits, and gets a scored breakdown back. The React frontend is a SPA served by the same Express process in production.

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite 5 |
| API | Node.js 20 + Express 4 |
| Database | PostgreSQL 16 + `pg` driver |
| Containerisation | Docker + Docker Compose |
| Reverse Proxy | Caddy 2 (auto TLS) |
| Hosting | Google Compute Engine (`e2-small`) |

**Why this stack for the demo:**
- One repo, one `docker compose up` — nothing to misconfigure between services
- Express route → handler → JSON response is easy to walk through out loud
- Vite proxy means zero CORS config during development
- If something breaks, there are two places to look: `server/` and `client/src/`

---

## 2. Project Structure

```
quiz-app/
├── server/
│   ├── index.js              ← Entry: migrates DB, seeds data, starts Express
│   ├── package.json
│   ├── data/
│   │   ├── db.js             ← pg connection pool (reads DATABASE_URL)
│   │   └── init.js           ← Idempotent migrate + seed (runs every startup)
│   └── routes/
│       └── quiz.js           ← GET /api/quiz, POST /api/quiz/submit
├── client/
│   ├── index.html            ← Loads Google Fonts (Syne + DM Sans)
│   ├── vite.config.js        ← Proxies /api → :3001 in dev
│   ├── package.json
│   └── src/
│       ├── main.jsx          ← React root mount
│       ├── App.jsx           ← Top-level state: holds results, swaps views
│       ├── api.js            ← fetchQuiz() / submitQuiz() fetch wrappers
│       ├── index.css         ← Global design tokens, glass panel, animations
│       ├── components/
│       │   ├── Spinner.jsx
│       │   └── Spinner.module.css
│       └── pages/
│           ├── QuizPage.jsx + QuizPage.module.css
│           └── ResultsPage.jsx + ResultsPage.module.css
├── caddy/
│   └── Caddyfile
├── Dockerfile                ← Multi-stage: Vite build → Express runtime
├── docker-compose.yml        ← db + app + caddy
└── .gitignore
```

**Key points:**
- All CSS uses scoped **CSS Modules** (`*.module.css`) per component. The only global CSS lives in `index.css` (design tokens + animations). Never add component styles to `index.css`.
- There is no routing library. `App.jsx` conditionally renders `<QuizPage>` or `<ResultsPage>` based on a single piece of state.
- In production, Express serves the Vite build as static files and falls back to `index.html` for any non-API route (SPA support).

---

## 3. Database

### 3.1 Schema

```sql
quizzes
  id    UUID PRIMARY KEY
  title TEXT NOT NULL

questions
  id          UUID    PRIMARY KEY
  quiz_id     UUID    FK → quizzes.id ON DELETE CASCADE
  text        TEXT    NOT NULL
  options     JSONB   NOT NULL   -- string[] stored as a JSON array
  answer      INTEGER NOT NULL   -- zero-based correct option index
  order_index INTEGER NOT NULL
```

> **Note:** The `answer` column is **never returned by the API**. Only the `POST /api/quiz/submit` handler reads it server-side to grade submissions.

### 3.2 Migrations and Seeding

There is no migration CLI. `server/data/init.js` runs on **every server startup** and is fully idempotent:

- `CREATE TABLE IF NOT EXISTS` — schema is applied once, subsequent runs are no-ops
- Seed check — if any row exists in `quizzes`, seeding is skipped entirely
- Both operations run inside a single transaction — a partial failure rolls back cleanly

> **Tip:** To reset the database during development:
> ```bash
> docker compose down -v   # -v removes the postgres_data volume
> docker compose up --build
> ```

### 3.3 Adding Questions

Edit the `questions` array in `server/data/init.js`:

```js
{ text: 'Question text here',
  options: ['Option A', 'Option B', 'Option C', 'Option D'],
  answer: 0,          // zero-based index of the correct option
  order_index: 6 }    // controls display order on the quiz page
```

To apply new questions to an **existing** database without wiping it, connect directly and insert rows:

```bash
docker exec -it quiz-db psql -U quizuser -d quizdb
```

---

## 4. API Reference

### `GET /api/quiz`

Returns the first quiz with all its questions ordered by `order_index`. The `answer` field is intentionally excluded from the response.

**Response:**
```json
{
  "id": "uuid",
  "title": "General Knowledge Quiz",
  "questions": [
    {
      "id": "uuid",
      "text": "What is the capital of France?",
      "options": ["Berlin", "Madrid", "Paris", "Rome"],
      "orderIndex": 0
    }
  ]
}
```

### `POST /api/quiz/submit`

Grades submitted answers server-side and returns a full breakdown. The client never has access to correct answers before submitting.

**Request body:**
```json
{
  "answers": {
    "<questionId-uuid>": 2,
    "<questionId-uuid>": 0
  }
}
```

**Response:**
```json
{
  "score": 4,
  "total": 6,
  "percentage": 67,
  "results": [
    {
      "questionId": "uuid",
      "questionText": "What is the capital of France?",
      "options": ["Berlin", "Madrid", "Paris", "Rome"],
      "correct": true,
      "selectedAnswer": 2,
      "correctAnswer": 2
    }
  ]
}
```

> **Note:** If a question's ID is missing from the submitted `answers` object, `selectedAnswer` is `null` and `correct` is `false`. The server never throws — it scores what it receives.

---

## 5. Frontend Architecture

### 5.1 State Flow

`App.jsx` holds a single `results` state value — this is the entire routing mechanism:

```jsx
// App.jsx
return results
  ? <ResultsPage results={results} onRetry={() => setResults(null)} />
  : <QuizPage    onResults={setResults} />;
```

- `results === null` → renders `<QuizPage>`
- `results === object` → renders `<ResultsPage>`

No `react-router-dom`, no URL changes. Good enough for a two-view demo.

> **Note:** If you add a third view (e.g. a quiz selection screen), add `react-router-dom` v6 with `createBrowserRouter` rather than stacking more state branches in `App.jsx`.

### 5.2 Data Fetching

All API calls live in `src/api.js`. Both functions throw on non-OK responses so callers can catch and set an error state:

```js
// api.js
export async function fetchQuiz() {
  const res = await fetch('/api/quiz');
  if (!res.ok) throw new Error('Failed to load quiz.');
  return res.json();
}

export async function submitQuiz(answers) {
  const res = await fetch('/api/quiz/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  });
  if (!res.ok) throw new Error('Failed to submit quiz.');
  return res.json();
}
```

> **Tip:** In dev, Vite's proxy (`vite.config.js`) forwards `/api/*` to `http://localhost:3001` — no CORS headers needed. In production, Express serves both the API and the built React files from the same origin, so CORS doesn't apply there either.

### 5.3 Answer Tracking

`QuizPage` stores answers in a plain object keyed by question UUID:

```js
const [answers, setAnswers] = useState({});
// { '<uuid>': 2, '<uuid>': 0, ... }

function selectAnswer(questionId, optionIndex) {
  setAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
}
```

This object is sent as-is in the POST body. The submit button stays disabled until `Object.keys(answers).length === total`.

### 5.4 CSS Architecture

Two layers:

| Layer | File(s) | Purpose |
|---|---|---|
| Global | `src/index.css` | CSS variables (design tokens), `.glass` utility class, `@keyframes`. **Do not add component styles here.** |
| Scoped | `*.module.css` | One file per component/page. Vite hashes class names at build time — no class name collisions possible. |

**Key design tokens:**

```css
:root {
  --bg:            #05080e;              /* page background */
  --accent:        #38bdf8;             /* cyan primary */
  --accent-dim:    rgba(56,189,248,0.10);
  --accent-glow:   rgba(56,189,248,0.22);
  --correct:       #10b981;
  --danger:        #f87171;
  --text:          #e8eef4;
  --text-muted:    #4e6070;
  --surface:       rgba(255,255,255,0.04);
  --border:        rgba(255,255,255,0.08);
  --border-accent: rgba(56,189,248,0.30);
}
```

**Glass panel pattern** (applied via the `.glass` class from `index.css`):

```css
.glass {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}
```

> **Note:** Fonts (`Syne` + `DM Sans`) are loaded from Google Fonts in `index.html`. If internet access is unavailable, both fall back to `system-ui`.

---

## 6. Local Development

### Option A — Full stack with Docker Compose

Closest to production. All three services (`db`, `app`, `caddy`) run together.

```bash
# Switch Caddyfile to :80 mode first (uncomment the :80 block, comment out the domain block)
docker compose up --build
# Visit http://localhost
```

### Option B — Services separately (fastest iteration)

Run Postgres in Docker, then the server and Vite natively for hot reload.

**Terminal 1 — Postgres:**
```bash
docker run --rm \
  -e POSTGRES_DB=quizdb \
  -e POSTGRES_USER=quizuser \
  -e POSTGRES_PASSWORD=quizpass \
  -p 5432:5432 \
  postgres:16-alpine
```

**Terminal 2 — Express API:**
```bash
cd server
npm install
node --watch index.js   # --watch = auto-restart on file change (Node 18+, no nodemon needed)
# Migrates and seeds automatically on first start
# API available at http://localhost:3001
```

**Terminal 3 — Vite dev server:**
```bash
cd client
npm install
npm run dev
# http://localhost:5173
# /api/* is proxied to :3001 automatically
```

---

## 7. Environment Variables

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3001` | Express listening port |
| `NODE_ENV` | `development` | Set to `production` in `docker-compose.yml`. Controls static file serving and CORS. |
| `DATABASE_URL` | `postgresql://quizuser:quizpass@localhost:5432/quizdb` | Full Postgres connection string. In Docker the host is `db` (service name). |
| `CLIENT_ORIGIN` | `http://localhost:5173` | CORS allowed origin. Only used when `NODE_ENV` is not `production`. |

> **Note:** Change the Postgres password in `docker-compose.yml` before any public deployment. The DB is never exposed outside the Docker network, but it is good practice.

`appsettings` equivalent for local dev without Docker — just set `DATABASE_URL` in your shell or create a `.env` file (add it to `.gitignore`):

```bash
export DATABASE_URL="postgresql://quizuser:quizpass@localhost:5432/quizdb"
```

---

## 8. Docker & Production Build

### 8.1 Multi-Stage Dockerfile

The `Dockerfile` has two stages:

1. **Build stage** — installs all client deps, runs `vite build`, outputs to `/app/client/dist`
2. **Runtime stage** — installs server prod deps only (`--omit=dev`), copies `/app/client/dist` into `server/public`, runs `node index.js`

In production (`NODE_ENV=production`), `server/index.js` automatically:
- Serves `./public` as static files via `express.static`
- Returns `index.html` for any non-API route (`app.get('*', ...)`) — enables client-side navigation

### 8.2 Docker Compose Services

| Service | Image | Notes |
|---|---|---|
| `db` | `postgres:16-alpine` | Has a `healthcheck` (`pg_isready`). Only marked healthy when DB is accepting connections. |
| `app` | Built from `Dockerfile` | `depends_on: db: condition: service_healthy` — guaranteed to wait for DB readiness. No restart race condition. |
| `caddy` | `caddy:2-alpine` | Only service with exposed ports (`80`, `443`). Provisions TLS via Let's Encrypt automatically on first request. |

### 8.3 Useful Commands

```bash
# Build and start all services in the background
docker compose up -d --build

# Stream logs from the app
docker compose logs -f app

# Rebuild only the app container (after code changes)
docker compose up -d --build app

# Reset everything including the database volume
docker compose down -v

# Open a psql shell to the running DB
docker exec -it quiz-db psql -U quizuser -d quizdb
```

---

## 9. Google Cloud Deployment

### 9.1 Create VM

```bash
gcloud compute instances create quiz-app \
  --machine-type=e2-small \
  --image-family=debian-12 \
  --image-project=debian-cloud \
  --tags=http-server,https-server \
  --zone=asia-southeast1-b
```

> **Note:** `e2-small` (2 GB RAM) is recommended. `e2-micro` is free-tier eligible but may OOM during the `npm install` step inside the Docker build.

### 9.2 Open Firewall Ports

```bash
gcloud compute firewall-rules create allow-http  --allow tcp:80  --target-tags http-server
gcloud compute firewall-rules create allow-https --allow tcp:443 --target-tags https-server
```

Skip if these rules already exist from another project.

### 9.3 Install Docker on VM

```bash
gcloud compute ssh quiz-app --zone=asia-southeast1-b

# Inside the VM:
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

### 9.4 Deploy

```bash
# From your local machine — copy the project to the VM:
gcloud compute scp --recurse ./quiz-app quiz-app:~ --zone=asia-southeast1-b

# SSH in and bring it up:
gcloud compute ssh quiz-app --zone=asia-southeast1-b
cd quiz-app
docker compose up -d --build
```

### 9.5 Point Your Domain

```bash
# Get the VM's external IP:
gcloud compute instances describe quiz-app \
  --zone=asia-southeast1-b \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)'
```

1. Add an `A` record for `quiz.yourdomain.com` pointing to that IP
2. Update `caddy/Caddyfile` — replace the `:80` block with your actual domain:
   ```
   quiz.yourdomain.com {
       reverse_proxy app:3001
   }
   ```
3. Redeploy: `docker compose up -d --build`

Caddy provisions the TLS certificate on the first request — no certbot, no manual steps.

### 9.6 Updating After Code Changes

```bash
# Push updated code to VM:
gcloud compute scp --recurse ./quiz-app quiz-app:~ --zone=asia-southeast1-b

# SSH in and rebuild:
gcloud compute ssh quiz-app --zone=asia-southeast1-b
cd quiz-app && docker compose up -d --build
```

> **Note:** Database migrations and seeding run automatically on every startup. Deploys are zero-additional-steps — just build and restart.

---

## 10. Common Extension Points

### Adding a New API Route

1. Create a new file in `server/routes/` and export a `Router`
2. Mount it in `server/index.js`:
   ```js
   import newRouter from './routes/new.js';
   app.use('/api', newRouter);
   ```
3. Add a corresponding fetch wrapper to `client/src/api.js`

### Adding a New Page/View

1. Create `client/src/pages/NewPage.jsx` and `NewPage.module.css`
2. Add a new state branch in `App.jsx` to conditionally render it
3. If navigation grows beyond 2–3 views, install `react-router-dom` v6 with `createBrowserRouter`

### Supporting Multiple Quizzes

- Add `GET /api/quizzes` — returns all quiz IDs + titles
- Update `GET /api/quiz` to accept an `?id=` query param
- Update `POST /api/quiz/submit` to accept `quizId` in the body
- Add a quiz selection page in the client

### Adding Authentication

- Install `express-session` + `connect-pg-simple` for server-side sessions
- Add a `users` table and `POST /api/login` / `POST /api/logout` routes
- Add session middleware before quiz routes
- Add a login page and redirect logic in `App.jsx`

### Swapping the Database

The `pg` driver is used directly (no ORM). To swap to a different DB:
- Replace `server/data/db.js` with a new connection pool
- Rewrite `server/data/init.js` with the target DB's DDL
- Update `server/routes/quiz.js` queries

---

*Quiz App Developer Reference — built to run alongside Claude Code*
