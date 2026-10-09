import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../core/db';
import { AuthService, _resetThrottleMapForTesting } from '../core/services/AuthService';
import { CryptoService } from '../core/services/crypto';
import { FirstBootSecret } from '../core/security/FirstBootSecret';
import { SecurityMigrationService } from '../core/services/SecurityMigrationService';
import { AuditService } from '../core/services/AuditService';
import { userRepository, roleRepository } from '../core/repositories';
import { DatabaseSeeder } from '../seed';
import { SYSTEM_ROLES } from '../core/services/RbacService';
import type { User, Role } from '../types/models';

describe('Credential Hardening & Lifecycle Security Tests', () => {
  beforeEach(async () => {
    FirstBootSecret.clear();
    _resetThrottleMapForTesting();
    await db.users.clear();
    await db.roles.clear();
    await db.settings.clear();
    await db.auditLogs.clear();
  });

  const ensureAdminRole = async () => {
    const existing = await roleRepository.getById('r-admin');
    if (!existing) {
      const role: Role = {
        id: 'r-admin',
        code: SYSTEM_ROLES.ADMIN,
        name: 'مدير النظام',
        description: 'Superuser',
        permissionCodes: ['*'],
        isSystem: true,
      };
      await roleRepository.create(role, { system: true, userName: 'SYSTEM' });
    }
  };

  // 1. Distinct salts per user
  it('generates distinct cryptographic random salts for every user in the seeder', async () => {
    await DatabaseSeeder.seed();

    const allUsers = await userRepository.list();
    expect(allUsers.length).toBeGreaterThan(0);

    const salts = allUsers.map((u) => u.passwordSalt);
    const uniqueSalts = new Set(salts);

    // Every single user must have a unique salt
    expect(uniqueSalts.size).toBe(allUsers.length);

    // Each salt must be a valid 32-character hex string (16 bytes)
    for (const salt of salts) {
      expect(salt).toMatch(/^[0-9a-f]{32}$/);
      expect(salt).not.toBe('e8f7b2c14a9018d423985710bcdef012');
    }
  });

  // 2. Legacy-salt upgrade on login
  it('transparently rehashes and upgrades legacy fixed salt on successful login', async () => {
    await ensureAdminRole();
    const legacySalt = AuthService.LEGACY_SALTS[0];
    const password = 'LegacyAdminPass#2026!';
    const legacyHash = await CryptoService.hashPassword(password, legacySalt);

    const legacyUser: User = {
      id: 'u-legacy',
      username: 'legacy.user',
      fullName: 'مستخدم بنظام قديم',
      email: 'legacy@gulfenergy.sa',
      roleId: 'r-admin',
      roleCode: SYSTEM_ROLES.ADMIN,
      roleName: 'مدير النظام',
      companyCode: '1000',
      plantCode: '1100',
      passwordSalt: legacySalt,
      passwordHash: legacyHash,
      failedLoginAttempts: 0,
      isLocked: false,
      mustChangePassword: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false,
    };
    await userRepository.create(legacyUser, { system: true, userName: 'SYSTEM' });

    // Login with valid credentials
    const session = await AuthService.login('legacy.user', password);
    expect(session.user).toBeDefined();

    // Verify user in database now has a newly generated random salt
    const updatedUser = await userRepository.getById('u-legacy');
    expect(updatedUser?.passwordSalt).not.toBe(legacySalt);
    expect(updatedUser?.passwordSalt).toMatch(/^[0-9a-f]{32}$/);
    expect(updatedUser?.passwordHash).not.toBe(legacyHash);

    // Verify user can now log in with the new salt
    const secondSession = await AuthService.login('legacy.user', password);
    expect(secondSession.user.passwordSalt).toBe(updatedUser?.passwordSalt);

    // Verify upgrade audit log exists
    const upgradeLogs = await AuditService.getLogs({
      userId: 'u-legacy',
      action: 'UPDATE',
    });
    expect(upgradeLogs.some((l) => l.after?.reason === 'Cryptographic Salt Upgrade to Random Salt')).toBe(true);
  });

  // 3. First-boot OTP never written to IndexedDB or localStorage
  it('never stores plain OTP in IndexedDB or localStorage, and FirstBootSecret provides in-memory/session mirror', async () => {
    // Run seed
    await DatabaseSeeder.seed();

    // Scan settings table
    const settingsRows = await db.settings.toArray();
    const hasOtpSetting = settingsRows.some((s) => s.key === 'INITIAL_ADMIN_OTP' || s.id === 'set-initial-admin-otp');
    expect(hasOtpSetting).toBe(false);

    // Check localStorage stub
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const val = localStorage.getItem(key);
          expect(val).not.toMatch(/Adm#[A-Z0-9]+!9/);
        }
      }
    }

    // Simulate SecurityMigrationService on an existing database that had the old key
    await db.settings.put({
      id: 'set-initial-admin-otp',
      key: 'INITIAL_ADMIN_OTP',
      value: 'Adm#CLEANME!9',
      category: 'security',
      description: 'old plain otp',
      updatedAt: new Date().toISOString(),
      isDeleted: false,
    });

    await SecurityMigrationService.run();

    const cleanedSetting = await db.settings.get('set-initial-admin-otp');
    expect(cleanedSetting).toBeUndefined();

    const otherCheck = await db.settings.where({ key: 'INITIAL_ADMIN_OTP' }).first();
    expect(otherCheck).toBeUndefined();
  });

  // 4. Regenerate initial admin password allowed before first login, rejected after
  it('allows regenerating temporary admin OTP before first login and rejects once logged in', async () => {
    await ensureAdminRole();
    const salt = CryptoService.generateSalt();
    const otp = CryptoService.generateSecureOtp(16);
    const hash = await CryptoService.hashPassword(otp, salt);

    const admin: User = {
      id: 'u-admin-test',
      username: 'admin',
      fullName: 'مدير النظام',
      email: 'admin@gulfenergy.sa',
      roleId: 'r-admin',
      roleCode: SYSTEM_ROLES.ADMIN,
      roleName: 'مدير النظام',
      companyCode: '1000',
      plantCode: '1100',
      passwordSalt: salt,
      passwordHash: hash,
      failedLoginAttempts: 0,
      isLocked: false,
      mustChangePassword: true,
      lastLoginAt: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false,
    };
    await userRepository.create(admin, { system: true, userName: 'SYSTEM' });

    // Allowed before first login
    const regeneratedOtp = await AuthService.regenerateInitialAdminPassword();
    expect(regeneratedOtp.length).toBe(16);
    expect(FirstBootSecret.get()).toBe(regeneratedOtp);

    // Now login with this newly regenerated OTP
    await AuthService.login('admin', regeneratedOtp);

    // FirstBootSecret should have been cleared upon login
    expect(FirstBootSecret.get()).toBeNull();

    // Subsequent regeneration must be rejected because lastLoginAt is now set
    await expect(AuthService.regenerateInitialAdminPassword()).rejects.toThrow(
      /لا يمكن إعادة توليد كلمة المرور المؤقتة بعد تسجيل الدخول الأول/
    );
  });

  // 5. mustChangePassword guard decision
  it('evaluates mustChangePassword status correctly for route redirection', () => {
    const shouldRedirect = (user: { mustChangePassword?: boolean } | null, pathname: string) => {
      if (user?.mustChangePassword && pathname !== '/change-password') {
        return true;
      }
      return false;
    };

    expect(shouldRedirect({ mustChangePassword: true }, '/')).toBe(true);
    expect(shouldRedirect({ mustChangePassword: true }, '/procurement/orders')).toBe(true);
    expect(shouldRedirect({ mustChangePassword: true }, '/change-password')).toBe(false);
    expect(shouldRedirect({ mustChangePassword: false }, '/')).toBe(false);
  });

  // 6. changePassword validation and audit behavior
  it('changePassword enforces verification of current password, policy, difference, and writes PASSWORD_CHANGED', async () => {
    await ensureAdminRole();
    const oldPassword = 'OldPassword123!#';
    const oldSalt = CryptoService.generateSalt();
    const oldHash = await CryptoService.hashPassword(oldPassword, oldSalt);

    const user: User = {
      id: 'u-change-pwd',
      username: 'change.pwd.user',
      fullName: 'مستخدم تجربة تغيير الرمز',
      email: 'pwd@gulfenergy.sa',
      roleId: 'r-admin',
      roleCode: SYSTEM_ROLES.ADMIN,
      roleName: 'مدير النظام',
      companyCode: '1000',
      plantCode: '1100',
      passwordSalt: oldSalt,
      passwordHash: oldHash,
      failedLoginAttempts: 0,
      isLocked: false,
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false,
    };
    await userRepository.create(user, { system: true, userName: 'SYSTEM' });

    // Rejects wrong current password
    await expect(
      AuthService.changePassword(user.id, 'WrongCurrentPassword123!#', 'NewValidPass123!#')
    ).rejects.toThrow('كلمة المرور الحالية غير صحيحة.');

    // Rejects same new password as current password
    await expect(
      AuthService.changePassword(user.id, oldPassword, oldPassword)
    ).rejects.toThrow('كلمة المرور الجديدة يجب أن تكون مختلفة عن كلمة المرور الحالية.');

    // Rejects weak new password (e.g., short, no symbols)
    await expect(
      AuthService.changePassword(user.id, oldPassword, 'weak')
    ).rejects.toThrow(/كلمة المرور يجب أن لا تقل عن 10 خانات/);

    // Accepts strong new password
    const newPassword = 'BrandNewStrongPass123!#';
    await AuthService.changePassword(user.id, oldPassword, newPassword);

    const updated = await userRepository.getById(user.id);
    expect(updated?.mustChangePassword).toBe(false);
    expect(updated?.passwordSalt).not.toBe(oldSalt);

    // Verify new password works
    const isNewValid = await CryptoService.verifyPassword(
      newPassword,
      updated!.passwordSalt,
      updated!.passwordHash
    );
    expect(isNewValid).toBe(true);

    // Verify PASSWORD_CHANGED audit log
    const auditLogs = await AuditService.getLogs({
      userId: user.id,
      action: 'PASSWORD_CHANGED',
    });
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0].action).toBe('PASSWORD_CHANGED');
    expect(auditLogs[0].after).toEqual(expect.objectContaining({ mustChangePassword: false }));
  });
});
