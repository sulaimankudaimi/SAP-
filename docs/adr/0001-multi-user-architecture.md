# ADR 0001: Multi-User Server-Authoritative Architecture for Sham Energy ERP

- **Status**: Accepted
- **Date**: 2026-10-11
- **Deciders**: Principal Software Architect, Engineering Lead
- **Technical Domain**: Enterprise Architecture, High-Integrity Accounting, Energy Logistics

---

### DECISION CARD (Binding Parameters)

```ini
SERVER_HOSTING        = self-hosted-lan
MAX_CONCURRENT_USERS  = 15
SITES                 = 3
OFFLINE_FIELD_ENTRY   = yes
```

---

## 1. Context

Today, Sham Energy ERP runs exclusively as single-tenant client-side installations with data persisted in browser-local IndexedDB via Dexie. Every workstation or mobile terminal acts as an isolated data island. Master data, transaction documents, inventory movements, and journal entries created on one device cannot be seen, validated, or consolidated in real time by other users.

The organization operates across three distinct operational sites in Syria:
1. **Damascus Headquarters** (Executive governance, procurement approvals, corporate accounting, financial closing).
2. **Homs Industrial Complex** (Bulk fuel dispatching, fleet terminal, regional fuel sales).
3. **Baniyas Coastal Terminal** (Chemicals logistics, vehicle maintenance workshops, spare parts warehousing).

Under normal operational peaks, up to 15 concurrent users interact simultaneously with the ERP across administrative desks, warehouse counters, maintenance bays, and dispatch offices. Furthermore, field logistics staff and tanker drivers must record fuel distribution logs, odometer readings, and routine safety inspections in industrial loading areas where local Wi-Fi or cellular connectivity is frequently interrupted (`OFFLINE_FIELD_ENTRY = yes`).

In an SAP S/4HANA-aligned ERP supporting oil, gas, and hazardous chemical transport, concurrent multi-user operations must never corrupt financial ledgers, produce unbalanced double-entry accounting records, violate sequential audit trails, allow stock balances to diverge from movement ledgers, or result in duplicate/gapped official document numbers.

---

## 2. Options considered

### Option 1: Isolated Islands with File Import/Export (Current State)
Keep each station completely autonomous. Users export and import encrypted JSON/AES-256 backup snapshots at the end of each shift or business day.
- **Pros**: 100% offline; zero server infrastructure; zero hosting maintenance.
- **Cons**: Severe data latency; reconciliation nightmares at month-end closing; impossibility of real-time credit checks or fleet tracking across sites; high probability of conflicting changes to master data.
- **Verdict**: **Rejected**. Incompatible with a modern multi-site energy enterprise.

### Option 2: Multi-Master Offline Sync with Conflict Resolution (P2P / Bidirectional Merging)
Allow every device to act as an authoritative replica. Transactions, journal entries, inventory movements, and document number increments are generated locally and synced asynchronously using Last-Writer-Wins (LWW) or field-level merge heuristics.
- **Pros**: Complete offline functionality for every module at any time.
- **Cons**: **Unsafe for financial ledgers, inventory balances, and compliance numbering**. Last-Writer-Wins and three-way document merging corrupt double-entry accounting invariants, allow duplicate allocation of the last remaining fuel batch, and produce duplicate or fractured document numbers (MIGO material documents, FI journal entries). Ledger entries cannot be "merged" without invalidating the trial balance.
- **Verdict**: **Rejected**. Fundamentally violates GAAP/IFRS and SAP ERP transactional integrity.

### Option 3: Server-Authoritative with Command-Based Clients (Chosen)
Deploy a central PostgreSQL database behind Supabase self-hosted on the company local area network (`SERVER_HOSTING = self-hosted-lan`), accessible securely across the 3 physical sites via internal enterprise LAN/VPN. The server alone is the single source of truth and authoritative domain engine.
- The server exclusively assigns sequential document numbers, calculates inventory stock balances, posts balanced double-entry journal entries, validates permission boundaries via Row-Level Security (RLS), and commits the immutable audit log chain.
- Client applications operate as command emitters: they perform optimistic client-side validation and send commands to the server; they never write balances, journals, or document numbers directly.
- Field mobility is supported by queueing strictly whitelisted, append-only operational events (such as fuel logs and inspection checklists) tagged with client-generated idempotency keys (`request_id`).
- **Pros**: Rock-solid financial and stock integrity; single source of truth; zero duplicate numbers; full auditability; secure LAN deployment preserving corporate data sovereignty.
- **Cons**: Document creation, approvals, and financial postings require network connectivity to the server.
- **Verdict**: **Chosen**.

