# KruKasyno — Threat Model & Risk Analysis

## 1. Scope and Methodology

This threat model was produced using the **STRIDE** methodology. The system was analysed by walking through every data flow in the architecture and identifying threats against each element. Threats are catalogued per STRIDE category with associated mitigations and residual risk levels.

The analysis considers three **trust boundaries**:

| Boundary | Description |
|---|---|
| **TB-1: Internet / Public** | Traffic between the end-user's browser and VPS1 (NGINX). Untrusted. |
| **TB-2: VPS1 Internal** | Traffic from NGINX → API Gateway → VPS2. Semi-trusted (enforced by JWT and service key). |
| **TB-3: VPS2 Private** | Traffic between backend services, MySQL, and Redis. Trusted (private Docker network). |

![Scope and Methodology](diagrams/Scope%20and%20Methodology.png)

---

## 2. Assets

| Asset | Sensitivity | Location |
|---|---|---|
| User passwords (bcrypt hashes) | High | MySQL player_db |
| JWT signing secret (`JWT_SECRET`) | Critical | VPS env var |
| Internal service key (`SERVICE_API_KEY`) | High | VPS env var |
| User wallet balances | High | MySQL wallet_db |
| Google OAuth credentials | High | VPS env var / Google Console |
| MySQL database files | High | VPS2 filesystem |
| Redis game state | Medium | VPS2 memory |
| next-auth session cookies | High | Browser (HttpOnly) |

---

## 3. Threat Actors

| Actor | Motivation | Capability | Likely Entry Point |
|---|---|---|---|
| External attacker | Financial gain, data theft | Medium | Public HTTP endpoints, stolen credentials |
| Compromised player account | Cheating, balance manipulation | Low | Valid JWT with USER role |
| Bot / automated tool | Account enumeration, DDoS, credential stuffing | High | Auth and game endpoints |
| Insider / rogue admin | Data theft, privilege abuse | Medium | Admin API endpoints |

---

## 4. STRIDE Analysis

![STRIDE Analysis](diagrams/STRIDE%20Analysis.png)

### 4.1 Spoofing

| Element | Threat | Mitigation | Residual Risk |
|---|---|---|---|
| API Gateway | JWT forgery — attacker crafts a valid-looking JWT | HS256 with ≥64-char random secret; signature verified on every request | Low |
| Browser session | Session hijacking via cookie theft | `HttpOnly`, `Secure`, `SameSite=Lax` cookies; HTTPS enforced | Low |
| VPS2 service call | Service impersonation — VPS2 service bypassed by attacker | `X-Service-Key` required on all inter-service calls; VPS2 not publicly reachable | Low |
| Player Service | Google account takeover — attacker links arbitrary Google ID | Google OAuth flow verified by Google; only `email` used for account lookup | Low |

### 4.2 Tampering

| Element | Threat | Mitigation | Residual Risk |
|---|---|---|---|
| Wallet Service | Balance manipulation — client sends modified balance | Balances never trusted from client; all debits/credits performed server-side | Low |
| Game Service | Game result manipulation — client modifies card state | Game state held in server-side Redis; outcomes computed server-side only | Low |
| Player Service | SQL injection | Prisma ORM uses parameterized queries | Low |
| Wallet / Game Service | SQL / NoSQL injection | SQLAlchemy ORM uses parameterized queries | Low |
| Redis | Cache poisoning — attacker writes to Redis | Redis on private network (TB-3); no public port; no unauthenticated access | Low |

### 4.3 Repudiation

| Element | Threat | Mitigation | Residual Risk |
|---|---|---|---|
| Wallet Service | Disputed transaction — player denies placing bet | All transactions logged in MySQL `wallet_db` with timestamps, user ID, and game session ID | Low |
| Game Service | Disputed game outcome | Game session ID stored in transaction record; reproducible from logs | Medium |
| Auth events | Account takeover claim | Player Service logs login events including method (credentials / Google) | Medium |

### 4.4 Information Disclosure

| Element | Threat | Mitigation | Residual Risk |
|---|---|---|---|
| Player Service | Password exposure in API response | bcrypt hash never returned in API responses; `password` field excluded from all queries | Low |
| All services | JWT secret in logs / code | Secret stored only in env vars; excluded from all log statements; not in version control | Low |
| MySQL | Direct database access from internet | MySQL bound to Docker private network (TB-3); no public port in production | Low |
| API responses | Verbose error messages leaking stack traces | Generic error messages returned to clients; details logged server-side only | Low |
| NGINX | Server fingerprinting | `server_tokens off` in `nginx.conf` | Low |

### 4.5 Denial of Service

