/**
 * Runtime Offline Guard for Gulf Energy ERP
 * Ensures 100% offline execution by intercepting and rejecting any unauthorized external network calls.
 * Blocks fetch, XMLHttpRequest, window.open to external URLs, WebSocket, and EventSource.
 * Allows only local data: and blob: URLs needed for local exports and barcodes.
 */

import { DiagnosticLogger } from '../services/DiagnosticLogger';

class OfflineGuardViolationError extends Error {
  constructor(targetUrl: string) {
    super(
      `[OfflineEnforcer] تم حظر محاولة اتصال خارجي (${targetUrl}). نظام طاقة الخليج يعمل بنسبة 100% بدون اتصال خارجي.`
    );
    this.name = 'OfflineGuardViolationError';
  }
}

export function initializeOfflineGuard(): void {
  if (typeof window === 'undefined') return;

  const originalFetch = window.fetch;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    // Allow internal blob and data URIs (e.g., SVG/canvas barcodes, exported XLSX/CSV blobs)
    if (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('/')) {
      return originalFetch(input, init);
    }

    const error = new OfflineGuardViolationError(url);
    DiagnosticLogger.error('OfflineGuard', error.message);
    throw error;
  };

  const originalXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    async: boolean = true,
    user?: string | null,
    password?: string | null
  ) {
    const urlStr = url.toString();
    if (!urlStr.startsWith('blob:') && !urlStr.startsWith('data:') && !urlStr.startsWith('/') && !urlStr.startsWith(window.location.origin)) {
      const error = new OfflineGuardViolationError(urlStr);
      DiagnosticLogger.error('OfflineGuard', error.message);
      throw error;
    }
    return originalXHROpen.call(this, method, url, async, user, password);
  };

  // Block window.open to external destinations
  const originalWindowOpen = window.open;
  window.open = function (url?: string | URL, target?: string, features?: string) {
    if (url) {
      const urlStr = typeof url === 'string' ? url : url.href;
      if (
        !urlStr.startsWith('blob:') &&
        !urlStr.startsWith('data:') &&
        !urlStr.startsWith('about:') &&
        !urlStr.startsWith('/') &&
        !urlStr.startsWith('#') &&
        !urlStr.startsWith(window.location.origin)
      ) {
        const error = new OfflineGuardViolationError(urlStr);
        DiagnosticLogger.error('OfflineGuard', error.message);
        throw error;
      }
    }
    return originalWindowOpen.call(this, url, target, features);
  };

  // Block WebSocket connections
  if ('WebSocket' in window) {
    window.WebSocket = function (url: string | URL) {
      const urlStr = typeof url === 'string' ? url : url.href;
      const error = new OfflineGuardViolationError(urlStr);
      DiagnosticLogger.error('OfflineGuard', error.message);
      throw error;
    } as unknown as typeof WebSocket;
  }

  // Block EventSource connections
  if ('EventSource' in window) {
    window.EventSource = function (url: string | URL) {
      const urlStr = typeof url === 'string' ? url : url.href;
      const error = new OfflineGuardViolationError(urlStr);
      DiagnosticLogger.error('OfflineGuard', error.message);
      throw error;
    } as unknown as typeof EventSource;
  }

  // Mark guard as active
  (window as unknown as Record<string, unknown>).__GULF_OFFLINE_GUARD_ACTIVE__ = true;
}
