import { create } from 'zustand';
import type { User, Role, AuthObject } from '../../types/models';
import type { AuthSession } from '../services/AuthService';
import { RbacService, SYSTEM_ROLES } from '../services/RbacService';

const SESSION_STORAGE_KEY = 'gulf_auth_session';
const LOGGED_OUT_KEY = 'gulf_auth_logged_out';

const DEFAULT_ADMIN_ROLE: Role = {
  id: 'r-admin',
  code: SYSTEM_ROLES.ADMIN,
  name: 'مدير النظام (System Administrator)',
  description: 'كامل الصلاحيات الفنية والتشغيلية لكافة الوحدات',
  permissionCodes: ['*'],
  isSystem: true,
};

const DEFAULT_ADMIN_USER: User = {
  id: 'u-admin',
  username: 'admin',
  fullName: 'م. أحمد الشمري (المدير العام)',
  email: 'admin@gulfenergy.sa',
  roleId: 'r-admin',
  roleCode: SYSTEM_ROLES.ADMIN,
  roleName: 'مدير النظام',
  companyCode: '1000',
  plantCode: '1100',
  passwordHash: '',
  passwordSalt: '',
  failedLoginAttempts: 0,
  isLocked: false,
  mustChangePassword: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  isDeleted: false,
};

interface AuthState {
  user: User | null;
  role: Role | null;
  token: string | null;
  expiresAt: number | null;
  isAuthenticated: boolean;
  isAutoLocked: boolean;
  lastActivity: number;

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

function getInitialSession(): {
  user: User | null;
  role: Role | null;
  token: string | null;
  expiresAt: number | null;
  isAuthenticated: boolean;
} {
  try {
    if (typeof window === 'undefined') {
      return {
        user: DEFAULT_ADMIN_USER,
        role: DEFAULT_ADMIN_ROLE,
        token: 'default-admin-token',
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        isAuthenticated: true,
      };
    }

    const isLoggedOut = localStorage.getItem(LOGGED_OUT_KEY) === 'true';
    if (isLoggedOut) {
      return {
        user: null,
        role: null,
        token: null,
        expiresAt: null,
        isAuthenticated: false,
      };
    }

    const saved = localStorage.getItem(SESSION_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as AuthSession;
      if (parsed.expiresAt && parsed.expiresAt > Date.now() && parsed.user && parsed.role) {
        return {
          user: parsed.user,
          role: parsed.role,
          token: parsed.token,
          expiresAt: parsed.expiresAt,
          isAuthenticated: true,
        };
      }
    }

    // Default to admin session on first boot for smooth preview
    return {
      user: DEFAULT_ADMIN_USER,
      role: DEFAULT_ADMIN_ROLE,
      token: 'default-admin-token',
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      isAuthenticated: true,
    };
  } catch {
    return {
      user: DEFAULT_ADMIN_USER,
      role: DEFAULT_ADMIN_ROLE,
      token: 'default-admin-token',
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      isAuthenticated: true,
    };
  }
}

const initial = getInitialSession();

export const useAuthStore = create<AuthState>((set, get) => ({
  user: initial.user,
  role: initial.role,
  token: initial.token,
  expiresAt: initial.expiresAt,
  isAuthenticated: initial.isAuthenticated,
  isAutoLocked: false,
  lastActivity: Date.now(),

  setSession: (session: AuthSession) => {
    try {
      localStorage.removeItem(LOGGED_OUT_KEY);
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Ignore storage errors
    }
    set({
      user: session.user,
      role: session.role,
      token: session.token,
      expiresAt: session.expiresAt,
      isAuthenticated: true,
      isAutoLocked: false,
      lastActivity: Date.now(),
    });
  },

  logout: () => {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.setItem(LOGGED_OUT_KEY, 'true');
    } catch {
      // Ignore storage errors
    }
    set({
      user: null,
      role: null,
      token: null,
      expiresAt: null,
      isAuthenticated: false,
      isAutoLocked: false,
    });
  },

  recordActivity: () => {
    set({ lastActivity: Date.now() });
  },

  setLocked: (locked: boolean) => {
    set({ isAutoLocked: locked });
  },

  unlock: async (_password: string) => {
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
