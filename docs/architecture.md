# KruKasyno — System Architecture

## 1. Overview

KruKasyno is a cloud-based casino application implemented as a microservice architecture deployed across two Ubuntu VPS instances hosted on OVHcloud.

```
Internet
    │
    ▼
  DNS (OVH)
    │
    ▼
┌─────────────────────────────────┐
│  VPS 1 – Public Node            │
│  ┌─────────────────────────┐   │
│  │ NGINX (reverse proxy)   │   │
│  │ ├── Frontend (Next.js)  │   │
│  │ └── API Gateway (Node)  │   │
│  └─────────────────────────┘   │
└────────────────┬────────────────┘
                 │ internal network
                 ▼
┌─────────────────────────────────┐
│  VPS 2 – Private Node           │
│  ┌─────────────────────────┐   │
│  │ Player Service (Node)   │   │
│  │ Game Service (FastAPI)  │   │
│  │ Wallet Service (FastAPI)│   │
│  │ MySQL (player_db,       │   │
│  │         wallet_db)      │   │
│  │ Redis (game state,      │   │
│  │         player cache)   │   │
│  └─────────────────────────┘   │
└─────────────────────────────────┘
```

## 2. Services

| Service | Language | Port | Database | Responsibility |
|---|---|---|---|---|
| Frontend | Next.js (TypeScript) | 3000 | — | User interface |
| API Gateway | Node.js (TypeScript) | 4000 | — | JWT validation, routing |
| Player Service | Node.js (TypeScript) | 5000 | MySQL (player_db) | Identity, auth, JWT issuance |
| Game Service | Python (FastAPI) | 6000 | Redis | Game logic, session state |
| Wallet Service | Python (FastAPI) | 7000 | MySQL (wallet_db) | Balances, transactions |

## 3. Request Flow

### Login
```
Browser → NGINX → Frontend (next-auth) → API Gateway /auth/login
       → Player Service (validates, issues JWT)
       ← JWT returned to browser (stored in next-auth session cookie)
```

### Game Action (e.g. Blackjack bet)
```
Browser → NGINX → API Gateway (validates JWT, adds X-User-Id header)
       → Game Service (deducts bet via Wallet Service, resolves game)
       ← Updated game state
```

## 4. Inter-Service Communication

All VPS2 services communicate over an internal Docker bridge network using DNS names:
- `http://player-service:5000`
- `http://game-service:6000`
- `http://wallet-service:7000`

Service-to-service calls use the `X-Service-Key` header for authentication.

## 5. Caching Strategy

Both Game Service and Wallet Service maintain a Redis cache of player data (`cache:player:{id}`, TTL 5 min):

- **Non-critical operations** (displaying balance, game state): use cached data
- **Critical operations** (placing bets, financial transactions): call Player Service directly for authoritative validation

## 6. Data Ownership

| Data | Owner | Cache |
|---|---|---|
| User identities, roles, ban status | Player Service (player_db) | Redis in Game + Wallet |
| Wallet balances, transactions | Wallet Service (wallet_db) | — |
| Active game sessions | Game Service (Redis) | — |

## 7. Containerization

- Each service has its own `Dockerfile`
- `docker-compose.yml` — full local development
- `docker-compose.vps1.yml` — VPS1 production
- `docker-compose.vps2.yml` — VPS2 production
- All services have health check endpoints at `GET /health`
- Containers use `restart: unless-stopped`

## 8. Networking

- VPS1: `public-net` Docker bridge, ports 80/443 exposed
- VPS2: `private-net` Docker bridge, no public ports
- API Gateway bridges both networks (VPS1 public + VPS2 private in single-compose dev)
- Production: API Gateway on VPS1 connects to VPS2 via `BACKEND_HOST` env variable
