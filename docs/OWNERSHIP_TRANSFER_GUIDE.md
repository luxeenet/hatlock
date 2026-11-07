# HatLock Ownership Transfer & Agreement Lifecycle Guide

## 1. Hire-Purchase Ownership Transfer Workflow

Under a **Hire-Purchase (HP)** contract, the customer acquires ownership of the financed laptop **only after all contractual obligations are completely fulfilled**.

### Prerequisites for Ownership Transfer:
1. **100% Principal and Financing Paid:** Total verified payments in the immutable financial ledger must equal or exceed `totalContractualTZS`.
2. **Zero Outstanding Late Fees or Penalties:** Any penalties incurred must be fully settled.
3. **No Unresolved Disputes or Chargebacks:** Account must have zero pending reversals.
4. **Idempotency Guard:** `ownershipTransferredAt` must be null. Once issued, an ownership transfer cannot be repeated.

### Automated Actions Upon Verification:
1. `FinancingAgreement.status` transitions to `OWNERSHIP_TRANSFERRED`.
2. `Device.status` updates to `CUSTOMER_OWNED`.
3. Agent permanently receives `UNRESTRICT` command and is unlinked from business restriction policies.
4. Ownership Certificate PDF is generated and made downloadable in both the Business Admin Dashboard and the Customer Self-Service Portal.
5. Permanent audit record written to `OwnershipTransfer` and `AuditLog`.

---

## 2. Rental Agreements: Permanent Business Ownership Retention

Under a **Rental (RT)** contract:
- The device **always remains the exclusive property of the business**.
- Payments represent service fees for usage during a defined lease period, **not equity towards ownership**.
- Upon expiration or termination:
  1. The customer either renews the agreement (creating a new rental cycle) or initiates a **Device Return**.
  2. Physical inspection assesses damage and missing accessories.
  3. Security deposit is reconciled and refunded minus documented deductions.
- **System Guard:** The HatLock financial engine strictly rejects any ownership transfer command against agreements marked `RENTAL`.
