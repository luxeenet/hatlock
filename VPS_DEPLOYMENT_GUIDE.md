# HatLock — Production VPS Deployment Guide

This guide provides end-to-end instructions for deploying the **HatLock Universal Device Financing, Management & Security Platform** on a Linux Virtual Private Server (VPS) using Docker and Docker Compose.

---

## 1. System Requirements

| Resource | Minimum | Recommended |
|---|---|---|
| **Operating System** | Ubuntu 22.04 LTS / 24.04 LTS or Debian 12 | Ubuntu 24.04 LTS |
| **CPU** | 2 vCPU | 4 vCPU |
| **RAM** | 2 GB (+ 2GB Swap) | 4 GB or higher |
| **Storage** | 25 GB SSD/NVMe | 50 GB+ SSD |
| **Open Inbound Ports** | `80` (HTTP), `443` (HTTPS), `22` (SSH) | `80`, `443`, `22` |

---

## 2. Server Initialization (SSH & Docker)

### Step 1: Connect to your VPS
```bash
ssh root@YOUR_SERVER_IP
```

### Step 2: System Update & Docker Installation
Execute the following commands to install Git, Docker Engine, Docker Compose, and Nginx:

```bash
# Update package repositories
apt update && apt upgrade -y

# Install essential dependencies
apt install -y git curl ufw nginx certbot python3-certbot-nginx

# Install Docker using the official automated installer
curl -fsSL https://get.docker.com | sh

# Enable and start Docker service
systemctl enable --now docker

# Optional: Set up 2GB swap file (recommended for 2GB RAM instances)
if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
```

---

## 3. Clone Repository & Setup Environment

### Step 3: Clone HatLock from GitHub
```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/luxeenet/hatlock.git
cd hatlock
```

### Step 4: Configure Production `.env`
Create your production `.env` file from `.env.example`:

```bash
cp .env.example .env
nano .env
```

Set the following critical environment variables:

```ini
# --- Core Environment ---
NODE_ENV=production
PORT=3000

# --- PostgreSQL Database ---
POSTGRES_USER=hatlock_admin
POSTGRES_PASSWORD=YourStrongDatabasePassword2026!
POSTGRES_DB=hatlock_db
DATABASE_URL=postgresql://hatlock_admin:YourStrongDatabasePassword2026!@postgres:5432/hatlock_db?schema=public

# --- Redis Cache ---
REDIS_URL=redis://redis:6379

# --- JWT Secrets (generate with: openssl rand -hex 32) ---
JWT_SECRET=f3b89012a4567890abcdef1234567890abcdef1234567890abcdef1234567890
JWT_REFRESH_SECRET=a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890

# --- Payment Gateways ---
# HatPesa
HATPESA_API_KEY=your_live_hatpesa_api_key
HATPESA_API_SECRET=your_live_hatpesa_secret
HATPESA_WEBHOOK_SECRET=your_live_hatpesa_webhook_secret

# SonicPesa
SONICPESA_API_KEY=your_live_sonicpesa_api_key
SONICPESA_API_SECRET=your_live_sonicpesa_secret
SONICPESA_WEBHOOK_SECRET=your_live_sonicpesa_webhook_secret

# --- Public Frontend URLs ---
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

Save and exit (`Ctrl + O`, `Enter`, `Ctrl + X`).

---

## 4. Automated Deployment

Run the automated VPS deployment script:

```bash
chmod +x deploy-vps.sh
./deploy-vps.sh
```

### What this script performs:
1. Starts **PostgreSQL 16** with durable Docker volume storage (`hatlock_postgres_data`).
2. Starts **Redis 7** with persistent snapshotting (`hatlock_redis_data`).
3. Waits for PostgreSQL to pass internal health check probes.
4. Deploys database migrations via Prisma.
5. Builds and launches:
   - `hatlock-api` (Backend Fastify API on port `3000`)
   - `hatlock-web` (Admin Web Dashboard on port `3002`)
   - `hatlock-customer-portal` (Customer Portal on port `3001`)

Verify that all containers are healthy:
```bash
docker compose ps
```

---

## 5. Domain Names, Nginx & SSL Setup

Point your DNS `A` records to your VPS IP:
- `api.yourdomain.com` -> `YOUR_VPS_IP`
- `admin.yourdomain.com` -> `YOUR_VPS_IP`
- `portal.yourdomain.com` -> `YOUR_VPS_IP`

### Step 5: Configure Nginx Reverse Proxy
```bash
nano /etc/nginx/sites-available/hatlock.conf
```

Paste the following reverse proxy configuration:

```nginx
# 1. API Gateway
server {
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# 2. Business Admin Web Dashboard
server {
    server_name admin.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# 3. Customer Portal
server {
    server_name portal.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the configuration and reload Nginx:
```bash
ln -s /etc/nginx/sites-available/hatlock.conf /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### Step 6: Free SSL via Let's Encrypt (Certbot)
```bash
certbot --nginx -d api.yourdomain.com -d admin.yourdomain.com -d portal.yourdomain.com
```

### Step 7: Configure Firewall
```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
ufw status
```

---

## 6. Maintenance & Management

### View Live Container Logs
```bash
# View backend API logs
docker compose logs -f api

# View admin dashboard logs
docker compose logs -f web

# View customer portal logs
docker compose logs -f customer-portal
```

### Pull Updates from GitHub and Redeploy
```bash
cd /var/www/hatlock
git pull origin main
./deploy-vps.sh
```

### Database Backup
```bash
docker compose exec postgres pg_dump -U hatlock_admin hatlock_db > backup_$(date +%F).sql
```

