import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../core/db';
import { AuthService } from '../core/services/AuthService';
import { AuditService } from '../core/services/AuditService';
import { userRepository, roleRepository } from '../core/repositories';
import { CryptoService } from '../core/services/crypto';
import { SessionContext } from '../core/security/SessionContext';
import { SYSTEM_ROLES } from '../core/services/RbacService';
import { NotificationService } from '../core/services/NotificationService';
import { DatabaseSeeder } from '../seed';
import type { User, Role } from '../types/models';

describe('Authentication & Actor-Safe Audit Integration Tests', () => {
  const testPassword = 'Password123!#';
  let adminUser: User;
  let adminRole: Role;

  beforeEach(async () => {
    SessionContext.clearActor();
    await db.users.clear();
    await db.roles.clear();
    await db.auditLogs.clear();
    await db.notifications.clear();
    await db.contracts.clear();
    await db.inventoryAlerts.clear();
    await db.vendorInvoices.clear();
    await db.vehicles.clear();
    await db.approvalRequests.clear();

    const salt = CryptoService.generateSalt();
    const hash = await CryptoService.hashPassword(testPassword, salt);

    adminRole = {
      id: 'r-admin',
      code: SYSTEM_ROLES.ADMIN,
      name: 'مدير النظام',
      description: 'Superuser',
      permissionCodes: ['*'],
      isSystem: true,
    };
    await roleRepository.create(adminRole, { system: true, userName: 'SYSTEM' });

    adminUser = {
      id: 'u-test-admin',
      username: 'test.admin',
      fullName: 'أحمد الإداري',
      email: 'test.admin@gulfenergy.sa',
      roleId: adminRole.id,
      roleCode: adminRole.code,
      roleName: adminRole.name,
      companyCode: '1000',
      plantCode: '1100',
      passwordSalt: salt,
      passwordHash: hash,
      failedLoginAttempts: 0,
      isLocked: false,
      mustChangePassword: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false,
    };
    await userRepository.create(adminUser, { system: true, userName: 'SYSTEM' });

    // Clear the audit logs created by setup seeding
    await db.auditLogs.clear();
  });

  // 1. Login success creates a LOGIN audit row whose userId equals the logging-in user and updates lastLoginAt
  it('login success creates a LOGIN audit row whose userId equals the logging-in user and updates lastLoginAt', async () => {
    const session = await AuthService.login('test.admin', testPassword);
    expect(session.user).toBeDefined();
    expect(session.token).toBeTruthy();

    const updatedUser = await userRepository.getById(adminUser.id);
    expect(updatedUser?.lastLoginAt).toBeTruthy();
    expect(updatedUser?.failedLoginAttempts).toBe(0);

    const logs = await AuditService.getLogs({ userId: adminUser.id, action: 'LOGIN' });
    expect(logs.length).toBe(1);
    expect(logs[0].action).toBe('LOGIN');
    expect(logs[0].userId).toBe(adminUser.id);
    expect(logs[0].userName).toBe(adminUser.username);
    expect(logs[0].entity).toBe('users');
  });

  // 2. Wrong password increments failedLoginAttempts and writes LOGIN_FAILED
  it('wrong password increments failedLoginAttempts and writes LOGIN_FAILED', async () => {
    await expect(AuthService.login('test.admin', 'WrongPass123!#')).rejects.toThrow(
      /كلمة المرور غير صحيحة/
    );

    const updatedUser = await userRepository.getById(adminUser.id);
    expect(updatedUser?.failedLoginAttempts).toBe(1);
    expect(updatedUser?.isLocked).toBe(false);

    const logs = await AuditService.getLogs({ userId: adminUser.id, action: 'LOGIN_FAILED' });
    expect(logs.length).toBe(1);
    expect(logs[0].action).toBe('LOGIN_FAILED');
    expect(logs[0].userId).toBe(adminUser.id);
    expect(logs[0].after).toEqual(expect.objectContaining({ attempt: 1, isNowLocked: false }));
  });

  // 3. 5 wrong passwords lock the account and write ACCOUNT_LOCKED; login during lock fails with Arabic message
  it('5 wrong passwords lock the account and write ACCOUNT_LOCKED; login during lock fails with the Arabic message', async () => {
    for (let i = 1; i <= 4; i++) {
      await expect(AuthService.login('test.admin', 'WrongPass123!#')).rejects.toThrow();
    }

    // 5th attempt triggers lockout
    await expect(AuthService.login('test.admin', 'WrongPass123!#')).rejects.toThrow(
      /تم قفل الحساب لمدة 15 دقيقة/
    );

    const updatedUser = await userRepository.getById(adminUser.id);
    expect(updatedUser?.failedLoginAttempts).toBe(5);
    expect(updatedUser?.isLocked).toBe(true);
    expect(updatedUser?.lockedUntil).toBeTruthy();

    const lockedLogs = await AuditService.getLogs({ userId: adminUser.id, action: 'ACCOUNT_LOCKED' });
    expect(lockedLogs.length).toBe(1);
    expect(lockedLogs[0].action).toBe('ACCOUNT_LOCKED');
    expect(lockedLogs[0].userId).toBe(adminUser.id);

    // Attempting login during active lock rejects with Arabic locked message
    await expect(AuthService.login('test.admin', testPassword)).rejects.toThrow(
      /الحساب مقفل مؤقتاً لتجاوز المحاولات الخاطئة/
    );
  });

  // 4. Expired lock auto-resets and writes ACCOUNT_UNLOCKED
  it('expired lock auto-resets and writes ACCOUNT_UNLOCKED', async () => {
    // Set user as locked in the past
    const pastTime = new Date(Date.now() - 60000).toISOString();
    await userRepository.update(
      adminUser.id,
      {
        isLocked: true,
        lockedUntil: pastTime,
        failedLoginAttempts: 5,
      },
      { userId: adminUser.id, userName: adminUser.username }
    );
    await db.auditLogs.clear();

    const session = await AuthService.login('test.admin', testPassword);
    expect(session.user).toBeDefined();

    const unlockedLogs = await AuditService.getLogs({ userId: adminUser.id, action: 'ACCOUNT_UNLOCKED' });
    expect(unlockedLogs.length).toBe(1);
    expect(unlockedLogs[0].action).toBe('ACCOUNT_UNLOCKED');

    const loginLogs = await AuditService.getLogs({ userId: adminUser.id, action: 'LOGIN' });
    expect(loginLogs.length).toBe(1);

    const freshUser = await userRepository.getById(adminUser.id);
    expect(freshUser?.isLocked).toBe(false);
    expect(freshUser?.failedLoginAttempts).toBe(0);
  });

  // 5. Unknown username returns the generic error and writes nothing
  it('unknown username returns the generic error and writes nothing', async () => {
    const logsBefore = await db.auditLogs.count();

    await expect(AuthService.login('non.existent.user', 'AnyPassword123!#')).rejects.toThrow(
      'اسم المستخدم أو كلمة المرور غير صحيحة.'
    );

    const logsAfter = await db.auditLogs.count();
    expect(logsAfter).toBe(logsBefore);
  });

  // 6. AuditService.log with no actor, no userId and no system flag still throws
  it('AuditService.log with no actor, no userId and no system flag still throws', async () => {
    SessionContext.clearActor();

    await expect(
      AuditService.log({
        action: 'UPDATE',
        entity: 'security_test',
        entityId: 'sec-1',
        system: false,
      })
    ).rejects.toThrow(
      /Audit security violation: Cannot write audit log without an active authenticated actor or explicit system flag/
    );

    await expect(
      AuditService.log('UPDATE', 'security_test', 'sec-1', null, null)
    ).rejects.toThrow(
      /Audit security violation: Cannot write audit log without an active authenticated actor or explicit system flag/
    );
  });

  // 7. A boot-time system job (e.g. NotificationService generator, seeder) succeeds with no actor because it passes the system flag
  it('a boot-time system job (e.g. NotificationService generator, seeder) succeeds with no actor because it passes the system flag', async () => {
    SessionContext.clearActor();

    // Direct system audit write
    await expect(
      AuditService.log({
        action: 'CREATE',
        entity: 'SystemJob',
        entityId: 'job-1',
        system: true,
        userName: 'SystemMaintenanceJob',
      })
    ).resolves.not.toThrow();

    const logs = await AuditService.getLogs({ action: 'CREATE', entity: 'SystemJob' });
    expect(logs.length).toBe(1);
    expect(logs[0].userId).toBe('SYSTEM');
    expect(logs[0].userName).toBe('SystemMaintenanceJob');

    // Run NotificationService background generator with no active actor
    const count = await NotificationService.generateSystemNotifications();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  // 8. A transaction failure in login leaves the user row unchanged
  it('a transaction failure in login leaves the user row unchanged', async () => {
    const originalUser = await userRepository.getById(adminUser.id);
    expect(originalUser?.failedLoginAttempts).toBe(0);

    // Mock db.auditLogs.add to throw during transaction
    const originalAdd = db.auditLogs.add;
    db.auditLogs.add = (async () => {
      throw new Error('Simulated database disk failure on auditLogs table');
    }) as unknown as typeof db.auditLogs.add;

    try {
      await expect(AuthService.login('test.admin', testPassword)).rejects.toThrow(
        /حدث خطأ في النظام أثناء توثيق الدخول/
      );

      // Verify that due to transaction rollback, lastLoginAt is not committed
      const userAfter = await userRepository.getById(adminUser.id);
      expect(userAfter?.lastLoginAt).toBe(originalUser?.lastLoginAt);
    } finally {
      db.auditLogs.add = originalAdd;
    }
  });
});
