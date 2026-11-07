# HatLock Deployment & Operations Guide

## 1. Prerequisites
- Docker Engine 24+ & Docker Compose v2+
- Node.js 22 LTS (for bare-metal development)
- PostgreSQL 16 & Redis 7

---

## 2. Docker Compose Quickstart

```bash
# 1. Clone repository and navigate to root
cd /opt/hatlock

# 2. Copy environment template
cp .env.example .env

# 3. Start PostgreSQL and Redis services
docker compose up -d postgres redis

# 4. Run database migrations & seed demo data
npm --prefix packages/database run migrate
npm --prefix packages/database run seed

# 5. Launch all services (API on 3000, Customer Portal on 3001, Admin Web on 3002)
docker compose up -d
```

---

## 3. Verifying Installation

- **API Health Check:** `http://localhost:3000/health`
- **Swagger / OpenAPI Documentation:** `http://localhost:3000/docs`
- **Business Admin Dashboard:** `http://localhost:3002`
- **Customer Portal:** `http://localhost:3001`

---

## 4. Agent Installation on Target Laptops

### Windows:
```powershell
# In an elevated PowerShell prompt:
cd C:\Path\To\HatLock\agents\windows
.\install-agent.ps1 -EnrollmentToken "ENROLL_TOKEN_FROM_DASHBOARD" -ApiUrl "https://api.hatlock.luxeenet.com"
```

### Linux (Ubuntu / Debian / Fedora):
```bash
# In a root bash terminal:
cd /opt/hatlock/agents/linux
sudo chmod +x install.sh
sudo ./install.sh "ENROLL_TOKEN_FROM_DASHBOARD" "https://api.hatlock.luxeenet.com"
```
