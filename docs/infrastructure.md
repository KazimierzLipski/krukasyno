# KruKasyno — Infrastructure & Deployment

## 1. Node Topology

KruKasyno's production environment spans two OVHcloud Ubuntu 22.04 VPS instances. The split ensures that databases and backend services are never directly reachable from the internet. All public traffic is handled exclusively by VPS1.

| Node | Role | Services |
|---|---|---|
| VPS 1 | Public, internet-facing | NGINX, Frontend, API Gateway |
| VPS 2 | Private, backend | Player Service, Game Service, Wallet Service, MySQL, Redis |

VPS1 → VPS2 communication uses the `BACKEND_HOST` environment variable (VPS2 private IP or hostname). No VPS2 port is exposed to the public internet.

### Docker Networks

| Network | VPS | Attached Services |
|---|---|---|
| `public-net` | VPS1 | NGINX, Frontend, API Gateway |
| `private-net` | VPS2 | Player Service, Game Service, Wallet Service, MySQL, Redis |

---

## 2. Infrastructure as Code (Ansible)

All provisioning and deployment is fully automated with Ansible. A single playbook run installs Docker, configures the firewall, deploys the compose stack, and starts the services.

![Infrastructure as Code](diagrams/Infrastructure%20as%20Code.png)

### Prerequisites

Both VPS instances must run Ubuntu 22.04 LTS.
Your local machine must have:
- Ansible 2.12+
- SSH key installed on both VPS instances
- `community.general` and `community.docker` Ansible collections

```bash
ansible-galaxy collection install community.general community.docker
```

### Ansible Roles

| Role | Tasks |
|---|---|
| `common` | apt update, base packages, UFW firewall rules, fail2ban, unattended-upgrades, timezone |
| `docker` | Docker CE installation, Docker Compose plugin, add `ubuntu` user to docker group |

---

## 3. Deployment Steps

![Deployment Steps](diagrams/Deployment%20Steps.png)

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

Secrets are rendered to a `.env` file on each VPS using the `ansible/templates/env.j2` Jinja2 template at deploy time.

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

Wait until all three service health checks pass before proceeding.

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
curl https://yourdomain.com/health  # NGINX should respond 200
```

---

## 4. Local Development

Start all services with a single command:

```bash
cp .env.example .env
# Fill in your .env (any JWT_SECRET and SERVICE_API_KEY suffice for dev)
docker compose up --build
```

Services available locally:

| Service | URL |
|---|---|
| Frontend (via NGINX) | http://localhost |
| API Gateway | http://localhost:4000 |
| Player Service | http://localhost:5000 |
| Game Service | http://localhost:6000 |
| Wallet Service | http://localhost:7000 |

In the local compose, the API Gateway is attached to both `public-net` and `private-net`, allowing it to reach all services on a single host. This topology mirrors the two-VPS production split without requiring two machines.

---

## 5. Environment Variables Reference

| Variable | Service(s) | Description | Example |
|---|---|---|---|
| `JWT_SECRET` | Player Service, API Gateway | Shared HS256 signing secret | 64-char random hex |
| `NEXTAUTH_SECRET` | Frontend | next-auth cookie encryption key | 32-char random |
| `SERVICE_API_KEY` | All VPS2 services | Internal service-to-service auth key | 32-char random |
| `MYSQL_ROOT_PASSWORD` | MySQL | MySQL root password | Strong password |
| `AUTH_GOOGLE_ID` | Frontend | Google OAuth Client ID | From Google Console |
| `AUTH_GOOGLE_SECRET` | Frontend | Google OAuth Client Secret | From Google Console |
| `NEXTAUTH_URL` | Frontend | Public URL for next-auth callbacks | `https://yourdomain.com` |
| `NEXT_PUBLIC_API_URL` | Frontend | Public API URL (browser-side fetch) | `https://yourdomain.com/api` |
| `BACKEND_HOST` | API Gateway (VPS1) | VPS2 IP or hostname | `10.0.0.2` |

> All secrets must be set in `ansible/vars/secrets.yml`. They are injected into the containers via the `env.j2` template at deploy time. **Never commit plaintext secrets to the repository.**

---

## 6. Updating a Deployment

For a full redeployment (pull latest images, rebuild):

```bash
ansible-playbook -i ansible/inventory.ini ansible/playbook-vps2.yml --ask-vault-pass
ansible-playbook -i ansible/inventory.ini ansible/playbook-vps1.yml --ask-vault-pass
```

For a quick restart without rebuild (e.g. after a config change):

```bash
ansible vps2 -i ansible/inventory.ini -m shell -a \
  "cd /opt/krukasyno && docker compose -f docker-compose.vps2.yml restart"
```

For a rolling update of a single service (e.g. game-service):

```bash
ansible vps2 -i ansible/inventory.ini -m shell -a \
  "cd /opt/krukasyno && docker compose -f docker-compose.vps2.yml up -d --no-deps --build game-service"
```

---

## 7. TLS / HTTPS Configuration

TLS termination is handled by NGINX on VPS1.

1. Install Certbot on VPS1:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```
2. Certbot automatically modifies `nginx.conf` to add SSL blocks and configures auto-renewal via systemd timer.
3. All HTTP traffic is redirected to HTTPS via NGINX.

---

## 8. DNS Configuration (OVH)

| Record | Type | Value |
|---|---|---|
| `@` | A | VPS1 public IP |
| `www` | CNAME | `yourdomain.com` |
