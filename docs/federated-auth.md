# KruKasyno — Federated Authentication & Authorization

## 1. Authentication Overview

KruKasyno uses a **hybrid authentication model**: credentials-based login for direct sign-up and Google OAuth 2.0 for federated identity. Regardless of the method used, both flows converge at the **Player Service** which is the sole issuer of application-level JWTs. The frontend delegates session management to **next-auth**, which abstracts the OAuth dance and stores the resulting application token in an encrypted HttpOnly cookie.

This design follows the _identity broker_ pattern: the Player Service acts as the internal identity provider (IdP), and Google acts as an external federated IdP. The API Gateway then acts as a pure policy enforcement point (PEP), validating JWTs without any knowledge of how they were obtained.

![Authentication Overview](diagrams/Authentication%20Overview.png)

KruKasyno supports two authentication methods:
1. **Credentials** (email + password)
2. **Google OAuth 2.0** (federated identity via Google)

Both flows result in a JWT issued by the **Player Service**, which serves as the application-wide session token.

---

## 2. Credentials Login

```
User → POST /api/auth/login (email, password)
     → API Gateway → Player Service /auth/login
     → Player Service: bcrypt.compare(password, hash)
     → Issues JWT: { sub, email, role, exp }
     ← Token returned to browser
```

The JWT is stored in next-auth's encrypted session cookie (`HttpOnly`, `Secure`, `SameSite=Lax`).

![Credentials Login](diagrams/Credentials%20Login.png)

---

## 3. Google OAuth 2.0 Flow

![Google OAuth 2.0 Flow](diagrams/Google%20OAuth%202.0%20Flow.png)

```
User clicks "Continue with Google"
    │
    ▼
next-auth redirects → Google OAuth consent screen
    │
Google returns → authorization code → next-auth callback
    │
next-auth exchanges code → Google access token + id_token
    │
next-auth signIn callback → POST /api/auth/google
    │  { googleId, email, name }
    ▼
API Gateway → Player Service /auth/google
    │
Player Service:
  ├── If user with googleId exists → return existing user
  ├── If user with email exists → link Google account to existing record
  └── Otherwise → create new user + provision wallet (Wallet Service)
    │
Player Service issues application JWT (HS256)
    ▼
JWT returned to next-auth → stored in encrypted session cookie
```

### Google Account Linking Logic

| Condition | Action |
|---|---|
| `googleId` matches existing record | Sign in to existing account |
| `email` matches existing account (no `googleId`) | Link Google identity to existing account |
| No match found | Create new account + provision wallet |

### Google OAuth Configuration

1. Create project at https://console.cloud.google.com/
2. Enable Google OAuth 2.0
3. Set redirect URI: `https://yourdomain.com/api/auth/callback/google`
4. Copy `Client ID` → `AUTH_GOOGLE_ID`
5. Copy `Client Secret` → `AUTH_GOOGLE_SECRET`

---

## 4. JWT Structure

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "USER | ADMIN",
  "iat": 1700000000,
  "exp": 1700086400
}
```

| Claim | Description |
|---|---|
| `sub` | User UUID (primary identifier across all services) |
| `email` | User email address |
| `role` | `USER` or `ADMIN` |
| `iat` | Issued-at timestamp |
| `exp` | Expiry timestamp (24 h after issuance) |

- **Algorithm**: HS256
- **Expiry**: 24 hours
- **Secret**: `JWT_SECRET` env variable (shared between Player Service and API Gateway; minimum 64 random characters)

---

## 5. Authorization Model

| Role | Permissions |
|---|---|
| `USER` | Play games, manage own wallet, view own profile |
| `ADMIN` | All USER permissions + list/ban/unban users, change roles |

### JWT Validation at API Gateway

![JWT Validation at API Gateway](diagrams/JWT%20Validation%20at%20API%20Gateway.png)

1. Browser sends request with `Authorization: Bearer <JWT>`
2. API Gateway verifies signature using `JWT_SECRET`
3. Checks `exp` claim — rejects expired tokens with `401 Unauthorized`
4. Extracts `sub` (user ID) and `role`
5. For admin routes, checks `role === ADMIN` — rejects with `403 Forbidden` if not
6. Injects `X-User-Id` and `X-User-Role` headers and forwards request to the target service

### Service-to-Service Auth

Internal service calls (Game Service → Wallet Service, etc.) use `X-Service-Key: <SERVICE_API_KEY>` header. This key is shared exclusively between all VPS2 services and is never exposed through the public API.

---

## 6. Session Management (next-auth)

- Strategy: `jwt` (stateless — no server-side session database required)
- Session cookie: encrypted with `NEXTAUTH_SECRET`, `HttpOnly`, `Secure`, `SameSite=Lax`
- The session stores:
  - `applicationToken` — the full Player Service JWT used for all API calls
  - `user.id`, `user.role`, `user.username`
- Session TTL: 24 hours (matches JWT expiry)

The next-auth `jwt` callback enriches the session with the application JWT received from the Player Service. The next-auth `session` callback exposes the required fields to the frontend client.

---

## 7. Security Considerations

| Control | Implementation |
|---|---|
| Password storage | `bcrypt` with cost factor 12 |
| JWT signing | HS256 with secret ≥ 64 random characters |
| Session cookie | `HttpOnly`, `Secure`, `SameSite=Lax`, encrypted with `NEXTAUTH_SECRET` |
| Rate limiting | NGINX + API Gateway middleware on `/auth/*` endpoints |
| Service key isolation | `X-Service-Key` is VPS2-internal only; never forwarded from API Gateway to client |
| Google token handling | Google `access_token` and `id_token` are never persisted; only the derived application JWT is stored |
| HTTPS enforcement | All external traffic served over TLS via NGINX; HTTP redirected to HTTPS |
