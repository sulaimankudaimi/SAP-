import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initializeOfflineGuard } from './core/security/offlineGuard';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

// Initialize 100% offline network enforcer at runtime
initializeOfflineGuard();

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

