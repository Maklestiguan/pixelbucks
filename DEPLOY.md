# PixelBucks — VPS Deployment Guide

Step-by-step guide to deploy PixelBucks on a single VPS using Docker Compose.

---

## Prerequisites

- A VPS with Linux (Ubuntu/Debian recommended), at least 1 GB RAM
- A domain name pointed to your VPS IP (optional but recommended for SSL)
- SSH access to the server

---

## Step 1 — Install Docker

SSH into your VPS and install Docker + Docker Compose:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Add your user to docker group (log out and back in after)
sudo usermod -aG docker $USER

# Verify
docker --version
docker compose version
```

---

## Step 2 — Clone the Repository

```bash
git clone <your-repo-url> pixelbucks
cd pixelbucks
```

---

## Step 3 — Generate Secrets

```bash
# Generate JWT secret
openssl rand -hex 32

# Generate DB password
openssl rand -base64 24

# Generate RabbitMQ password
openssl rand -base64 24
```

Save these values — you'll need them in the next step.

---

## Step 4 — Get a PandaScore API Key

1. Register at [pandascore.co](https://pandascore.co)
2. Go to dashboard → API Keys
3. Free tier: 1,000 requests/hour (sufficient for this project)
4. Copy your API token

---

## Step 5 — Create the `.env` File

```bash
cat > .env << 'EOF'
DB_USER=pixelbucks
DB_PASSWORD=<paste-db-password>
RMQ_USER=pixelbucks
RMQ_PASSWORD=<paste-rmq-password>
JWT_SECRET=<paste-jwt-secret>
PANDASCORE_TOKEN=<paste-pandascore-token>
FRONTEND_URL=http://your-domain-or-ip
EOF
```

Replace all `<...>` placeholders with your actual values.

`FRONTEND_URL` should be:
- `https://yourdomain.com` if you're setting up SSL (Step 9)
- `http://your-vps-ip` if no domain

---

## Step 6 — Build and Start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

This builds and starts 5 containers:
- **postgres** — PostgreSQL 16 database
- **rabbitmq** — RabbitMQ message broker
- **redis** — Redis for BullMQ job queues
- **backend** — NestJS API (port 3000, runs Prisma migrations on startup)
- **frontend** — Nginx serving React app (port 80), proxies `/api` and `/socket.io` to backend

First build takes a few minutes. Monitor progress:

```bash
docker compose -f docker-compose.prod.yml logs -f backend
```

Wait until you see the backend listening message. Press `Ctrl+C` to stop following logs.

---

## Step 7 — Verify It Works

```bash
# Check all containers are running
docker compose -f docker-compose.prod.yml ps

# Test backend API
curl http://localhost:3000/api/events

# Test frontend
curl -s http://localhost:80 | head -5
```

Open `http://your-vps-ip` in a browser — you should see the login page.

---

## Step 8 — Create Your First Account

1. Open the app in your browser
2. Click "Register"
3. Create an account — you'll start with 1,000.00 PB
4. PandaScore sync runs every 15 minutes — events will appear shortly

To make yourself an admin, connect to the database:

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U pixelbucks -d pixelbucks -c \
  "UPDATE users SET role = 'ADMIN' WHERE username = 'your-username';"
```

Log out and back in to pick up the new role.

---

## Step 9 — Set Up SSL with Caddy (Recommended)

Caddy auto-provisions free Let's Encrypt certificates.

```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

Create the Caddy config:

```bash
sudo tee /etc/caddy/Caddyfile << 'EOF'
yourdomain.com {
    reverse_proxy localhost:8080
}
EOF
```

Replace `yourdomain.com` with your actual domain, then restart Caddy:

```bash
sudo systemctl restart caddy
```

Caddy will automatically obtain and renew SSL certificates. Your app is now available at `https://yourdomain.com`.

Make sure `FRONTEND_URL` in your `.env` matches `https://yourdomain.com`, then restart the backend for CORS to work:

```bash
docker compose -f docker-compose.prod.yml restart backend
```

---

## Common Operations

