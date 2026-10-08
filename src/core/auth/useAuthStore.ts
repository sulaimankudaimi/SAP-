import { create } from 'zustand';
import type { User, Role, AuthObject } from '../../types/models';
import type { AuthSession } from '../services/AuthService';
import { RbacService } from '../services/RbacService';
import { CryptoService } from '../services/crypto';
import { userRepository, roleRepository } from '../repositories';
import { SessionContext } from '../security/SessionContext';
import { AuditService } from '../services/AuditService';

const SESSION_STORAGE_KEY = 'gulf_auth_session';

export interface StoredSessionPayload {
  userId: string;
  roleCode: string;
  expiresAt: number;
  token: string;
}

interface AuthState {
  user: User | null;
  role: Role | null;
  token: string | null;
  expiresAt: number | null;
  isAuthenticated: boolean;
  isAutoLocked: boolean;
  isBootRestoring: boolean;
  lastActivity: number;

  restoreSession: () => Promise<boolean>;
  setSession: (session: AuthSession) => void;
  logout: () => void;
  recordActivity: () => void;
  setLocked: (locked: boolean) => void;
  unlock: (password: string) => Promise<boolean>;
  can: (
    required: AuthObject,
    plant?: string,
    costCenter?: string,
    amount?: number
  ) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  role: null,
  token: null,
  expiresAt: null,
  isAuthenticated: false,
  isAutoLocked: false,
  isBootRestoring: true,
  lastActivity: Date.now(),

  restoreSession: async (): Promise<boolean> => {
    try {
      if (typeof window === 'undefined') {
        set({ isAuthenticated: false, isBootRestoring: false });
        SessionContext.clearActor();
        return false;
      }

      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) {
        set({ isAuthenticated: false, isBootRestoring: false });
        SessionContext.clearActor();
        return false;
      }

      const parsed: StoredSessionPayload = JSON.parse(raw);
      const { userId, roleCode, expiresAt, token } = parsed;

      // 1. Verify existence of required session fields and expiry
      if (!userId || !roleCode || !expiresAt || !token || expiresAt <= Date.now()) {
        throw new Error('الجلسة منتهية الصلاحية أو غير مكتملة.');
      }

      // 2. Cryptographic Token Verification (HMAC-SHA256 signature over userId:roleCode:expiresAt)
      const expectedPayload = `${userId}:${roleCode}:${expiresAt}`;
      const isTokenValid = await CryptoService.verify(expectedPayload, token);
      if (!isTokenValid) {
        throw new Error('تم اكتشاف تلاعب أو عدم تطابق في توقيع رمز الجلسة الأمني (HMAC).');
      }

      // 3. Reload fresh User & Role directly from DB to confirm not locked/deleted
      const user = await userRepository.getById(userId);
      if (!user || user.isDeleted || user.isLocked) {
        throw new Error('حساب المستخدم مقفل أو غير موجود بقاعدة البيانات.');
      }

      const role = await roleRepository.getById(user.roleId);
      if (!role || role.code !== roleCode || role.isDeleted) {
        throw new Error('الدور الوظيفي للمستخدم غير صالح أو تم حذفه.');
      }

      // 4. Session valid: update store & session context actor
      set({
        user,
        role,
        token,
        expiresAt,
        isAuthenticated: true,
        isAutoLocked: false,
        isBootRestoring: false,
        lastActivity: Date.now(),
      });

      SessionContext.setActor({
        userId: user.id,
        username: user.username,
        role,
      });

      return true;
    } catch (err) {
      console.warn('Boot session verification failed, redirecting to login:', err);
      try {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      } catch {
        // Ignore
      }
      set({
        user: null,
        role: null,
        token: null,
        expiresAt: null,
        isAuthenticated: false,
        isAutoLocked: false,
        isBootRestoring: false,
      });
      SessionContext.clearActor();
      return false;
    }
  },

  setSession: (session: AuthSession) => {
    try {
      // Security: Persist ONLY { userId, roleCode, expiresAt, token }. Never user object, salt, or hash!
      const payload: StoredSessionPayload = {
        userId: session.user.id,
        roleCode: session.role.code,
        expiresAt: session.expiresAt,
        token: session.token,
      };
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage errors
    }

    // Set actor context for audit and service-level permission enforcement
    SessionContext.setActor({
      userId: session.user.id,
      username: session.user.username,
      role: session.role,
    });

    set({
      user: session.user,
      role: session.role,
      token: session.token,
      expiresAt: session.expiresAt,
      isAuthenticated: true,
      isAutoLocked: false,
      isBootRestoring: false,
      lastActivity: Date.now(),
    });
  },

  logout: () => {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Ignore
    }

    SessionContext.clearActor();

    set({
      user: null,
      role: null,
      token: null,
      expiresAt: null,
      isAuthenticated: false,
      isAutoLocked: false,
      isBootRestoring: false,
    });
  },

  recordActivity: () => {
    set({ lastActivity: Date.now() });
  },

  setLocked: (locked: boolean) => {
    set({ isAutoLocked: locked });
  },

  unlock: async (password: string): Promise<boolean> => {
    const currentUser = get().user;
    if (!currentUser) return false;

    // Reload fresh user from DB
    const dbUser = await userRepository.getById(currentUser.id);
    if (!dbUser || dbUser.isLocked || dbUser.isDeleted) {
      get().logout();
      return false;
    }

    const authContext = { userId: dbUser.id, userName: dbUser.username };

    // Verify password against stored salt and hash
    const isValid = await CryptoService.verifyPassword(
      password,
      dbUser.passwordSalt,
      dbUser.passwordHash
    );

    if (!isValid) {
      const attempts = (dbUser.failedLoginAttempts || 0) + 1;
      const isNowLocked = attempts >= 5;
      const lockedUntil = isNowLocked
        ? new Date(Date.now() + 15 * 60000).toISOString()
        : undefined;

      await userRepository.update(
        dbUser.id,
        {
          failedLoginAttempts: attempts,
          isLocked: isNowLocked,
          lockedUntil,
        },
        authContext
      );

      if (isNowLocked) {
        await AuditService.log({
          action: 'ACCOUNT_LOCKED',
          entity: 'users',
          entityId: dbUser.id,
          userId: dbUser.id,
          userName: dbUser.username,
          after: { lockedUntil, reason: 'Max failed unlock attempts reached' },
        });
        get().logout();
      }
      return false;
    }

    // Reset failed attempts on success
    await userRepository.update(
      dbUser.id,
      {
        failedLoginAttempts: 0,
        isLocked: false,
      },
      authContext
    );

    const role = get().role || (await roleRepository.getById(dbUser.roleId));
    if (role) {
      SessionContext.setActor({
        userId: dbUser.id,
        username: dbUser.username,
        role,
      });
    }

    set({ isAutoLocked: false, lastActivity: Date.now() });
    return true;
  },

  can: (
    required: AuthObject,
    plant?: string,
    costCenter?: string,
    amount?: number
  ): boolean => {
    const role = get().role;
    return RbacService.hasPermission(role, required, plant, costCenter, amount);
  },
}));

// Automatically attempt session restoration upon module load in browser
if (typeof window !== 'undefined') {
  useAuthStore.getState().restoreSession().catch(console.error);
}
