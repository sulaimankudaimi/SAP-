import { DiagnosticLogger } from './core/services/DiagnosticLogger';
import React, { useEffect } from 'react';
import { HashRouter } from 'react-router-dom';
import { AppRoutes } from './app/routes';
import { ToastProvider } from './components/ui/Toast';
import { DatabaseSeeder } from './seed';
import { SecurityMigrationService } from './core/services/SecurityMigrationService';
import { useAuthStore } from './core/auth/useAuthStore';
import { AuthBootGate } from './core/auth/AuthBootGate';
import { db } from './core/db';

export default function App() {
  useEffect(() => {
    async function boot() {
      try {
        await db.open();

        // Run one-time security migration to cleanse legacy plain text credentials
        await SecurityMigrationService.run();

        const seeded = await DatabaseSeeder.isSeeded();
        if (!seeded) {
          await DatabaseSeeder.seed();
        }

        // Restore session once on mount after database opens
        await useAuthStore.getState().restoreSession();
      } catch (err: unknown) {
        DiagnosticLogger.error('App', 'Boot initialization failed', err);
        useAuthStore.setState({ isBootRestoring: false, isAuthenticated: false });
      }
    }

    boot();
  }, []);

  return (
    <HashRouter>
      <ToastProvider>
        <AuthBootGate>
          <AppRoutes />
        </AuthBootGate>
      </ToastProvider>
    </HashRouter>
  );
}
