import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSeeder } from '../seed';
import { AuthService } from '../core/services/AuthService';
import { FinanceService } from '../modules/finance/services/FinanceService';
import { useAuthStore } from '../core/auth/useAuthStore';
import { SessionContext } from '../core/security/SessionContext';
import { FirstBootSecret } from '../core/security/FirstBootSecret';
import { db } from '../core/db';
import type { JournalEntry } from '../types/models';

/**
 * End-to-End Security & Authorization Lifecycle Tests
 *
 * Exercises real domain services, authentication sessions, RBAC guards,
 * audit trail attribution, and first-boot credential provisioning on fake-indexeddb.
 */
describe('End-to-End Security & Service Authorization Suite', () => {
  beforeEach(async () => {
    // Clear in-memory session and active actor before each run
    useAuthStore.getState().logout();
    SessionContext.clearActor();
    FirstBootSecret.clear();
  });

  it('enforces RBAC barriers on posting services across role transitions and attributes audit rows to authenticated actors', async () => {
    // Step 1: Seed database in Demo Mode
    await DatabaseSeeder.resetAndSeed({ demoMode: true });

    // Step 2: Login as VIEWER
    const viewerLoginResult = await AuthService.login('viewer', 'Admin@123');
    useAuthStore.getState().setSession(viewerLoginResult);

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.username).toBe('viewer');
    expect(useAuthStore.getState().role?.code).toBe('VIEWER');

    // Step 3: Define a real posting service call (Create balanced Journal Entry FB50)
    const executePostingCall = async (): Promise<JournalEntry> => {
      const activeUser = useAuthStore.getState().user;
      return await FinanceService.createJournalEntry({
        companyCode: '1000',
        fiscalYear: '2026',
        period: 3,
        postingDate: '2026-03-15',
        documentDate: '2026-03-15',
        documentType: 'SA',
        headerText: 'E2E Posting Authorization Check',
        createdBy: activeUser ? activeUser.id : 'unknown-caller',
        lines: [
          {
            accountNumber: '120010',
            accountName: 'مخزون الديزل والبنزين',
            debit: 35000,
            credit: 0,
            lineText: 'استلام وقود مستودع الرياض',
          },
          {
            accountNumber: '201010',
            accountName: 'موردو المنتجات البترولية',
            debit: 0,
            credit: 35000,
            lineText: 'ذمم دائنة شركة أرامكو',
          },
        ],
      });
    };

    // VIEWER possesses read-only access (FI_VIEW), but lacks posting rights (FI_POST).
    // The posting call MUST throw a permission rejection.
    await expect(executePostingCall()).rejects.toThrow(/صلاحية|permission/i);

    // Step 4: Login as ACCOUNTANT
    const accountantLoginResult = await AuthService.login('accountant', 'Admin@123');
    useAuthStore.getState().setSession(accountantLoginResult);

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.username).toBe('accountant');
    expect(useAuthStore.getState().role?.code).toBe('ACCOUNTANT');

    // Step 5: The same posting call must now succeed under the accountant's privileges
    const postedEntry = await executePostingCall();
    expect(postedEntry).toBeDefined();
    expect(postedEntry.id).toMatch(/^je-/);
    expect(postedEntry.status).toBe('posted');
    expect(postedEntry.totalDebit).toBe(35000);
    expect(postedEntry.totalCredit).toBe(35000);

    // Step 6: Verify the audit row strictly carries the accountant's userId
    const auditRecord = await db.auditLogs.where({ entityId: postedEntry.id }).first();
    expect(auditRecord).toBeDefined();
    expect(auditRecord?.userId).toBe(accountantLoginResult.user.id);
    expect(auditRecord?.userId).toBe('u-acc');
    expect(auditRecord?.action).toBe('CREATE');
    expect(auditRecord?.entity).toBe('JournalEntry');

    // Step 7: Logout
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(SessionContext.getActor()).toBeNull();

    // Step 8: The same posting call without an active session MUST throw "no active session"
    await expect(executePostingCall()).rejects.toThrow(/لا توجد جلسة|لم يتم العثور على جلسة|no active session|نشطة/i);
  });

  it('performs fresh non-demo seed with cryptographic hash, zero stored plain OTP, and forced password change', async () => {
    // Step 9 & 10: Fresh non-demo seed
    FirstBootSecret.clear();
    await DatabaseSeeder.resetAndSeed({ demoMode: false });

    // 1. Verify admin user exists in DB
    const adminUser = await db.users.where({ username: 'admin' }).first();
    expect(adminUser).toBeDefined();
    expect(adminUser?.username).toBe('admin');

    // 2. Admin hash exists as a 64-character hex PBKDF2 hash, and unique salt exists
    expect(adminUser?.passwordHash).toBeDefined();
    expect(adminUser?.passwordHash).toMatch(/^[0-9a-f]{64}$/);
    expect(adminUser?.passwordSalt).toBeDefined();
    expect(adminUser?.passwordSalt).toMatch(/^[0-9a-f]{32}$/);

    // 3. Admin must have mustChangePassword set to true
    expect(adminUser?.mustChangePassword).toBe(true);

    // 4. Verify only the admin user exists in non-demo mode (no default sample accounts)
    const totalUsers = await db.users.count();
    expect(totalUsers).toBe(1);

    // 5. Verify the plaintext OTP is NEVER written to persistent IndexedDB tables
    const allSettings = await db.settings.toArray();
    const hasOtpInSettings = allSettings.some(
      (s) =>
        s.key.toUpperCase().includes('OTP') ||
        (typeof s.value === 'string' && s.value.includes('Adm#'))
    );
    expect(hasOtpInSettings).toBe(false);

    // Ensure users table stores no cleartext password or OTP markers
    expect(adminUser?.passwordHash).not.toContain('Adm#');
    expect(adminUser?.passwordSalt).not.toContain('Adm#');

    // 6. Verify localStorage has no traces of passwords or OTPs
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const val = localStorage.getItem(key) || '';
          expect(key.toLowerCase()).not.toMatch(/password|hash|salt|otp/);
          expect(val).not.toContain('Adm#');
        }
      }
    }

    // 7. Verify the one-time admin credential exists in FirstBootSecret (session/memory mirror)
    const firstBootOtp = FirstBootSecret.get();
    expect(firstBootOtp).toBeDefined();
    expect(firstBootOtp?.length).toBe(16);
    expect(firstBootOtp).toMatch(/^[A-Za-z0-9!#@]+$/);

    // Verify admin can successfully authenticate using the generated OTP
    if (firstBootOtp) {
      const loginResult = await AuthService.login('admin', firstBootOtp);
      expect(loginResult).toBeDefined();
      expect(loginResult.user.username).toBe('admin');
      expect(loginResult.user.mustChangePassword).toBe(true);

      // Verify FirstBootSecret is wiped immediately after successful first login
      expect(FirstBootSecret.get()).toBeNull();
    }
  });
});