### Option 4: Conflict-Free Replicated Data Types (CRDT)
Use state-based or operation-based CRDTs (e.g., Automerge, Yjs) across all ERP tables to guarantee eventual mathematical convergence without a central coordinator.
- **Pros**: Peer-to-peer convergence without manual conflict resolution.
- **Cons**: CRDTs are designed for collaborative text, maps, and registers; they have no business semantics for conservation of mass/value, double-entry trial balances ($\sum \text{Debits} = \sum \text{Credits}$), fiscal period lock dates, or non-negative stock constraints.
- **Verdict**: **Rejected**. Does not satisfy enterprise ERP financial invariants.

---

## 3. Decision

We decide to implement **Option 3: Server-Authoritative Architecture with PostgreSQL behind Supabase self-hosted on the company local area network (`self-hosted-lan`)**.

1. **Single Source of Truth**:
   The self-hosted PostgreSQL database on the enterprise LAN is the definitive authority for all master data, transaction documents, inventory ledgers, and financial records.

2. **Server-Side Domain Ownership**:
   - **Document Numbers**: The server alone generates gap-free, sequential document numbers (`docNumber`) within database transactions per document type and fiscal year.
   - **Stock Balances**: The server alone updates `stockBalances` and `stockLedger` inside atomic transactions.
   - **Accounting Postings**: The server alone generates and posts General Ledger entries (`journalEntries`), enforces fiscal period validity, and writes to the idempotent `postingRegistry`.
   - **Access Control & Permissions**: Row-Level Security (RLS) policies and authenticated PostgreSQL functions enforce module and activity permissions.
   - **Audit Chain**: The server alone commits immutable, chronological records to `auditLogs`.

3. **Client Role**:
   - Clients send structured business commands through a dedicated `ServerGateway` targeting `VITE_ERP_SERVER_URL`.
   - Clients **never** write balances, journals, or document numbers in server mode.
   - The browser-local database acts as a read-cache and staging outbox for authorized offline commands.

---

## 4. Consequences

### Positive Consequences
- **Absolute Financial & Inventory Integrity**: Concurrent posting of goods receipts, vendor invoices, or stock movements cannot create unbalanced journals or negative stock.
- **Compliance & Auditability**: Every official document possesses a single, gap-free sequence number verified against the server-side number range.
- **Data Sovereignty & Security**: Sensitive energy logistics and fuel pricing data remain strictly within the company's internal LAN infrastructure (`self-hosted-lan`), protected behind enterprise firewalls without exposure to public cloud endpoints.
- **Clean Gateway Abstraction**: All client-server communication is mediated by a single `ServerGateway`, preserving full backward-compatibility with standalone offline mode when `VITE_SERVER_MODE=false`.

### Negative & Operational Consequences
- High-level financial postings (e.g., period-end closing, invoice release, MIGO goods receipts) require active LAN/VPN connectivity.
- Requires dedicated on-premise server provisioning and automated PostgreSQL backup routines across the 3 physical sites.
- Client applications must handle asynchronous command results and potential server-side concurrency rejections gracefully.

---

## 5. Invariants

The architecture guarantees that the following seven fundamental invariants remain unbroken at all times. Automated integrity verification scripts will continuously audit these invariants:

1. **Unique Document Numbers**:
   Every committed transaction document must have a distinct, sequential, and gap-free document number (`docNumber`) for its type and fiscal year. No duplicates or gaps are permitted in committed transactions.
2. **One Balanced Journal per Business Document**:
   Every posted business document (Goods Receipt, Vendor Invoice, Asset Capitalization/Disposal, Trip Cost Allocation, Depreciation Run) must have exactly one balanced journal entry in `journalEntries` where total debits equal total credits ($\sum \text{Debits} = \sum \text{Credits}$).
3. **Zero-Sum Trial Balance**:
   Across the entire General Ledger, the sum of all debits must equal the sum of all credits ($\sum \text{Debits} - \sum \text{Credits} = 0.00$) across all GL accounts and fiscal periods.
