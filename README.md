# Gulf Energy ERP | شركة الخليج للطاقة

An enterprise-grade SAP S/4HANA-inspired ERP desktop solution for Oil & Gas and energy logistics operations. Built with React 19, TypeScript (strict), Vite, Dexie (IndexedDB), Tailwind CSS, and full offline-first capabilities.

---

## Security Model

Gulf Energy ERP enforces an SAP-grade, defense-in-depth security architecture with zero tolerance for implicit defaults, pseudo-users, or unauthenticated writes.

### 1. Actors & Active Session Context
- **Zero Auto-Sessions**: The application boots in an unauthenticated state. No default or automatic administrator sessions exist.
- **Active Actor Context**: Every authenticated user session is registered with `SessionContext.setActor({ userId, username, role })`.
- **Service-Level RBAC Enforcement**: Business services guard every mutating method using `requirePermission({ module, activity })`. If no actor is active or if the active actor's role lacks the authorization object or exceeds scope constraints (plant, cost center, financial DOA approval limits), the service immediately aborts and throws an authorization error.
- **HMAC-Signed Session Tokens**: Session tokens are cryptographically signed with HMAC-SHA256 (`userId:roleCode:expiresAt`) using an installation key managed via Web Crypto API.

### 2. System Context
- System initialization tasks, number range initialization, and automated closing tasks do not assume an interactive actor.
- Instead, every system-level operation explicitly runs under an ActionContext with `{ system: true, userName: 'SYSTEM' }`.
- Hardcoded fallback pseudo-users (such as `SYS-AUTO` or `DEFAULT_ADMIN`) are strictly forbidden and barred by static guard tests.

### 3. Auth-Event Context
- Authentication handshake events (such as tracking failed login attempt counts, lockout timers, unlocking accounts, and self-service password updates) execute before or during session lifecycle transitions.
- Every repository mutation in this phase must pass an explicit authentication-event context containing `{ userId, userName }` (or `{ system: true, userName }`).
- Repository write calls reject implicit defaults.

### 4. First-Boot OTP (One-Time Password)
- During fresh non-demo installation, the system generates a 16-character cryptographically random one-time administrator password using `crypto.getRandomValues()` from an unambiguous alphabet (excluding easily confused characters such as `0`, `O`, `1`, `l`, `I`).
- The OTP is hashed using PBKDF2 with SHA-256 and 100,000 iterations, with an individual 16-byte random salt.
- **Strict Storage Isolation**: The plaintext OTP is **NEVER** stored in IndexedDB or `localStorage`.
- **Transient Memory/SessionStorage Mirror**: To prevent administrative lockout if the browser tab is refreshed before initial login, the OTP is cached in memory and mirrored in `sessionStorage` under key `gulf_fb_otp`.
- The OTP is immediately and permanently wiped from both memory and `sessionStorage` as soon as the administrator completes their first login or changes their password.

### 5. Forced Password Change
- The initial administrator account is provisioned with `mustChangePassword: true`.
- Upon successful authentication with the initial OTP, the navigation router locks access to operational screens and routes the user directly to the password change screen (`/change-password`).
- The password policy requires at least 10 characters including uppercase, lowercase, numbers, and special symbols, and must differ from the temporary OTP.
- Changing the password generates a brand-new random 32-character hex salt, hashes the new password with PBKDF2, sets `mustChangePassword: false`, and logs a full audit trail record.

### 6. Demo Mode Flag (`VITE_DEMO_MODE`)
- Controlled via the `VITE_DEMO_MODE` environment variable (default: `false` in `.env.example`).
- **Demo Mode (`true`)**: Seeds 10 enterprise demonstration roles (Admin, Procurement Manager, Procurement Officer, Warehouse Clerk, Fleet Manager, Accountant, Finance Director, Auditor, Asset Manager, Read-Only Viewer) with sample master data and transactions for evaluation. Each user is assigned a distinct cryptographic random salt.
- **Production Mode (`false`)**: Seeds ONLY the initial administrator account with a temporary one-time password and `mustChangePassword: true`. No sample users or pre-configured credentials exist.

---

## How to Run Tests

The test suite covers unit math, domain services, security lifecycle, static architecture guards, and end-to-end authorization scenarios on in-memory and fake-indexeddb environments.

### 1. Run Complete Test Suite
```bash
npx vitest run
```

### 2. Run Static Guard Tests
Validates that forbidden tokens (`DEFAULT_ADMIN`, `SYS-AUTO`, `: any`, `as any`, `console.log`), unauthorized storage keys, unguarded repository writes, and legacy fixed salts are absent:
```bash
npx vitest run src/tests/guards.test.ts
```

### 3. Run End-to-End Security & Authorization Tests
Verifies real domain services against role transitions (viewer rejection -> accountant execution -> audit userId attribution -> logout rejection) and fresh non-demo seed credentials:
```bash
npx vitest run src/tests/security-e2e.test.ts
```

### 4. Run TypeScript Strict Compilation Check
```bash
npx tsc --noEmit
```

### 5. Run Production Vite Build
```bash
npm run build
```
