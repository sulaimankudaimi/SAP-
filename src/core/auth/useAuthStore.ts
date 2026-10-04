import { create } from 'zustand';
import type { User, Role, AuthObject } from '../../types/models';
import type { AuthSession } from '../services/AuthService';
import { RbacService } from '../services/RbacService';
import { CryptoService } from '../services/crypto';

interface AuthState {
  user: User | null;
  role: Role | null;
  token: string | null;
  isAuthenticated: boolean;
  isAutoLocked: boolean;
  lastActivity: number;
  idleTimeoutMinutes: number;

  setSession: (session: AuthSession) => void;
  logout: () => void;
  recordActivity: () => void;
  lockSession: () => void;
  unlockSession: (password: string) => Promise<boolean>;
  can: (required: AuthObject, plant?: string, costCenter?: string, amount?: number) => boolean;
}

const STORAGE_SESSION_KEY = 'gulf_erp_session_v1';

// Restore saved session token from sessionStorage if valid
function getInitialSession(): { user: User | null; role: Role | null; token: string | null } {
  try {
    const raw = sessionStorage.getItem(STORAGE_SESSION_KEY);
    if (!raw) return { user: null, role: null, token: null };
    const parsed = JSON.parse(raw);
    if (parsed.expiresAt && parsed.expiresAt > Date.now()) {
      return {
        user: parsed.user,
        role: parsed.role,
        token: parsed.token,
      };
    }
    sessionStorage.removeItem(STORAGE_SESSION_KEY);
  } catch {
    // ignore
  }
  return { user: null, role: null, token: null };
}

const initial = getInitialSession();

export const useAuthStore = create<AuthState>((set, get) => ({
  user: initial.user,
  role: initial.role,
  token: initial.token,
  isAuthenticated: !!initial.user,
  isAutoLocked: false,
  lastActivity: Date.now(),
  idleTimeoutMinutes: 15,

  setSession: (session: AuthSession) => {
    try {
      sessionStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
    } catch {
      // ignore
    }
    set({
      user: session.user,
      role: session.role,
      token: session.token,
      isAuthenticated: true,
      isAutoLocked: false,
      lastActivity: Date.now(),
    });
  },

  logout: () => {
    try {
      sessionStorage.removeItem(STORAGE_SESSION_KEY);
    } catch {
      // ignore
    }
    set({
      user: null,
      role: null,
      token: null,
      isAuthenticated: false,
      isAutoLocked: false,
    });
  },

  recordActivity: () => {
    set({ lastActivity: Date.now() });
  },

  lockSession: () => {
    set({ isAutoLocked: true });
  },

  unlockSession: async (password: string) => {
    const { user } = get();
    if (!user) return false;

    const isValid = await CryptoService.verifyPassword(
      password,
      user.passwordSalt,
      user.passwordHash
    );

    if (isValid) {
      set({ isAutoLocked: false, lastActivity: Date.now() });
      return true;
    }
    return false;
  },

  can: (required: AuthObject, plant?: string, costCenter?: string, amount?: number) => {
    const { role } = get();
    return RbacService.hasPermission(role, required, plant, costCenter, amount);
  },
}));
