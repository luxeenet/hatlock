# HatLock by Luxeenet — System Architecture & Design
**Product:** HatLock  
**Company:** Luxeenet  
**Tagline:** Smart Device Financing. Secure Payments. Controlled Access.

---

## 1. High-Level Architecture Overview

HatLock is an enterprise multi-tenant SaaS platform built to finance, sell laptops through hire-purchase, or rent laptops while enforcing payment compliance and protecting physical devices across Windows and Linux.

```
+---------------------------------------------------------------------------------+
|                                 CLIENT TIER                                     |
|  +-----------------------------+       +-------------------------------------+  |
|  |  Business Admin Web App     |       |  Customer Self-Service Portal       |  |
|  |  (Next.js 14 - Port 3002)   |       |  (Next.js 14 - Port 3001)           |  |
|  +--------------+--------------+       +------------------+------------------+  |
+-----------------|-----------------------------------------|---------------------+
                  |                                         |
                  v                                         v
+---------------------------------------------------------------------------------+
|                               API GATEWAY TIER                                  |
|  +---------------------------------------------------------------------------+  |
|  |                      Fastify REST API (Port 3000)                         |  |
|  |  - Multi-tenant isolation middleware                                      |  |
|  |  - RBAC (Super-Admin, Business Owner, Admin, Employee, Customer)          |  |
|  |  - OpenAPI 3.0 / Swagger documentation at /docs                           |  |
|  |  - Rate limiting (Redis-backed) & Helmet security headers                 |  |
|  +---------------------------------------------------------------------------+  |
+--------------------------------------|------------------------------------------+
                                       |
+--------------------------------------v------------------------------------------+
|                            CORE SERVICE ENGINES                                 |
|  +------------------------+  +------------------------+  +--------------------+ |
|  | Financing Engine (HP)  |  | Rental Engine (Lease)  |  | Financial Ledger   | |
|  | - Ownership Transfer   |  | - Business Retention   |  | - Immutable audit  | |
|  | - Contract Schedule    |  | - Security Deposit     |  | - Decimal-safe     | |
|  +------------------------+  +------------------------+  +--------------------+ |
|  +------------------------+  +------------------------+  +--------------------+ |
|  | Device Command Service |  | HatPesa Payment Engine |  | PDF Generator      | |
|  | - ECDSA P-256 Signing  |  | - Mobile Money checkout|  | - Ownership Certs  | |
|  | - Nonce Replay Guard   |  | - Webhook verification |  | - Contracts        | |
|  +------------------------+  +------------------------+  +--------------------+ |
+--------------------------------------|------------------------------------------+
                                       |
+--------------------------------------v------------------------------------------+
|                             DATA & EVENT TIER                                   |
|  +-------------------------------------+  +----------------------------------+  |
|  | PostgreSQL 16 (Relational / Prisma) |  | Redis 7 + BullMQ                 |  |
|  | - Strict multi-tenant schema        |  | - Periodic overdue jobs          |  |
|  | - Immutable financial records       |  | - Heartbeat liveness monitors    |  |
|  +-------------------------------------+  +----------------------------------+  |
+--------------------------------------^------------------------------------------+
                                       |
+--------------------------------------|------------------------------------------+
|                            DEVICE PROTECTION AGENTS                             |
|  +-------------------------------------+  +----------------------------------+  |
|  | Windows Agent (.NET 10 Service)     |  | Linux Agent (Rust Daemon)        |  |
|  | - DPAPI credential store            |  | - 0600 secure store              |  |
|  | - WMI composite hardware identity   |  | - sysfs & DMI hardware collector |  |
|  | - Fullscreen overlay restriction    |  | - sysfs TPM 2.0 & Secure Boot    |  |
|  | - Heartbeat & command polling (30s) |  | - loginctl / wall restriction    |  |
|  +-------------------------------------+  +----------------------------------+  |
+---------------------------------------------------------------------------------+
```

---

## 2. Hire-Purchase vs. Rental Business Segregation

| Dimension | Hire-Purchase (HP) | Rental (RT) |
|---|---|---|
| **Ultimate Legal Owner** | Transferred to Customer upon full completion | Retained permanently by Business |
| **Initial Payment** | Down payment / Deposit towards purchase | Refundable Security Deposit (held as liability) |
| **Periodic Charges** | Principal + Financing Charges | Rental service charges |
| **Contract Completion** | Verification -> Ownership Transfer Certificate issued -> Restriction permanently removed | Return of device or contract renewal |
| **Return Handling** | Allowed under repossession or default | Standard return workflow with physical inspection & deposit reconciliation |

---

## 3. Hardware Identity & OS-Switching Detection

Devices compute a SHA-256 fingerprint from:
- System UUID
- Motherboard serial
- Storage drive serials (SSDs)
- Primary MAC address
- TPM 2.0 endorsement indicators and Secure Boot status

When an operating system is reformatted (e.g. from Windows to Linux or vice-versa), the newly installed agent submits the identical hardware fingerprint. The API detects the existing hardware fingerprint, matches the active agreement, applies the existing authorization state, and flags an `OS_SWITCHED` event to the business dashboard.
