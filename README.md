# 🏎️ F1 TeamBuilder — The 24-0 Challenge

Build your ultimate Formula 1 team through randomized spins across iconic eras and race a full 24-race season. Can you assemble the perfect team and go **24-0**?

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js 15 (App Router)                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Landing  │  │  Draft   │  │  Season  │  │ Leaders  │ │
│  │  Page    │  │  Engine  │  │  Results │  │  board   │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
│  ┌─────────────────────────────────────────────────────┐ │
│  │               API Routes (Server)                    │ │
│  │  /api/auth  /api/draft/spin  /api/draft/select      │ │
│  │  /api/simulate                                      │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
         │                │                │
    ┌────▼────┐    ┌──────▼──────┐   ┌────▼────────────┐
    │  Neon   │    │    Redis    │   │   Simulation    │
    │ Postgres│    │  (Cache +   │   │    Engine       │
    │ (Pooled)│    │ Leaderboard)│   │  (Docker svc)   │
    └─────────┘    └─────────────┘   └─────────────────┘
```

## Tech Stack

| Layer          | Technology                                |
|----------------|-------------------------------------------|
| Frontend       | Next.js 15, React 19, TypeScript           |
| Styling        | Tailwind CSS v4                            |
| Auth           | NextAuth.js v5 (Google + Discord OAuth)    |
| Database       | PostgreSQL via Neon (serverless, pooled)    |
| ORM            | Prisma 7 with Neon adapter                 |
| Cache          | Redis 7 (via Docker Compose)               |
| Simulation     | Standalone Node.js service (Docker)        |
| Testing        | Playwright (E2E)                           |
| CI/CD          | GitHub Actions                             |
| Monitoring     | Sentry                                     |
| Deployment     | Docker (multi-stage) / Vercel              |

## Getting Started

### Prerequisites

- **Node.js** ≥ 20.19.0
- **Docker** & Docker Compose
- **Neon** PostgreSQL account ([neon.tech](https://neon.tech))

### 1. Clone & Install

```bash
git clone <your-repo-url> F1-TeamBuilder
cd F1-TeamBuilder
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Fill in your values in `.env.local`:
- `DATABASE_URL` — Neon **pooled** connection string (ends with `-pooler`)
- `DIRECT_DATABASE_URL` — Neon **direct** connection string (for migrations)
- `REDIS_URL` — `redis://localhost:6379` (default Docker setup)
- `NEXTAUTH_SECRET` — Generate with `openssl rand -base64 32`
- OAuth credentials for Google and/or Discord

### 3. Start Services

```bash
# Start Redis
npm run docker:up

# Push schema to Neon (first time)
npm run db:push

# Start dev server
npm run dev
```

### 4. Open in Browser

Visit [http://localhost:3000](http://localhost:3000)

## Available Scripts

| Script              | Description                              |
|---------------------|------------------------------------------|
| `npm run dev`       | Start development server (Turbopack)     |
| `npm run build`     | Production build                         |
| `npm run start`     | Start production server                  |
| `npm run lint`      | Run ESLint                               |
| `npm run format`    | Format code with Prettier                |
| `npm run typecheck` | TypeScript type checking                 |
| `npm run db:push`   | Push Prisma schema to database           |
| `npm run db:migrate`| Run Prisma migrations                    |
| `npm run db:studio` | Open Prisma Studio                       |
| `npm run test:e2e`  | Run Playwright E2E tests                 |
| `npm run docker:up` | Start Docker services (Redis)            |
| `npm run docker:down`| Stop Docker services                    |

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx            # / — Landing page
│   ├── auth/page.tsx       # /auth — Login/Signup
│   ├── draft/page.tsx      # /draft — Spin Engine
│   ├── season/page.tsx     # /season — Simulation Results
│   ├── leaderboards/page.tsx # /leaderboards — Rankings
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── draft/spin/route.ts
│       ├── draft/select/route.ts
│       └── simulate/route.ts
├── lib/
│   ├── db.ts               # Prisma singleton (Neon pooled)
│   ├── redis.ts            # Redis singleton
│   ├── auth.ts             # NextAuth config
│   └── constants.ts        # Game constants
├── services/
│   ├── draft/              # Draft engine logic
│   ├── simulation/         # Simulation bridge
│   └── leaderboard/        # Leaderboard logic
├── types/
│   └── index.ts            # Shared TypeScript types
└── components/
    └── ui/                 # UI components

services/
└── simulation/             # Standalone simulation engine (Docker)
    ├── Dockerfile
    ├── package.json
    └── index.js
```

## License

Private — All rights reserved.
