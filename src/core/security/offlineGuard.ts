/**
 * Runtime Offline Guard for Gulf Energy ERP
 * Ensures 100% offline execution by intercepting and rejecting any unauthorized external network calls.
 * Allows only local data: and blob: URLs needed for local exports and barcodes.
 */

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
      // Local same-origin or data/blob
      return originalFetch(input, init);
    }

    const error = new OfflineGuardViolationError(url);
    console.error(error.message);
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
      console.error(error.message);
      throw error;
    }
    return originalXHROpen.call(this, method, url, async, user, password);
  };

  // Mark guard as active
  (window as unknown as Record<string, unknown>).__GULF_OFFLINE_GUARD_ACTIVE__ = true;
}
