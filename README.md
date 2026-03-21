# [PixelBucks](https://pixelbucks.org)

Virtual-money esports betting platform for Dota 2 and CS2. No real money — just PixelBucks (PB) for fun.

![Events list](./static/events.png)

## Features

- **Esports Betting** — Browse upcoming Dota 2 & CS2 matches synced from PandaScore, place bets with virtual currency
- **CS2 Odds from HLTV** — Real odds scraped from HLTV (GGBet, 1xbet, Thunderpick, bcgame averaged), with proxy support for geo-restricted regions
- **Live Match Tracking** — Automatic status updates (upcoming → live → finished), embedded Twitch streams, HLTV match links
- **Real-time Updates** — Socket.IO pushes for odds changes, match status, and balance updates — no page refresh needed
- **Wallet System** — Start with 1,000 PB, weekly replenishment of 500 PB, full balance audit trail with history
- **Real-time Chat** — Socket.IO chat with English and Russian rooms, emoji support, URL image embeds
- **Challenges** — Daily and weekly challenges with PB rewards, async progress tracking
- **Leaderboard** — Top bettors ranked by profit
- **Admin Panel** — Manage odds, users, balances, view platform stats, job schedules, balance audit, and feedback
- **Feedback System** — Users can submit feedback (3 per week, 500 char limit)

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | NestJS 11, TypeScript, Prisma 7, PostgreSQL |
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4 |
| Messaging | RabbitMQ (outbox pattern, bet resolution, auditing, notifications) |
| Jobs | BullMQ + Redis (PandaScore sync, HLTV odds, challenges, replenishment) |
| Real-time | Socket.IO (chat rooms, odds/status/balance push) |
| Data | PandaScore API (events & results) + HLTV scraper (CS2 odds) |
| Caching | Redis via cache-manager (events list, leaderboard) |

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose

### 1. Start infrastructure

```bash
docker compose up -d
```

This starts PostgreSQL (port 5444), RabbitMQ (port 5777), and Redis (port 6777).

### 2. Backend

```bash
cd backend
cp .env.example .env   # edit with your PandaScore token
npm install
npx prisma db push
npm run start:dev
```

The API runs on `http://localhost:3000`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs on `http://localhost:5173` with API proxy to the backend.

### 4. Open the app

Visit `http://localhost:5173`, register an account, and start betting!

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | — |
| `RABBITMQ_URL` | RabbitMQ connection string | — |
| `REDIS_URL` | Redis connection string | — |
| `JWT_SECRET` | Secret for JWT signing | — |
| `JWT_EXPIRES_IN` | JWT expiry in ms | `604800000` (7 days) |
| `PANDASCORE_TOKEN` | PandaScore API key | — |
| `PANDASCORE_BASE_URL` | PandaScore API base URL | `https://api.pandascore.co` |
| `PANDASCORE_TIERS` | Tournament tiers to sync | `s,a` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:5173` |
| `THROTTLE_TTL` | Rate limit window (ms) | `60000` |
| `THROTTLE_LIMIT` | Max requests per window | `60` |
| `GLOBAL_MAX_BET` | Max bet in cents | `10000` |
| `HLTV_ENABLED` | Enable HLTV odds scraping | `true` |
| `HLTV_PROXY_ENABLED` | Enable proxy for HLTV requests | `true` |
| `HLTV_PROXY_LIST` | Comma-separated proxy list (host:port) | — |
| `PORT` | Backend port | `3000` |

## Production Deployment

### Docker Compose

```bash
# Create .env with secrets
cat > .env << 'EOF'
DB_USER=pixelbucks
DB_PASSWORD=<strong-password>
RMQ_USER=pixelbucks
RMQ_PASSWORD=<strong-password>
JWT_SECRET=<64-char-random-string>
PANDASCORE_TOKEN=<your-token>
FRONTEND_URL=http://your-domain
EOF

# Build and run
docker compose -f docker-compose.prod.yml up -d --build
```

See [DEPLOY.md](DEPLOY.md) for detailed deployment options (managed services or single VPS).

## Project Structure

```
backend/
  src/
    auth/           — Register, login, JWT guards
    users/          — Profile, stats, replenishment consumer
    events/         — PandaScore sync, Socket.IO gateway, balance notify consumer
    bets/           — Bet placement, resolution consumer, per-bet update consumer
    balance-audit/  — Balance audit trail (global service + consumer)
    hltv/           — HLTV odds integration (sync, mapping, proxy)
    hltv-lib/       — HLTV scraper library (vendored source)
    chat/           — WebSocket chat gateway
    challenges/     — Daily/weekly challenges + progress consumer
    admin/          — User/event management, job schedules, audit, feedback
    feedback/       — User feedback
    prisma/         — Database service
    rabbitmq/       — Message broker
    outbox/         — Outbox pattern processor
    common/         — Decorators, guards, pipes, utils (pMap)
    validations/    — fastest-validator infrastructure
  prisma/
    schema.prisma   — Database schema
  test/             — Integration tests (auth, users, events, bets, chat)

frontend/
  src/
    pages/          — All page components
    components/     — Layout, chat widget, error boundary, toasts
    api/            — Axios API clients
    context/        — Auth + Socket.IO providers
    hooks/          — useAuth, useOddsUpdates
    types/          — TypeScript types
```

## Tests

```bash
# Integration tests
cd backend
npm run test:e2e

# Unit tests
npx jest --testPathPattern=src
```

**Integration tests** — auth, users, events, bets, bet resolution, profit tracking, chat.
**Unit tests** — bet resolution logic, bet update consumer (won/lost/refund), HLTV proxy service.