| Element | Threat | Mitigation | Residual Risk |
|---|---|---|---|
| API Gateway | API flooding / request storm | NGINX zone-based rate limiting + `express-rate-limit` middleware | Medium |
| Player Service | Auth endpoint brute force | Rate limiting on `/auth/*`; bcrypt cost 12 (slow compare) | Low |
| NGINX | Slow loris attack | NGINX `client_body_timeout`, `client_header_timeout` configured | Low |
| All services | Resource exhaustion | Docker resource limits configurable per service | Medium |
| VPS1 host | Host-level DDoS | OVHcloud anti-DDoS included at infrastructure level | Medium |

### 4.6 Elevation of Privilege

| Element | Threat | Mitigation | Residual Risk |
|---|---|---|---|
| API Gateway | Accessing admin routes as USER | Role check in API Gateway middleware; double-checked in Player Service | Low |
| Wallet / Game Service | Accessing another user's data | `X-User-Id` injected by API Gateway from validated JWT; no user-supplied ID accepted | Low |
| Game Service | Bypassing balance check using cache | Critical financial ops call Player Service directly (live DB) instead of using cache | Low |
| Player Service | Escalating own role to ADMIN | Role changes require `ADMIN` role; own role cannot be changed without ADMIN privilege | Low |

---

## 5. High-Risk Scenarios

| # | Scenario | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| S1 | Stolen JWT (e.g., via XSS on third-party script) | Low | High — attacker plays and withdraws as victim | 24h expiry; `HttpOnly` cookie; ban feature; TLS enforced |
| S2 | `SERVICE_API_KEY` exposure | Low | Critical — direct wallet manipulation | Env var only; never logged; private network; rotate on compromise |
| S3 | Race condition in bet placement | Low | High — bet above available balance | Atomic SQLAlchemy transaction: balance check + deduct in single DB transaction |
| S4 | Redis compromise | Low | Medium — game state manipulation | Private network (TB-3); no public port; all outcomes validated server-side |
| S5 | Credential stuffing on login | Medium | Medium — account takeover | Rate limiting; bcrypt slow hash; Google OAuth as phishing-resistant alternative |

---

## 6. Trust Boundary Summary

### TB-1: Internet → VPS1

- All traffic crosses this boundary over TLS (HTTPS)
- NGINX terminates TLS and enforces rate limits before forwarding
- No backend service port is exposed at this boundary

### TB-2: VPS1 → VPS2 (API Gateway → Backend)

- API Gateway validates JWT and injects `X-User-Id` / `X-User-Role` headers before crossing this boundary
- All forwarded requests include `X-Service-Key`
- VPS2 services do not accept unauthenticated requests

### TB-3: VPS2 Internal

- All services communicate over the Docker `private-net` bridge by container DNS name
- MySQL and Redis are accessible only within this boundary
- No direct external access is possible in production

---

## 7. Reliability Controls

| Control | Implementation |
|---|---|
| Health checks | Every service exposes `GET /health`; used by Docker Compose for dependency ordering |
| Auto-restart | `restart: unless-stopped` in all Docker Compose files |
| DB connection retry | Prisma `pool_timeout`; SQLAlchemy `pool_pre_ping=True` |
| Redis reconnect | `aioredis` auto-reconnect on connection drop |
| Graceful degradation | Game/Wallet services use Redis player cache for non-critical ops; fall back to Player Service on miss |
| Structured logging | `morgan` (Node), `uvicorn` access logs (Python), stdout → Docker log driver |
| Graceful shutdown | SIGTERM handlers in Node services for in-flight request draining |

---

## 8. Security Hardening Checklist

- [x] Passwords hashed with bcrypt (cost factor 12)
- [x] JWT HS256 with ≥64-char random secret
- [x] HTTPS (Let's Encrypt via Certbot / NGINX in production)
- [x] Rate limiting on all auth endpoints (NGINX + express-rate-limit)
- [x] CORS restricted to known origins
- [x] Helmet.js security headers (Node services)
- [x] UFW firewall: only ports 22, 80, 443 open on VPS1; only port 22 on VPS2
- [x] fail2ban against SSH brute force on both VPS instances
- [x] Unattended security upgrades enabled (Ubuntu)
- [x] No hardcoded secrets (all secrets in env vars / Ansible Vault)
- [x] SQL injection prevention (Prisma + SQLAlchemy parameterized queries)
- [x] XSS protection (Content-Security-Policy via NGINX + Helmet)
- [x] No sensitive data in logs (passwords, JWT secrets, service keys excluded)
- [x] `server_tokens off` in NGINX (no version fingerprinting)
- [x] Google OAuth tokens not persisted (only derived application JWT stored)