4. **Stock Balance Ledger Identity**:
   For every material code, plant code, and storage location, the unrestricted and blocked quantities in `stockBalances` must precisely match the mathematical sum of all positive and negative quantities recorded in `stockLedger`.
5. **Non-Negative Stock Rule**:
   No material balance may drop below zero ($Quantity \ge 0$) unless the specific plant and storage location configuration explicitly enables negative stock.
6. **Authenticated Actor Provenance**:
   Every database write, state transition, and audit log row must be attributed to an authenticated, verified user identity. Pseudo-users, unauthenticated writes, or implicit fallback actors are prohibited.
7. **Tamper-Evident Audit Chain**:
   The `auditLogs` table is strictly append-only, sequentially numbered, and tamper-evident. Audit rows cannot be modified or deleted.

---

## 6. Conflict policy

### Concurrency Matrix per Entity Type

| Entity Category | Specific Tables | Concurrency & Authority Policy | Conflict Handling Mechanism |
| :--- | :--- | :--- | :--- |
| **Transaction Documents** | `purchaseOrders`, `vendorInvoices`, `trips`, `maintenanceOrders`, `assetTransfers` | **Optimistic Concurrency Control (OCC)** | Client passes `expectedVersion`. Server rejects with `ConcurrencyError` if version differs. Client displays conflict dialog with Reload & Diff views. |
| **Master Data** | `materials`, `vendors`, `customers`, `glAccounts`, `costCenters`, `vehicles`, `drivers`, `plants` | **Optimistic Concurrency Control (OCC)** | Client passes `expectedVersion`. Server rejects with `ConcurrencyError` if record was modified concurrently. |
| **Balances & Sequences** | `stockBalances`, `stockLedger`, `journalEntries`, `numberRanges`, `postingRegistry` | **Server Authoritative Only** | **Clients never write directly**. Calculations, journal postings, and sequence numbering execute exclusively inside server-side transactions. |
| **Append-Only Field Events** | `fuelLogs`, `odometerReadings`, `tripEvents`, `inspectionLogs` | **Idempotent Ingestion via Client UUID** | Client generates unique `request_id` (UUID v4). Server de-duplicates requests idempotently. Re-transmissions return existing record without duplicate postings. |

### Offline Policy

1. **Whitelisted Offline Operations**:
   Only whitelisted, append-only operational commands may be queued locally in an offline outbox:
   - `createFuelLog` (fuel consumption at remote pump stations)
   - `recordOdometerReading` (daily driver check-in)
   - `recordTripInspection` (pre-trip/post-trip safety checklist)
2. **Strict Connectivity Requirements**:
   All financial postings, invoice approvals, purchase order creation/release, inventory transfers (311/261), asset disposals, document cancellations, and master data modifications **strictly require connectivity**. They cannot be queued offline.
3. **Queue Rejection & "Needs Review" Quarantine**:
   Any queued offline event that fails server validation upon reconnection (e.g., referenced vehicle was decommissioned during disconnection) is transferred to a dedicated administrative **"Needs Review" (بحاجة لمراجعة)** quarantine list. Queued items are **never silently dropped**.

---

## 7. Rollout

To ensure absolute operational safety and minimize organizational risk, the multi-user architecture will follow a phased vertical-slice migration:

1. **Phase 1: Architecture Decision Record & Policy Encoding (Current Phase)**
   - Commit ADR 0001 into the repository.
   - Update `PROJECT_RULES.md` and `.env.example`.
   - Implement static guard tests enforcing network boundaries, ADR completeness, and `service_role` isolation.

2. **Phase 2: Gateway Layer & Database Schema Provisioning**
   - Implement `ServerGateway` in `src/core/gateway`.
   - Setup Supabase LAN instance schemas, RLS policies, and RPC endpoints.
   - Provide offline outbox queue and network state detection.

3. **Phase 3: Fleet Management Vertical Slice (Pilot Migration)**
   - Migrate Fleet Management (`vehicles`, `drivers`, `trips`, `fuelLogs`, `maintenanceOrders`).
   - Connect integrated touchpoints: spare parts inventory issue (SAP Movement 261 via InventoryService) and automatic trip/fuel cost GL postings (via AutomaticPostingEngine).
   - Conduct a **14-day live pilot** across the 3 physical sites with up to 15 concurrent users.
   - **Pilot Exit Criteria**:
     - 100% of the 7 invariants pass automated integrity audits with zero discrepancies.
     - Zero unhandled concurrency collisions.
     - Offline fuel entries sync seamlessly upon vehicle return to depot Wi-Fi.

