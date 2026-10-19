import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../core/db';
import { AuthService, GENERIC_CREDENTIAL_ERROR } from '../core/services/AuthService';
import { CryptoService } from '../core/services/crypto';
import type { User, Role } from '../types/models';

describe('PBKDF2 600,000 Iterations & Transparent Upgrade', () => {
  const role: Role = {
    id: 'r-test-accountant',
    code: 'ACCOUNTANT',
    name: 'محاسب مالي',
    description: 'Accountant Role',
    permissionCodes: [],
    isSystem: false,
    isDeleted: false,
  };

  beforeEach(async () => {
    await db.users.clear();
    await db.roles.clear();
    await db.auditLogs.clear();
    await db.roles.put(role);
  });

  it('legacy user with 100,000 iterations logs in and is upgraded to 600,000 iterations in same transaction and audited', async () => {
    const salt = CryptoService.generateSalt();
    const password = 'StrongPassword!2026';
    // Legacy hash computed with 100,000 iterations
    const legacyHash = await CryptoService.hashPassword(password, salt, 100000);

    const legacyUser: User = {
      id: 'u-legacy-1',
      username: 'legacy.user',
      fullName: 'Legacy User',
      email: 'legacy@gulfenergy.sa',
      roleId: role.id,
      roleCode: role.code,
      roleName: role.name,
      companyCode: '1000',
      plantCode: '1100',
      passwordSalt: salt,
      passwordHash: legacyHash,
      passwordIterations: 100000,
      failedLoginAttempts: 0,
      isLocked: false,
      mustChangePassword: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false,
    };
    await db.users.put(legacyUser);

    // Login with valid credentials
    const session = await AuthService.login('legacy.user', password);
    expect(session).toBeDefined();
    expect(session.user.id).toBe('u-legacy-1');

    // Verify user in DB is now upgraded to 600,000 iterations
    const upgradedUser = await db.users.get('u-legacy-1');
    expect(upgradedUser).toBeDefined();
    expect(upgradedUser?.passwordIterations).toBe(600000);
    // Salt should also have been refreshed
    expect(upgradedUser?.passwordSalt).not.toBe(salt);

    // Verify the new hash verifies with 600,000 iterations
    const verifiesWithNewIterations = await CryptoService.verifyPassword(
      password,
      upgradedUser!.passwordSalt,
      upgradedUser!.passwordHash,
      600000
    );
    expect(verifiesWithNewIterations).toBe(true);

    // Verify audit logs record iteration upgrade
    const auditEntries = await db.auditLogs.where('entityId').equals('u-legacy-1').toArray();
    const upgradeLog = auditEntries.find((a) => a.action === 'UPDATE');
    expect(upgradeLog).toBeDefined();
    expect(upgradeLog?.after?.reason).toBe('Cryptographic PBKDF2 Iteration Upgrade to 600,000');
  });

  it('wrong password for a legacy user is rejected without updating or leaking credentials', async () => {
    const salt = CryptoService.generateSalt();
    const realPassword = 'RealPassword!2026';
    const legacyHash = await CryptoService.hashPassword(realPassword, salt, 100000);

    const legacyUser: User = {
      id: 'u-legacy-2',
      username: 'legacy.fail',
      fullName: 'Legacy Fail User',
      email: 'fail@gulfenergy.sa',
      roleId: role.id,
      roleCode: role.code,
      roleName: role.name,
      companyCode: '1000',
      plantCode: '1100',
      passwordSalt: salt,
      passwordHash: legacyHash,
      passwordIterations: 100000,
      failedLoginAttempts: 0,
      isLocked: false,
      mustChangePassword: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false,
    };
    await db.users.put(legacyUser);

    // Login with wrong password
    await expect(AuthService.login('legacy.fail', 'WrongPassword!999')).rejects.toThrow();

    // User in DB should still have 100,000 iterations and unmutated salt/hash
    const unchangedUser = await db.users.get('u-legacy-2');
    expect(unchangedUser?.passwordIterations).toBe(100000);
    expect(unchangedUser?.passwordSalt).toBe(salt);
    expect(unchangedUser?.passwordHash).toBe(legacyHash);
    expect(unchangedUser?.failedLoginAttempts).toBe(1);
  });

  it('new users created or changed get 600,000 iterations', async () => {
    const initialSalt = CryptoService.generateSalt();
    const initialPassword = 'InitialPass!2026';
    const initialHash = await CryptoService.hashPassword(initialPassword, initialSalt, 100000);

    const testUser: User = {
      id: 'u-new-pass',
      username: 'new.pass',
      fullName: 'New Pass User',
      email: 'new@gulfenergy.sa',
      roleId: role.id,
      roleCode: role.code,
      roleName: role.name,
      companyCode: '1000',
      plantCode: '1100',
      passwordSalt: initialSalt,
      passwordHash: initialHash,
      passwordIterations: 100000,
      failedLoginAttempts: 0,
      isLocked: false,
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false,
    };
    await db.users.put(testUser);

    // Change password
    const newPassword = 'BrandNewPassword#987';
    await AuthService.changePassword('u-new-pass', initialPassword, newPassword);

    const updatedUser = await db.users.get('u-new-pass');
    expect(updatedUser?.passwordIterations).toBe(600000);

    const verifiesAt600k = await CryptoService.verifyPassword(
      newPassword,
      updatedUser!.passwordSalt,
      updatedUser!.passwordHash,
      600000
    );
    expect(verifiesAt600k).toBe(true);
  });

  it('100000-hash user without field logs in and is upgraded', async () => {
    const salt = CryptoService.generateSalt();
    const password = 'LegacyNoField100k!';
    const hash = await CryptoService.hashPassword(password, salt, 100000);

    const legacyUser: User = {
      id: 'u-nofield-100k',
      username: 'nofield.100k',
      fullName: 'No Field 100k User',
      email: 'nofield100k@gulfenergy.sa',
      roleId: role.id,
      roleCode: role.code,
      roleName: role.name,
      companyCode: '1000',
      plantCode: '1100',
      passwordSalt: salt,
      passwordHash: hash,
      // passwordIterations explicitly undefined
      passwordIterations: undefined as unknown as number,
      failedLoginAttempts: 0,
      isLocked: false,
      mustChangePassword: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false,
    };
    await db.users.put(legacyUser);

    const session = await AuthService.login('nofield.100k', password);
    expect(session).toBeDefined();

    const inDb = await db.users.get('u-nofield-100k');
    expect(inDb?.passwordIterations).toBe(600000);
    expect(inDb?.passwordSalt).not.toBe(salt);
    const validAt600k = await CryptoService.verifyPassword(
      password,
      inDb!.passwordSalt,
      inDb!.passwordHash,
      600000
    );
    expect(validAt600k).toBe(true);

    const audit = await db.auditLogs.where('entityId').equals('u-nofield-100k').toArray();
    expect(audit.some((a) => a.after?.reason?.includes('Resolved missing passwordIterations'))).toBe(true);
  });

  it('600000-hash user without field logs in and gets the field', async () => {
    const salt = CryptoService.generateSalt();
    const password = 'LegacyNoField600k!';
    const hash = await CryptoService.hashPassword(password, salt, 600000);

    const legacyUser: User = {
      id: 'u-nofield-600k',
      username: 'nofield.600k',
      fullName: 'No Field 600k User',
      email: 'nofield600k@gulfenergy.sa',
      roleId: role.id,
      roleCode: role.code,
      roleName: role.name,
      companyCode: '1000',
      plantCode: '1100',
      passwordSalt: salt,
      passwordHash: hash,
      // passwordIterations explicitly undefined
      passwordIterations: undefined as unknown as number,
      failedLoginAttempts: 0,
      isLocked: false,
      mustChangePassword: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false,
    };
    await db.users.put(legacyUser);

    const session = await AuthService.login('nofield.600k', password);
    expect(session).toBeDefined();

    const inDb = await db.users.get('u-nofield-600k');
    expect(inDb?.passwordIterations).toBe(600000);
    const validAt600k = await CryptoService.verifyPassword(
      password,
      inDb!.passwordSalt,
      inDb!.passwordHash,
      600000
    );
    expect(validAt600k).toBe(true);
  });

  it('wrong password fails for account without field after both tries', async () => {
    const salt = CryptoService.generateSalt();
    const password = 'RealPassword600k!';
    const hash = await CryptoService.hashPassword(password, salt, 600000);

    const legacyUser: User = {
      id: 'u-nofield-fail',
      username: 'nofield.fail',
      fullName: 'No Field Fail User',
      email: 'failnofield@gulfenergy.sa',
      roleId: role.id,
      roleCode: role.code,
      roleName: role.name,
      companyCode: '1000',
      plantCode: '1100',
      passwordSalt: salt,
      passwordHash: hash,
      passwordIterations: undefined as unknown as number,
      failedLoginAttempts: 0,
      isLocked: false,
      mustChangePassword: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false,
    };
    await db.users.put(legacyUser);

    const spy = vi.spyOn(CryptoService, 'verifyPassword');
    await expect(AuthService.login('nofield.fail', 'WrongPassword123!')).rejects.toThrow(
      GENERIC_CREDENTIAL_ERROR
    );

    // Both 100k and 600k were tried
    const calls = spy.mock.calls.filter((c) => c[1] === salt);
    expect(calls.length).toBe(2);
    expect(calls[0][3]).toBe(100000);
    expect(calls[1][3]).toBe(600000);
    spy.mockRestore();
  });

  it('user with the field triggers exactly one verification (spy on CryptoService.verifyPassword)', async () => {
    const salt = CryptoService.generateSalt();
    const password = 'UserWithField600k!';
    const hash = await CryptoService.hashPassword(password, salt, 600000);

    const normalUser: User = {
      id: 'u-with-field',
      username: 'with.field',
      fullName: 'With Field User',
      email: 'withfield@gulfenergy.sa',
      roleId: role.id,
      roleCode: role.code,
      roleName: role.name,
      companyCode: '1000',
      plantCode: '1100',
      passwordSalt: salt,
      passwordHash: hash,
      passwordIterations: 600000,
      failedLoginAttempts: 0,
      isLocked: false,
      mustChangePassword: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false,
    };
    await db.users.put(normalUser);

    const spy = vi.spyOn(CryptoService, 'verifyPassword');
    await AuthService.login('with.field', password);

    const userCalls = spy.mock.calls.filter((c) => c[1] === salt);
    expect(userCalls.length).toBe(1);
    expect(userCalls[0][3]).toBe(600000);
    spy.mockRestore();
  });

  it('unknown username still triggers the dummy verification', async () => {
    const spy = vi.spyOn(CryptoService, 'verifyPassword');
    await expect(AuthService.login('nonexistent.user.xyz', 'AnyPassword123!')).rejects.toThrow(
      GENERIC_CREDENTIAL_ERROR
    );

    // Dummy verification called with dummy salt and current iterations
    const dummyCalls = spy.mock.calls.filter(
      (c) => c[1] === '00000000000000000000000000000000' && c[3] === 600000
    );
    expect(dummyCalls.length).toBe(1);
    spy.mockRestore();
  });
});
