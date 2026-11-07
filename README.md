# HatLock by Luxeenet
> **Smart Device Financing. Secure Payments. Controlled Access.**

Enterprise Laptop Financing, Hire Purchase, Rental & Cross-Platform Device Protection SaaS platform developed by **Luxeenet**.

---

## Architecture Overview

```
hatlock/
├── agents/
│   ├── windows/          # C# .NET 10 LTS Windows Service Agent
│   └── linux/            # Rust Daemon Agent (systemd)
├── apps/
│   ├── api/              # Fastify + TypeScript Multi-Tenant REST API
│   ├── web/              # Next.js 14 Business Management Dashboard
│   └── customer-portal/  # Next.js 14 Customer Self-Service Portal
├── packages/
│   ├── database/         # Prisma Schema (1,400+ lines) & Seeder
│   ├── shared/           # Cross-package TypeScript types & schemas
│   └── hatpesa/          # HatPesa Mobile Money Integration SDK
├── docs/                 # Architecture, Security & Operational Guides
├── docker-compose.yml    # Complete stack compose specification
└── .env.example          # Environment variables template
```

---

## Key Features

1. **Multi-Tenant SaaS Architecture:** Tenant isolation enforced via database relationships and request-scoped middleware.
2. **Dual Model Financing Engine:**
   - **Hire-Purchase (HP):** Structured instalment plans leading to automated, verified **Ownership Transfer** with certificates upon full settlement.
   - **Rental (RT):** Flexible lease cycles retaining **100% Business Ownership**, security deposit isolation, and physical return inspections.
3. **Cross-Platform Device Protection Agents:**
   - **Windows:** Hardware identity extraction (WMI, TPM 2.0, Secure Boot), DPAPI storage, fullscreen lock overlay restriction, and ECDSA-signed command execution.
   - **Linux:** sysfs/DMI identity collector, `0600` permission credential store, terminal broadcast and desktop lock screen enforcement, and systemd service.
4. **Hardware Fingerprinting & OS Re-installation Detection:** Detects when a customer switches operating systems (Windows <-> Linux) or replaces storage drives, re-linking the existing agreement and maintaining protection policies.
5. **HatPesa Mobile Money Payments:** Automated checkout with M-Pesa, Airtel Money, and Tigo Pesa, idempotency verification, and instant device restoration.
6. **Self-Service Customer Portal:** Agreement overviews, payment histories, mobile money checkout, and ownership transfer downloads.

---

## Quickstart

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env

# 3. Start database and cache
docker compose up -d postgres redis

# 4. Generate Prisma client & seed demo records
npm --prefix packages/database run generate
npm --prefix packages/database run seed

# 5. Start API & Frontends in development
npm --prefix apps/api run dev
npm --prefix apps/web run dev
npm --prefix apps/customer-portal run dev
```

### Default Demo Accounts:
- **Super Admin:** `admin@luxeenet.com` / `Password123!`
- **Business Owner:** `owner@dartech.co.tz` / `Password123!`
- **Customer Portal:** `juma.ally@example.com` / `Password123!`

---

## Documentation Links

- [System Architecture](file:///c:/Users/hatlock/docs/ARCHITECTURE.md)
- [Security Threat Model](file:///c:/Users/hatlock/docs/SECURITY_THREAT_MODEL.md)
- [Ownership Transfer & Rental Guide](file:///c:/Users/hatlock/docs/OWNERSHIP_TRANSFER_GUIDE.md)
- [Deployment & Operations Guide](file:///c:/Users/hatlock/docs/DEPLOYMENT_GUIDE.md)
- [Implementation Tracker](file:///c:/Users/hatlock/HATLOCK_IMPLEMENTATION_TRACKER.md)
