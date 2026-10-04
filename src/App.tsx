import React, { useEffect } from 'react';
import { HashRouter } from 'react-router-dom';
import { AppRoutes } from './app/routes';
import { ToastProvider } from './components/ui/Toast';
import { DatabaseSeeder } from './seed';

export default function App() {
  useEffect(() => {
    DatabaseSeeder.isSeeded().then((seeded) => {
      if (!seeded) {
        DatabaseSeeder.seed().catch(console.error);
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
