# KruKasyno — Federated Authentication & Authorization

## 1. Authentication Flow

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

---

## 3. Google OAuth 2.0 Flow

```
User clicks "Continue with Google"
    │
    ▼
next-auth redirects → Google OAuth consent screen
    │
Google returns → authorization code → next-auth
    │
next-auth exchanges code for Google tokens
    │
next-auth signIn callback → POST /api/auth/google
    │  { googleId, email, name }
    ▼
API Gateway → Player Service /auth/google
    │
Player Service:
  - If user with googleId exists → return existing user
  - If user with email exists → link Google account
  - Otherwise → create new user, create wallet
    │
Player Service issues application JWT
    ▼
JWT returned to next-auth → stored in session cookie
```

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

- **Algorithm**: HS256
- **Expiry**: 24 hours
- **Secret**: `JWT_SECRET` env variable (shared between Player Service and API Gateway)

---

## 5. Authorization Model

| Role | Permissions |
|---|---|
| `USER` | Play games, manage own wallet, view own profile |
| `ADMIN` | All USER permissions + list/ban/unban users, change roles |

### JWT Validation

1. Browser sends: `Authorization: Bearer <JWT>`
2. API Gateway validates signature and expiry using `JWT_SECRET`
3. Extracts `sub` (user ID) and `role`
4. Injects `X-User-Id` and `X-User-Role` headers before forwarding to services

### Service-to-Service Auth

Internal service calls use `X-Service-Key: <SERVICE_API_KEY>` header. This key is shared between all VPS2 services and is never exposed publicly.

---

## 6. Session Management (next-auth)

- Strategy: `jwt` (stateless, no database required)
- Session cookie: encrypted, `HttpOnly`, signed with `NEXTAUTH_SECRET`
- The session stores:
  - `applicationToken` — the Player Service JWT for API calls
  - `user.id`, `user.role`, `user.username`
- Session TTL: 24 hours

---

## 7. Security Considerations

- Passwords hashed with `bcrypt` (cost factor 12)
- JWTs signed with `HS256`, secret ≥ 64 random characters
- Rate limiting on auth endpoints (NGINX + API Gateway)
- `X-Service-Key` never exposed through public API
- Google OAuth tokens are never persisted; only the derived application JWT is stored
