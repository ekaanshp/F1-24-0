# 🏎️ F1 TeamBuilder — The 24-0 Challenge

Build your ultimate Formula 1 team through randomized era + team spins across F1 history. Draft 8 legendary roster slots — drivers, chassis, engine, team principal, car designer, and engineers — then see your team rated against 70+ years of real F1 historical data. Can you assemble the perfect team and go **24-0**?

---

## What Is This?

F1 TeamBuilder is a browser-based draft game. Each round works like this:

1. **🎰 SPIN** — A random F1 era (1950s–2020s) and team (McLaren, Ferrari, Red Bull, etc.) is selected
2. **🏎️ DRAFT** — You're shown all available components from that era + team across each open slot type. Pick one to fill a slot.
3. **💡 LIFELINES** — You get one "Respin Team" (same era, new team) and one "Respin Both" (new era + new team) per draft
4. **Repeat** until all 8 roster slots are filled
5. **🏆 SCORE** — Your team is rated using real career-aggregated and peak-weighted F1 historical statistics
6. **📊 LEADERBOARD** — Submit your score to compete globally

Two game modes: **Regular** (shows stats per component) and **Hardcore** (stats hidden — pure instinct).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 15](https://nextjs.org) (App Router, Turbopack) |
| UI | [React 19](https://react.dev), TypeScript |
| Styling | Tailwind CSS v4 + custom CSS variables |
| Animations | [Framer Motion 12](https://www.framer.com/motion/) |
| Database | [Neon](https://neon.tech) — serverless PostgreSQL |
| ORM | [Prisma 7](https://prisma.io) with `@prisma/adapter-neon` |
| Testing | [Playwright](https://playwright.dev) (E2E, multi-browser) |
| CI/CD | [GitHub Actions](https://github.com/features/actions) |
| Deployment | [Vercel](https://vercel.com) |

---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                   Next.js 15 (App Router)                   │
│                                                             │
│  / (Home)     /draft     /leaderboards                      │
│                                                             │
│  HomeClient   DraftManager   LeaderboardClient              │
│               ├─ SpinningWheel                              │
│               ├─ SlotCard                                   │
│               └─ SubmitModal                                │
│                                                             │
│  Server Actions (app/actions/game.ts)                       │
│  ├─ spinForSlot()           → random era + team             │
│  ├─ respinTeam()            → same era, new team            │
│  ├─ getAllPoolsForTeam()     → available components          │
│  ├─ calculateScore()        → roster rating                 │
│  ├─ checkNameAvailability() → leaderboard name check        │
│  └─ submitFinalScore()      → save to DB + get rank         │
└────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   Neon Postgres    │
                    │  (serverless pool) │
                    │  Prisma ORM        │
                    └───────────────────┘
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 20.19.0 (see `.nvmrc`)
- A **[Neon](https://neon.tech)** PostgreSQL account (free tier works)

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

```env
# Neon — use the POOLED string (ends with -pooler) for DATABASE_URL
DATABASE_URL="postgresql://user:pass@your-project-pooler.us-east-2.aws.neon.tech/f1teambuilder?sslmode=require"

# Neon — use the DIRECT (non-pooled) string for migrations
DIRECT_DATABASE_URL="postgresql://user:pass@your-project.us-east-2.aws.neon.tech/f1teambuilder?sslmode=require"
```

### 3. Set Up the Database

```bash
# Push the Prisma schema to your Neon database
npm run db:push
```

### 4. Run the Dev Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server with Turbopack |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint and auto-fix |
| `npm run typecheck` | TypeScript type checking |
| `npm run db:push` | Push Prisma schema to Neon |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:studio` | Open Prisma Studio |
| `npm run test:e2e` | Run all Playwright E2E tests |
| `npm run test:e2e:ui` | Open Playwright interactive UI |
| `npm run test:e2e:report` | View the last HTML test report |

---

## E2E Tests

All tests live in the `e2e/` directory and are run with [Playwright](https://playwright.dev).

### Test Coverage

| Suite | What's Tested |
|---|---|
| `home.spec.ts` | Page title, hero heading, draft mode buttons, navigation, leaderboard preview, footer |
| `draft.spec.ts` | Spin button, spinning wheel overlay, era/team columns, options phase, slot selection, progress bar, lifeline badges, hardcore vs regular stats, completing all 8 slots |
| `leaderboard.spec.ts` | Page title, tab buttons, table headers, empty state, row expand/collapse, rank badges, mode-filtered tabs (Regular/Hardcore) |

### Running Tests Locally

```bash
# Run all tests (reuses your local dev server on :3000)
npm run test:e2e

# Interactive Playwright UI (great for debugging)
npm run test:e2e:ui

# View the HTML report from the last run
npm run test:e2e:report
```

> **Note:** The dev server must be running (or Playwright will start it automatically via the `webServer` config).

---

## CI/CD Pipeline

Every push to `main` and every pull request runs the full pipeline via GitHub Actions:

```
quality (ESLint + TypeScript)
    ↓
build (Next.js production build)
    ↓
e2e (Playwright — Chromium + Firefox + WebKit)
```

### Required GitHub Secrets

Go to **Settings → Secrets and variables → Actions** in your repo and add:

| Secret | Description |
|---|---|
| `DATABASE_URL` | Neon pooled connection string |
| `DIRECT_DATABASE_URL` | Neon direct connection string |
| `NEXTAUTH_SECRET` | Random 32-char string (`openssl rand -base64 32`) |

### Artifacts

After every CI run:
- **Playwright HTML Report** — always uploaded (30-day retention)
- **Playwright Traces** — uploaded on failure (14-day retention) for debugging

---

## Project Structure

```
F1-TeamBuilder/
├── .github/workflows/
│   └── ci.yml                  # GitHub Actions CI pipeline
├── e2e/                        # Playwright E2E tests
│   ├── helpers/
│   │   └── mock-actions.ts     # Shared server action interceptors
│   ├── home.spec.ts
│   ├── draft.spec.ts
│   └── leaderboard.spec.ts
├── prisma/
│   └── schema.prisma           # Database schema
├── services/
│   └── data-pipeline/          # Python scripts for F1 data ingestion
├── src/
│   ├── app/
│   │   ├── page.tsx            # / — Landing page (server)
│   │   ├── draft/page.tsx      # /draft — Draft engine (server)
│   │   ├── leaderboards/page.tsx # /leaderboards — Rankings (server)
│   │   └── actions/
│   │       └── game.ts         # All server actions (spin, score, submit)
│   ├── components/
│   │   ├── DraftManager.tsx    # Draft state machine
│   │   ├── SpinningWheel.tsx   # Slot machine + options overlay
│   │   ├── SlotCard.tsx        # Individual roster slot display
│   │   ├── SubmitModal.tsx     # Score reveal + leaderboard entry
│   │   ├── HomeClient.tsx      # Landing page UI
│   │   ├── LeaderboardClient.tsx # Leaderboard tabs + rows
│   │   └── ui/                 # Shared UI primitives (canvas, confetti, etc.)
│   ├── lib/
│   │   ├── db.ts               # Prisma singleton (Neon pooled)
│   │   └── constants.ts        # Draft slots, weights, validation
│   ├── services/
│   │   ├── draft.ts            # Draft query logic
│   │   ├── simulation.ts       # Score aggregation
│   │   └── leaderboard.ts      # Leaderboard queries
│   └── types/
│       └── index.ts            # Shared TypeScript types
├── playwright.config.ts        # Playwright configuration
├── next.config.ts              # Next.js configuration
└── prisma.config.ts            # Prisma configuration
```

---

## Scoring System

Each roster slot is weighted by its historical impact on F1 team performance:

| Slot | Weight |
|---|---|
| Driver 1 | 18% |
| Driver 2 | 18% |
| Chassis | 18% |
| Engine | 18% |
| Team Principal | 10% |
| Car Designer | 10% |
| Lead Engineer 1 | 4% |
| Lead Engineer 2 | 4% |

Scores are computed from career-aggregated and peak-weighted metrics (wins, poles, points) pulled from the Neon database. The final score is mapped to a grade (S+ → F) and a predicted season win record (e.g. "14-10").

---

## License

Private — All rights reserved.
