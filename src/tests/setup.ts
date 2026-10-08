import 'fake-indexeddb/auto';
import { beforeEach, vi } from 'vitest';
import { db } from '../core/db';
import { SessionContext } from '../core/security/SessionContext';

// In-memory localStorage/sessionStorage stub
const createStorageStub = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string): string | null => store[key] || null,
    setItem: (key: string, value: string): void => {
      store[key] = String(value);
    },
    removeItem: (key: string): void => {
      delete store[key];
    },
    clear: (): void => {
      store = {};
    },
    key: (index: number): string | null => Object.keys(store)[index] || null,
    get length(): number {
      return Object.keys(store).length;
    },
  };
};

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: createStorageStub(),
    writable: true,
  });
  Object.defineProperty(window, 'sessionStorage', {
    value: createStorageStub(),
    writable: true,
  });
} else if (typeof globalThis !== 'undefined') {
  (globalThis as unknown as { localStorage: unknown }).localStorage = createStorageStub();
  (globalThis as unknown as { sessionStorage: unknown }).sessionStorage = createStorageStub();
}

beforeEach(async () => {
  SessionContext.clearActor();
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
  } catch {
    // Ignore storage clear issues
  }
  await db.users.clear();
  await db.roles.clear();
  await db.auditLogs.clear();
});
