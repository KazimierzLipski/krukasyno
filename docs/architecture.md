# KruKasyno — System Architecture

## 1. Overview

KruKasyno is a cloud-based casino application implemented as a microservice architecture deployed across two Ubuntu VPS instances hosted on OVHcloud. The application logic is decomposed into standalone services combined by an API Gateway layer that abstracts complexity from the client. This approach facilitates independent scaling, testing, and maintenance of each service.

![VPS Trust Boundary Service](diagrams/VPS%20Trust%20Boundary%20Service.png)


## 2. Services

| Service | Language | Port | Database | Responsibility |
|---|---|---|---|---|
| Frontend | Next.js (TypeScript) | 3000 | — | User interface (SPA) |
| API Gateway | Node.js (TypeScript) | 4000 | — | JWT validation, rate limiting, routing |
| Player Service | Node.js (TypeScript) | 5000 | MySQL (player_db) | Identity, auth, JWT issuance, user management |
| Game Service | Python (FastAPI) | 6000 | Redis | Game logic (Blackjack, Slots), session state |
| Wallet Service | Python (FastAPI) | 7000 | MySQL (wallet_db) | Balances, deposits, withdrawals, transactions |

Each service is independently deployable, runs in a Docker container, and exposes a `GET /health` endpoint. Services follow the separation of concerns principle — each owns its data store and handles only its bounded domain.

## 3. Request Flow

![Request Flow](diagrams/Request%20Flow.png)

### Login
```
Browser → NGINX → Frontend (next-auth) → API Gateway /auth/login
       → Player Service (validates credentials, issues JWT)
       ← JWT returned to browser (stored in next-auth HttpOnly session cookie)
```

### Game Action (e.g. Blackjack bet)
```
Browser → NGINX → API Gateway (validates JWT, injects X-User-Id / X-User-Role headers)
       → Game Service (validates cached player state, deducts bet via Wallet Service)
       ← Updated game state returned to browser
```

### Admin Action (e.g. Ban User)
```
Browser (ADMIN role) → NGINX → API Gateway (validates JWT, checks X-User-Role = ADMIN)
       → Player Service /admin/users/:id/ban
       ← Updated user record
```

## 4. Inter-Service Communication

All VPS2 services communicate over an internal Docker bridge network (`private-net`) using Docker DNS names:

| Caller | Callee | Method |
|---|---|---|
| API Gateway | Player Service | HTTP + `X-Service-Key` |
| API Gateway | Game Service | HTTP + `X-Service-Key` |
| API Gateway | Wallet Service | HTTP + `X-Service-Key` |
| Game Service | Wallet Service | HTTP + `X-Service-Key` (bet deduction) |
| Game Service | Player Service | HTTP + `X-Service-Key` (player validation, critical ops) |
| Wallet Service | Player Service | HTTP + `X-Service-Key` (player validation, critical ops) |

Service-to-service calls use the `X-Service-Key` header for authentication. This key is shared exclusively among VPS2 services and is never exposed through the public API.

## 5. Caching Strategy

Both Game Service and Wallet Service maintain a Redis cache of player data (`cache:player:{id}`, TTL 5 min) to reduce load on the Player Service:

| Operation type | Data source | Rationale |
|---|---|---|
| Display balance, show game state | Redis cache | Performance — low risk if slightly stale |
| Place bet, financial transaction | Player Service (live DB) | Correctness — ban status and role must be authoritative |
| Start new game session | Player Service (live DB) | Correctness — must verify account is active |

## 6. Data Ownership

| Data | Owner | Cache |
|---|---|---|
| User identities, roles, ban status | Player Service (player_db) | Redis in Game + Wallet (TTL 5 min) |
| Wallet balances, transactions | Wallet Service (wallet_db) | — |
| Active game sessions | Game Service (Redis) | — |

![Data Ownership](diagrams/Data%20Ownership.png)

> `users` lives in `player_db` (Player Service / MySQL). `wallets` and `transactions` live in `wallet_db` (Wallet Service / MySQL). The `user_id` columns are logical foreign keys — there is no database-level FK constraint across the two separate schemas.

## 7. Containerization

- Each service has its own `Dockerfile`
- `docker-compose.yml` — full local development environment (all services on one host)
- `docker-compose.vps1.yml` — VPS1 production (NGINX, Frontend, API Gateway)
- `docker-compose.vps2.yml` — VPS2 production (Player, Game, Wallet, MySQL, Redis)
- All services expose `GET /health` for readiness and liveness checks
- Containers use `restart: unless-stopped` for automatic recovery

## 8. Networking

| Network | Scope | Exposed ports |
|---|---|---|
| `public-net` (VPS1) | Docker bridge on VPS1 | 80, 443 (NGINX) |
| `private-net` (VPS2) | Docker bridge on VPS2 | none (internal only) |

- In development (`docker-compose.yml`): API Gateway is attached to both networks, bridging public and private.
- In production: API Gateway on VPS1 reaches VPS2 services via the `BACKEND_HOST` environment variable (VPS2 private IP).
- MySQL and Redis are **never** reachable from the public internet in production.
