import { DiagnosticLogger } from './core/services/DiagnosticLogger';
import React, { useEffect } from 'react';
import { HashRouter } from 'react-router-dom';
import { AppRoutes } from './app/routes';
import { ToastProvider } from './components/ui/Toast';
import { DatabaseSeeder } from './seed';
import { SecurityMigrationService } from './core/services/SecurityMigrationService';

export default function App() {
  useEffect(() => {
    // Run one-time security migration to cleanse legacy plain text credentials
    SecurityMigrationService.run().catch(console.error);

    DatabaseSeeder.isSeeded().then((seeded) => {
      if (!seeded) {
        DatabaseSeeder.seed().catch((err: unknown) => { DiagnosticLogger.error('App', 'Operation failed', err); });
      }
    });
  }, []);

  return (
    <HashRouter>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </HashRouter>
  );
}
