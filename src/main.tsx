import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initializeOfflineGuard } from './core/security/offlineGuard';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

import { DiagnosticLogger } from './core/services/DiagnosticLogger';

// Initialize 100% offline network enforcer at runtime safely
try {
  initializeOfflineGuard();
} catch (err) {
  DiagnosticLogger.warn(
    'OfflineGuard',
    `Offline guard failed to initialize: ${err instanceof Error ? err.message : String(err)}`
  );
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

