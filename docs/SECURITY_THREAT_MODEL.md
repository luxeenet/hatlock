# HatLock Security Threat Model & Defense In Depth

## 1. Threat Matrix & Mitigations

| Threat Vector | Potential Impact | HatLock Engineering Defense |
|---|---|---|
| **OS Re-installation / Wipe** | Bypass local agent restriction | Hardware fingerprint matches across installations via multi-field SHA-256 composite; new agent automatically pulls existing restriction state |
| **Command Spoofing / Tampering** | Unauthorized lock or unlock | All commands signed with server private ECDSA P-256 key; verified locally by agent using public key |
| **Command Replay Attacks** | Replaying unlock or lock commands | Unique nonces per command; agents track executed nonces and reject duplicates; expiry timestamp check |
| **Network Interception (MITM)** | Token theft or command inspection | TLS 1.3 enforced; mutual agent tokens scoped to device ID |
| **Credential Extraction from Disk** | Cloning agent device token | Windows: DPAPI `DataProtectionScope.LocalMachine`. Linux: `/var/lib/hatlock/credentials.json` with strict `0600` root permissions |
| **Multi-Tenant Cross-Access** | Data leak between financing businesses | `tenantMiddleware` validates business scope on every API route; Prisma queries enforce `businessId` filtering |
| **Payment Webhook Spoofing** | False device unlocks without money | HatPesa HMAC-SHA256 signature verification on raw request payload with timing-safe comparison |
| **Floating Point Rounding Drift** | Loss of monetary value in instalments | Decimal.js (`Decimal(14, 2)`) used exclusively across all calculations; PostgreSQL `DECIMAL(14,2)` storage |

---

## 2. Agent Tamper-Resistance Policy
HatLock agents enforce visible, reversible restrictions:
- Fullscreen lock overlay with customer payment instructions and HatPesa payment codes.
- Agent runs as a high-privilege system service (`sc.exe` auto-restart on Windows; `systemd` restart on Linux).
- Fallback restriction methods prevent unauthorized interactive sessions while preserving disk data integrity.