### View logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f backend
```

### Restart a service

```bash
docker compose -f docker-compose.prod.yml restart backend
```

### Update to latest code

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

### Stop everything

```bash
docker compose -f docker-compose.prod.yml down
```

### Stop and delete all data (database, volumes)

```bash
docker compose -f docker-compose.prod.yml down -v
```

### Connect to the database

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U pixelbucks -d pixelbucks
```

### Check RabbitMQ management UI

RabbitMQ management is not exposed externally by default. To access it temporarily:

```bash
# Forward port from VPS to your local machine via SSH
ssh -L 15672:localhost:15672 your-vps

# Then visit http://localhost:15672 in your browser
# Login with your RMQ_USER / RMQ_PASSWORD
```

Or add a port mapping to `docker-compose.prod.yml` under the `rabbitmq` service:

```yaml
ports:
  - "127.0.0.1:15672:15672"
```

---

## Environment Variables Reference

### `.env` file (Docker Compose)

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_USER` | PostgreSQL username | `pixelbucks` |
| `DB_PASSWORD` | PostgreSQL password | (generated) |
| `RMQ_USER` | RabbitMQ username | `pixelbucks` |
| `RMQ_PASSWORD` | RabbitMQ password | (generated) |
| `JWT_SECRET` | Secret for JWT signing | (generated, 64 chars) |
| `PANDASCORE_TOKEN` | PandaScore API key | (from pandascore.co) |
| `FRONTEND_URL` | Frontend URL for CORS | `https://yourdomain.com` |

### Backend environment (set in `docker-compose.prod.yml`)

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | Built from DB_USER/DB_PASSWORD | Auto-composed |
| `RABBITMQ_URL` | Built from RMQ_USER/RMQ_PASSWORD | Auto-composed |
| `REDIS_URL` | `redis://redis:6379` | Internal Docker network |
| `JWT_EXPIRES_IN` | `604800000` | 7 days in ms |
| `PANDASCORE_BASE_URL` | `https://api.pandascore.co` | Default |
| `NODE_ENV` | `production` | |
| `PORT` | `3000` | |

---

## Post-Deploy Checklist

- [ ] All 5 containers running (`docker compose ps`)
- [ ] Backend logs show "Prisma migrations applied" on startup
- [ ] `curl http://localhost:3000/api/events` returns JSON
- [ ] Frontend loads at `http://your-ip` (or `https://yourdomain.com`)
- [ ] Register a user → verify 1,000.00 PB starting balance
- [ ] PandaScore sync runs (backend logs: "Synced X matches")
- [ ] Events appear on the Events page
- [ ] Place a test bet → balance deducted
- [ ] WebSocket chat works (join room, send message)
- [ ] Challenges page loads
- [ ] Leaderboard page shows ranked users
- [ ] Feedback submission works (max 3/week)
- [ ] FAQ page loads
- [ ] Admin panel works (after promoting your user)
- [ ] SSL certificate active (if using Caddy)

---

## Troubleshooting

### Nginx won't start (port is not free)

```bash
# disable apache2 (possible VPS default)
sudo systemctl stop apache2
sudo systemctl disable apache2
```

### Backend won't start

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs backend

# Common issue: postgres not ready yet — backend retries automatically
# If migrations fail, check DATABASE_URL is correct
```

### Frontend shows blank page

```bash
# Check nginx config
docker compose -f docker-compose.prod.yml exec frontend cat /etc/nginx/conf.d/default.conf

# Check frontend can reach backend
docker compose -f docker-compose.prod.yml exec frontend wget -qO- http://backend:3000/api/events
```

### CORS errors in browser

Make sure `FRONTEND_URL` in `.env` exactly matches the URL you're accessing the app from (including `https://` if using SSL). Restart backend after changing.

### WebSocket not connecting

If behind Caddy/SSL, WebSocket upgrades should work automatically. If behind another reverse proxy, make sure it supports WebSocket upgrades (HTTP/1.1 Upgrade headers).

### Disk space

```bash
# Check disk usage
df -h

# Clean up old Docker images
docker system prune -af
```
