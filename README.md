# KruKasyno

An online casino microservice application featuring Blackjack and Slots, with JWT authentication, Google OAuth, and an admin panel. Built as a cloud-native system deployed across two OVHcloud VPS instances.

---

## Quick Start (Local Development)

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env: set JWT_SECRET, NEXTAUTH_SECRET, SERVICE_API_KEY, MySQL passwords
# For Google OAuth: set AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET

# 2. Start all services
docker compose up --build

# 3. Open browser
# http://localhost
```

## Architecture

```
Internet → NGINX (80/443)
             ├── Frontend (Next.js :3000)      — UI, next-auth sessions
             └── API Gateway (Node :4000)      — JWT validation, routing
                   ├── Player Service (:5000)  — Identity, auth, roles
                   ├── Game Service (:6000)    — Blackjack, Slots
                   └── Wallet Service (:7000)  — Balances, transactions
                         MySQL (player_db + wallet_db)
                         Redis (game sessions, player cache)
```

See [docs/architecture.md](docs/architecture.md) for full details.

## Services

| Service | Port | Tech |
|---|---|---|
| Frontend | 3000 | Next.js 15, next-auth v5, Tailwind v4 |
| API Gateway | 4000 | Node.js 20, Express |
| Player Service | 5000 | Node.js 20, Prisma, bcryptjs |
| Game Service | 6000 | Python 3.11, FastAPI, aioredis |
| Wallet Service | 7000 | Python 3.11, FastAPI, SQLAlchemy |

## Features

- **Blackjack** — Full rules: hit, stand, double down; natural blackjack pays 2.5×
- **Slots** — 3-reel, 7 symbols, weighted RNG, special cherry combination
- **Wallet** — Deposit, withdraw, transaction history, starting balance 1000 chips
- **Auth** — Email/password + Google OAuth 2.0 via next-auth v5
- **Admin panel** — List users, ban/unban, change roles
- **Rate limiting** — NGINX zone-based + express-rate-limit on auth endpoints

## Deployment

Automated with Ansible to two VPS instances. See [docs/infrastructure.md](docs/infrastructure.md) for step-by-step deployment instructions.

```bash
# Configure inventory and vault secrets, then:
ansible-playbook -i ansible/inventory.ini ansible/playbook-vps2.yml --ask-vault-pass
ansible-playbook -i ansible/inventory.ini ansible/playbook-vps1.yml --ask-vault-pass
```

## Documentation

| Document | Contents |
|---|---|
| [docs/architecture.md](docs/architecture.md) | System design, service diagram, data ownership |
| [docs/federated-auth.md](docs/federated-auth.md) | OAuth 2.0 flow, JWT structure, authorization model |
| [docs/threat-model.md](docs/threat-model.md) | STRIDE analysis, risk scenarios, security checklist |
| [docs/infrastructure.md](docs/infrastructure.md) | Ansible usage, VPS setup, environment variables |

## Project Structure

```
├── api-gateway/         Node.js API Gateway
├── player-service/      Node.js Player Service (Prisma)
├── game-service/        Python Game Service (FastAPI)
├── wallet-service/      Python Wallet Service (FastAPI)
├── frontend/            Next.js frontend
├── nginx/               NGINX reverse proxy config
├── ansible/             Ansible playbooks & roles
├── scripts/             DB init SQL
├── docs/                Documentation
├── docker-compose.yml          Local dev (all services)
├── docker-compose.vps1.yml     Production VPS1
├── docker-compose.vps2.yml     Production VPS2
└── .env.example                Environment variable template
```