4. **Phase 4: Subsequent Module Migration**
   - Strictly **no other module is migrated** until the Fleet pilot exit criteria are fully satisfied and approved.
   - Subsequent sequence: Inventory & Warehouse Management $\rightarrow$ Accounts Payable & Finance $\rightarrow$ Asset Management & Controlling $\rightarrow$ Administrative Workflows.

---

## 8. Changed (Architecture Hardening & Defect Rectifications)

- **Date**: 2026-10-13
- **Context**: Post-review hardening addressing defects F1-F7 across migrations `0009` through `0013`:
  1. **F1 (Missing Client Query Contracts)**: Provisioned `fuel_anomaly_alerts` table and client-matching RPCs (`get_vehicle_expiry_alerts`, `get_vehicle_cost_report`, `get_fleet_dashboard_kpis`) in `0012_fleet_reporting.sql`.
  2. **F2 (Read-Only RLS & Missing Master RPCs)**: Implemented explicit whitelist mutation RPCs in `0010_fleet_master_commands.sql` (`create_vehicle`, `update_vehicle`, `set_vehicle_active`, `create_driver`, `update_driver`, `set_driver_active`) with OCC versioning and soft-deactivation (zero deletes).
  3. **F3 (Offline Field Telemetry)**: Provisioned persistent tables (`trip_events`, `odometer_readings`, `vehicle_inspections`) and commands (`record_trip_event`, `record_odometer_reading`, `record_inspection`) in `0011_field_events.sql` with chronological boundary verification.
  4. **F4 (Idempotency Race)**: Introduced `begin_command` atomic pessimistic row locking on `command_requests (status: in_progress | done)` in `0009_idempotency_security.sql`.
  5. **F5 (Privilege Leakage & Authorization Fail-Closed)**: Revoked execute on public schema from `PUBLIC` and `anon`; tightened `has_permission` to fail closed if `must_change_password = true` or `p_plant` is NULL with restricted scopes; added `complete_password_change` RPC in `0009_idempotency_security.sql`.
  6. **F6 (Role Drift Prevention)**: Built `scripts/generate-roles-sql.ts` to deterministically synchronize `SYSTEM_ROLES` to `0013_roles_sync.sql`, safeguarded by `roles-sync.test.ts`.
  7. **F7 (Optional pg_cron Resilience)**: Wrapped `0008_integrity_runs_scheduled.sql` in a safe `DO` block with exception fallback when `pg_cron` is uninstalled.

- **Date**: 2026-10-18
- **Context**: Post-review server-side gap rectifications addressing defects S1-S5 in migration `0014_client_contract_fixes.sql`:
  1. **S1 & S2 (Fuel Anomaly Alerts Lifecycle & Column Normalization)**: Upgraded `fuel_anomaly_alerts` with lifecycle tracking columns (`resolved_at`, `resolved_by`, `updated_at`, `version`) and added deprecation comments on camelCase legacy columns. Implemented server-authoritative command `resolve_fuel_anomaly` with `begin_command` idempotency, vehicle plant permission enforcement, OCC version bumping, and audit logging.
  2. **S3 (Realtime Publication Enrollment)**: Added an idempotent `DO` block enrolling all core fleet tables (`vehicles`, `drivers`, `trips`, `fuel_logs`, `maintenance_orders`, `preventive_schedules`, `fuel_anomaly_alerts`) into `supabase_realtime` publication.
  3. **S4 (Static Migration & Contract Linting)**: Implemented automated static verification test `migrations-lint.test.ts` enforcing contiguous migration numbering, zero PostgREST function overloads, explicit authenticated grants for all client-invoked RPCs, table/view presence for all `.from()` calls, universal RLS enforcement, and complete isolation of elevated roles.
  4. **S5 (Immutability Policy on Operational Documents)**: Enforced architectural invariant that operational documents and ledgers (`trips`, `fuel_logs`, `maintenance_orders`) never possess `is_deleted` flags and are strictly immutable; added official database comments mandating status-based filtering and cancellation workflows.

