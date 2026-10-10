/**
 * Runtime Offline Guard for Gulf Energy ERP
 * Ensures 100% offline execution by intercepting and rejecting any unauthorized external network calls.
 * Blocks fetch, XMLHttpRequest, window.open to external URLs, WebSocket, and EventSource.
 * Allows only local data: and blob: URLs needed for local exports and barcodes.
 */

import { DiagnosticLogger } from '../services/DiagnosticLogger';

export class OfflineGuardViolationError extends Error {
  constructor(targetUrl: string) {
    super(
      `[OfflineEnforcer] تم حظر محاولة اتصال خارجي (${targetUrl}). نظام طاقة الخليج يعمل بنسبة 100% بدون اتصال خارجي.`
    );
    this.name = 'OfflineGuardViolationError';
  }
}

/**
 * Safely overrides or shadows a property on an object (such as window or Window.prototype)
 * even if the property is defined with only a getter on the prototype chain.
 */
function safelyOverrideProperty<T>(target: object, propertyKey: PropertyKey, value: T): boolean {
  // Strategy 1: Define own property on target with value descriptor
  try {
    Object.defineProperty(target, propertyKey, {
      value,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    return true;
  } catch {
    // Strategy 2: Define own getter on target if direct value is disallowed
    try {
      Object.defineProperty(target, propertyKey, {
        get: () => value,
        configurable: true,
        enumerable: true,
      });
      return true;
    } catch {
      // Strategy 3: Define on prototype
      try {
        const proto = Object.getPrototypeOf(target);
        if (proto) {
          Object.defineProperty(proto, propertyKey, {
            value,
            writable: true,
            configurable: true,
            enumerable: true,
          });
          return true;
        }
      } catch {
        // Strategy 4: Prototype getter
        try {
          const proto = Object.getPrototypeOf(target);
          if (proto) {
            Object.defineProperty(proto, propertyKey, {
              get: () => value,
              configurable: true,
              enumerable: true,
            });
            return true;
          }
        } catch {
          // Strategy 5: Standard assignment fallback
          try {
            (target as Record<PropertyKey, unknown>)[propertyKey] = value;
            return true;
          } catch (err) {
            DiagnosticLogger.warn(
              'OfflineGuard',
              `Could not override ${String(propertyKey)}: ${err instanceof Error ? err.message : String(err)}`
            );
            return false;
          }
        }
      }
    }
  }
  return false;
}

export function initializeOfflineGuard(): void {
  if (typeof window === 'undefined') return;

  const originalFetch = typeof window.fetch === 'function' ? window.fetch : null;
  if (originalFetch) {
    const guardedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

      // Allow internal blob and data URIs, local root paths, and same-origin requests
      if (
        url.startsWith('blob:') ||
        url.startsWith('data:') ||
        url.startsWith('/') ||
        (typeof window.location !== 'undefined' && window.location.origin && url.startsWith(window.location.origin))
      ) {
        return originalFetch.call(window, input, init);
      }

      const error = new OfflineGuardViolationError(url);
      DiagnosticLogger.error('OfflineGuard', error.message);
      throw error;
    };

    safelyOverrideProperty(window, 'fetch', guardedFetch);
  }

  if (typeof XMLHttpRequest !== 'undefined' && XMLHttpRequest.prototype) {
    try {
      const originalXHROpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function (
        method: string,
        url: string | URL,
        async: boolean = true,
        user?: string | null,
        password?: string | null
      ) {
        const urlStr = url.toString();
        if (
          !urlStr.startsWith('blob:') &&
          !urlStr.startsWith('data:') &&
          !urlStr.startsWith('/') &&
          (typeof window.location === 'undefined' || !urlStr.startsWith(window.location.origin))
        ) {
          const error = new OfflineGuardViolationError(urlStr);
          DiagnosticLogger.error('OfflineGuard', error.message);
          throw error;
        }
        return originalXHROpen.call(this, method, url, async, user, password);
      };
    } catch (err) {
      DiagnosticLogger.warn(
        'OfflineGuard',
        `Failed to override XMLHttpRequest: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Block window.open to external destinations
  if (typeof window.open === 'function') {
    const originalWindowOpen = window.open;
    const guardedOpen = function (url?: string | URL, target?: string, features?: string) {
      if (url) {
        const urlStr = typeof url === 'string' ? url : url.href;
        if (
          !urlStr.startsWith('blob:') &&
          !urlStr.startsWith('data:') &&
          !urlStr.startsWith('about:') &&
          !urlStr.startsWith('/') &&
          !urlStr.startsWith('#') &&
          (typeof window.location === 'undefined' || !urlStr.startsWith(window.location.origin))
        ) {
          const error = new OfflineGuardViolationError(urlStr);
          DiagnosticLogger.error('OfflineGuard', error.message);
          throw error;
        }
      }
      return originalWindowOpen.call(window, url, target, features);
    };
    safelyOverrideProperty(window, 'open', guardedOpen);
  }

  // Block WebSocket connections (skip in DEV to allow preview / dev server tooling)
  if (!import.meta.env.DEV && 'WebSocket' in window) {
    const GuardedWebSocket = function (url: string | URL) {
      const urlStr = typeof url === 'string' ? url : url.href;
      const error = new OfflineGuardViolationError(urlStr);
      DiagnosticLogger.error('OfflineGuard', error.message);
      throw error;
    } as unknown as typeof WebSocket;
    safelyOverrideProperty(window, 'WebSocket', GuardedWebSocket);
  }

  // Block EventSource connections (skip in DEV to allow preview / dev server tooling)
  if (!import.meta.env.DEV && 'EventSource' in window) {
    const GuardedEventSource = function (url: string | URL) {
      const urlStr = typeof url === 'string' ? url : url.href;
      const error = new OfflineGuardViolationError(urlStr);
      DiagnosticLogger.error('OfflineGuard', error.message);
      throw error;
    } as unknown as typeof EventSource;
    safelyOverrideProperty(window, 'EventSource', GuardedEventSource);
  }

  // Mark guard as active
  safelyOverrideProperty(window, '__GULF_OFFLINE_GUARD_ACTIVE__', true);
}
