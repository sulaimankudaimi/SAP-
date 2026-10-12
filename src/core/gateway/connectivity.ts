import { create } from 'zustand';
import { db } from '../db';
import { DiagnosticLogger } from '../services/DiagnosticLogger';

export function isServerMode(): boolean {
  return import.meta.env.VITE_SERVER_MODE === 'true';
}

export function getServerUrl(): string {
  return (import.meta.env.VITE_ERP_SERVER_URL || '').trim();
}

export function getServerAnonKey(): string {
  return (import.meta.env.VITE_ERP_SERVER_ANON_KEY || '').trim();
}

interface ConnectivityState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  needsReviewCount: number;

  setOnline: (online: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  refreshOutboxCounts: () => Promise<void>;
}

export const useConnectivityStore = create<ConnectivityState>((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSyncing: false,
  pendingCount: 0,
  needsReviewCount: 0,

  setOnline: (online: boolean) => set({ isOnline: online }),
  setSyncing: (syncing: boolean) => set({ isSyncing: syncing }),

  refreshOutboxCounts: async () => {
    try {
      if (typeof window === 'undefined') return;
      const pending = await db.outbox
        .where('status')
        .equals('pending')
        .or('status')
        .equals('sending')
        .count();

      const needsReview = await db.outbox
        .where('status')
        .equals('needs_review')
        .count();

      set({ pendingCount: pending, needsReviewCount: needsReview });
    } catch (err) {
      DiagnosticLogger.warn(
        'ConnectivityStore',
        `Failed to refresh outbox counts: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  },
}));

let isInitialized = false;

/**
 * Initializes runtime network connectivity event listeners and outbox auto-refresh.
 * Returns an unsubscription cleanup function.
 */
export function initConnectivity(onReconnect?: () => void): () => void {
  if (typeof window === 'undefined' || isInitialized) {
    return () => {};
  }
  isInitialized = true;

  const handleOnline = () => {
    DiagnosticLogger.info('Connectivity', 'Network status: ONLINE. Resuming outbox syncing.');
    useConnectivityStore.getState().setOnline(true);
    useConnectivityStore.getState().refreshOutboxCounts();
    if (onReconnect) {
      onReconnect();
    }
  };

  const handleOffline = () => {
    DiagnosticLogger.warn('Connectivity', 'Network status: OFFLINE. Operations restricted to local / outbox.');
    useConnectivityStore.getState().setOnline(false);
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Initial outbox count sync
  useConnectivityStore.getState().refreshOutboxCounts();

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    isInitialized = false;
  };
}
