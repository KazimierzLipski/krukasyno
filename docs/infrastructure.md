# KruKasyno — Infrastructure & Deployment

## 1. Node Topology

| Node | Role | Services |
|---|---|---|
| VPS 1 | Public, internet-facing | NGINX, Frontend, API Gateway |
| VPS 2 | Private, backend | Player Service, Game Service, Wallet Service, MySQL, Redis |

VPS1 → VPS2 communication uses the `BACKEND_HOST` environment variable (VPS2 private IP or hostname).

---

## 2. Prerequisites

Both VPS instances must run Ubuntu 22.04 LTS.
Your local machine must have:
- Ansible 2.12+
- SSH key installed on both VPS instances
- `community.general` and `community.docker` Ansible collections

```bash
ansible-galaxy collection install community.general community.docker
```

---

## 3. Deployment Steps

### Step 1: Configure Inventory

```bash
cp ansible/inventory.ini.example ansible/inventory.ini
# Edit ansible/inventory.ini with your VPS IPs
```

### Step 2: Configure Secrets

```bash
cp ansible/vars/secrets.example.yml ansible/vars/secrets.yml
# Edit ansible/vars/secrets.yml with real values
ansible-vault encrypt ansible/vars/secrets.yml
```

### Step 3: Configure Google OAuth

1. Create a project at https://console.cloud.google.com/
2. Enable Google+ API / OAuth consent screen
3. Create OAuth 2.0 credentials (Web application)
4. Add redirect URI: `https://yourdomain.com/api/auth/callback/google`
5. Put Client ID and Secret in `ansible/vars/secrets.yml`

### Step 4: Deploy VPS2 First (backend)

```bash
ansible-playbook -i ansible/inventory.ini ansible/playbook-vps2.yml --ask-vault-pass
```

Wait until all three service health checks pass.

### Step 5: Deploy VPS1 (frontend + gateway)

```bash
ansible-playbook -i ansible/inventory.ini ansible/playbook-vps1.yml --ask-vault-pass
```

### Step 6: Verify Deployment

```bash
# Check VPS1 services
ansible vps1 -i ansible/inventory.ini -m shell -a "docker ps"

# Check VPS2 services
ansible vps2 -i ansible/inventory.ini -m shell -a "docker ps"

# Test public endpoint
curl https://yourdomain.com/health  # NGINX should respond
```

---

## 4. Local Development

Start all services with a single command:

```bash
cp .env.example .env
# Fill in your .env (use any JWT_SECRET and SERVICE_API_KEY for dev)
docker compose up --build
```

Services available at:
- http://localhost — Frontend (via NGINX)
- http://localhost:4000 — API Gateway (direct)
- http://localhost:5000 — Player Service (direct)
- http://localhost:6000 — Game Service (direct)
- http://localhost:7000 — Wallet Service (direct)

---

## 5. Environment Variables Reference

| Variable | Description | Example |
|---|---|---|
| `JWT_SECRET` | Shared secret between Player Service and API Gateway | 64-char random hex |
| `NEXTAUTH_SECRET` | next-auth cookie encryption key | 32-char random |
| `SERVICE_API_KEY` | Internal service authentication | 32-char random |
| `MYSQL_ROOT_PASSWORD` | MySQL root password | Strong password |
| `AUTH_GOOGLE_ID` | Google OAuth Client ID | From Google Console |
| `AUTH_GOOGLE_SECRET` | Google OAuth Client Secret | From Google Console |
| `NEXTAUTH_URL` | Public URL for next-auth callbacks | `https://yourdomain.com` |
| `NEXT_PUBLIC_API_URL` | Public API URL (browser-side) | `https://yourdomain.com/api` |
| `BACKEND_HOST` | VPS2 IP/hostname (used in VPS1 compose) | `10.0.0.2` |

---

## 6. Updating a Deployment

For a full redeployment (rebuild images):

```bash
ansible-playbook -i ansible/inventory.ini ansible/playbook-vps2.yml --ask-vault-pass
ansible-playbook -i ansible/inventory.ini ansible/playbook-vps1.yml --ask-vault-pass
```

For a quick restart without rebuild:

```bash
ansible vps2 -i ansible/inventory.ini -m shell -a \
  "cd /opt/krukasyno && docker compose -f docker-compose.vps2.yml restart"
```

---

## 7. Ansible Roles

| Role | Tasks |
|---|---|
| `common` | apt update, base packages, UFW firewall, fail2ban, unattended-upgrades, timezone |
| `docker` | Docker CE installation, Docker Compose plugin, add ubuntu user to docker group |

---

## 8. DNS Configuration (OVH)

| Record | Type | Value |
|---|---|---|
| `@` | A | VPS1 IP |
| `www` | CNAME | `yourdomain.com` |

TLS: Configure Let's Encrypt with Certbot on VPS1, then update `nginx.conf` with SSL blocks.
