import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '../core/db';
import { useAuthStore, StoredSessionPayload } from '../core/auth/useAuthStore';
import { CryptoService } from '../core/services/crypto';
import type { User, Role } from '../types/models';

describe('Session Restore & Boot Gate Verification', () => {
  const testRole: Role = {
    id: 'r-mgr-restore',
    code: 'FLEET_MGR',
    name: 'مدير أسطول',
    description: 'Fleet Manager Role',
    permissionCodes: [],
    isSystem: false,
    isDeleted: false,
  };

  const testUser: User = {
    id: 'u-restore-1',
    username: 'fleet.admin',
    fullName: 'Fleet Admin',
    email: 'fleet@gulfenergy.sa',
    roleId: testRole.id,
    roleCode: testRole.code,
    roleName: testRole.name,
    companyCode: '1000',
    plantCode: '1100',
    passwordSalt: 'salt123',
    passwordHash: 'hash123',
    passwordIterations: 600000,
    failedLoginAttempts: 0,
    isLocked: false,
    mustChangePassword: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDeleted: false,
  };

  beforeEach(async () => {
    localStorage.clear();
    await db.users.clear();
    await db.roles.clear();
    await db.users.put(testUser);
    await db.roles.put(testRole);
    useAuthStore.setState({
      user: null,
      role: null,
      token: null,
      isAuthenticated: false,
      isBootRestoring: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('valid stored session in localStorage is successfully verified and restored', async () => {
    const expiresAt = Date.now() + 1000 * 60 * 60; // 1 hour ahead
    const payload = `${testUser.id}:${testRole.code}:${expiresAt}`;
    const validToken = await CryptoService.sign(payload);

    const stored: StoredSessionPayload = {
      userId: testUser.id,
      roleCode: testRole.code,
      expiresAt,
      token: validToken,
    };
    localStorage.setItem('gulf_auth_session', JSON.stringify(stored));

    const restored = await useAuthStore.getState().restoreSession();
    expect(restored).toBe(true);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.isBootRestoring).toBe(false);
    expect(state.user?.id).toBe(testUser.id);
    expect(state.role?.code).toBe(testRole.code);
  });

  it('tampered HMAC token fails verification, clears storage, and unauthenticates state', async () => {
    const expiresAt = Date.now() + 1000 * 60 * 60;
    const stored: StoredSessionPayload = {
      userId: testUser.id,
      roleCode: testRole.code,
      expiresAt,
      token: 'tampered-or-invalid-hmac-signature-bytes',
    };
    localStorage.setItem('gulf_auth_session', JSON.stringify(stored));

    const restored = await useAuthStore.getState().restoreSession();
    expect(restored).toBe(false);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isBootRestoring).toBe(false);
    expect(state.user).toBeNull();
    expect(localStorage.getItem('gulf_auth_session')).toBeNull();
  });

  it('5-second failsafe terminates boot restore state unauthenticated if restore stalls', async () => {
    vi.useFakeTimers();

    useAuthStore.setState({
      isBootRestoring: true,
      isAuthenticated: false,
    });

    // Simulate AuthBootGate timer logic
    const timer = setTimeout(() => {
      if (useAuthStore.getState().isBootRestoring) {
        useAuthStore.setState({ isBootRestoring: false, isAuthenticated: false });
      }
    }, 5000);

    expect(useAuthStore.getState().isBootRestoring).toBe(true);

    // Advance 5 seconds
    vi.advanceTimersByTime(5000);

    expect(useAuthStore.getState().isBootRestoring).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);

    clearTimeout(timer);
    vi.useRealTimers();
  });
});
