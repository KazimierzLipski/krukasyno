# KruKasyno — Threat Model & Risk Analysis

## 1. Assets

| Asset | Sensitivity |
|---|---|
| User passwords (hashed) | High |
| JWT secrets | Critical |
| Service API key | High |
| User wallet balances | High |
| Google OAuth credentials | High |
| MySQL database | High |
| Redis game state | Medium |

---

## 2. Threat Actors

| Actor | Motivation | Capability |
|---|---|---|
| External attacker | Financial gain, data theft | Medium |
| Compromised player account | Cheating, balance manipulation | Low |
| Insider threat | Data theft | Medium |
| Bot/automated tool | Account enumeration, DDoS | High |

---

## 3. STRIDE Analysis

### Spoofing
| Threat | Mitigation |
|---|---|
| JWT forgery | HS256 with 64-char secret; validated on every request |
| Session hijacking | HttpOnly, Secure, SameSite cookies |
| Service impersonation | `X-Service-Key` for all inter-service calls |

### Tampering
| Threat | Mitigation |
|---|---|
| Wallet balance manipulation | All financial ops require service key or valid JWT; no client-side trust |
| Game result manipulation | Game state in Redis, not client; all outcomes computed server-side |
| SQL injection | Prisma ORM (parameterized); SQLAlchemy ORM (parameterized) |

### Repudiation
| Threat | Mitigation |
|---|---|
| Disputed transactions | All transactions logged in MySQL with timestamps and descriptions |
| Disputed game outcomes | Game session IDs stored in transactions |

### Information Disclosure
| Threat | Mitigation |
|---|---|
| Password exposure | bcrypt hash (cost 12); never returned in API responses |
| JWT secret exposure | Stored only in env vars; not in code or logs |
| Database exposure | MySQL on private network only; no public port in production |
| Error message leakage | Generic error messages returned to clients |

### Denial of Service
| Threat | Mitigation |
|---|---|
| API flooding | Rate limiting: NGINX (zone-based) + express-rate-limit |
| Slow loris | NGINX timeout configuration |
| Resource exhaustion | Docker resource limits (can be configured) |

### Elevation of Privilege
| Threat | Mitigation |
|---|---|
| Accessing admin routes | Role check in API Gateway + Player Service middleware |
| Accessing other user's wallet | `X-User-Id` from validated JWT only; no user-supplied ID accepted |
| Bypassing bet validation | Critical ops call Player Service directly (not cached) |

---

## 4. High-Risk Scenarios

### Scenario 1: Stolen JWT
- **Impact**: Attacker can play games and access wallet as the victim
- **Likelihood**: Low (stored in HttpOnly cookie, HTTPS enforced)
- **Mitigation**: 24h expiry; ban feature for compromised accounts; TLS enforced

### Scenario 2: SERVICE_API_KEY Exposure
- **Impact**: Attacker could directly debit/credit any wallet
- **Likelihood**: Low (env var, private network)
- **Mitigation**: Stored only in `.env`; never logged; rotate if compromised

### Scenario 3: Race Condition in Bet Placement
- **Impact**: Player could bet more than their balance
- **Likelihood**: Low (database transactions used for debit)
- **Mitigation**: SQLAlchemy with atomic balance check + update in single transaction

### Scenario 4: Redis Compromise
- **Impact**: Game state manipulation (e.g., change dealt cards)
- **Likelihood**: Low (private network, no public port)
- **Mitigation**: Redis on private network only; game outcomes validated server-side

---

## 5. Reliability Controls

| Control | Implementation |
|---|---|
| Health checks | Every service exposes `GET /health` |
| Auto-restart | `restart: unless-stopped` in Docker Compose |
| DB retry | Prisma `@prisma/client` with retry; SQLAlchemy `pool_pre_ping` |
| Redis retry | `aioredis` auto-reconnect |
| Graceful degradation | Game/Wallet services fall back to cached player data for non-critical ops |
| Structured logging | `morgan` (Node), `uvicorn` access logs (Python), stdout → Docker |

---

## 6. Security Hardening Checklist

- [x] Passwords hashed with bcrypt (cost 12)
- [x] JWT HS256 with strong secret
- [x] HTTPS (Let's Encrypt via NGINX in production)
- [x] Rate limiting on auth endpoints
- [x] CORS restricted
- [x] Helmet.js security headers (Node services)
- [x] UFW firewall (only 22, 80, 443 open on VPS1; only 22 on VPS2)
- [x] fail2ban against SSH brute force
- [x] Unattended security upgrades enabled
- [x] No hardcoded secrets (all in env vars)
- [x] SQL injection prevention (ORM parameterized queries)
- [x] XSS protection (CSP headers via NGINX + Helmet)
- [x] No sensitive data in logs
