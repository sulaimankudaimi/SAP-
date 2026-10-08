/**
 * In-memory & sessionStorage mirrored storage for the first-boot admin one-time password.
 * NEVER written to IndexedDB or localStorage.
 * Mirrored in sessionStorage so a page refresh in the same tab does not lose it.
 * clear() wipes both the memory cache and sessionStorage.
 */

const SESSION_STORAGE_KEY = 'gulf_fb_otp';

let memorySecret: string | null = null;

export const FirstBootSecret = {
  /**
   * Sets the temporary admin OTP in memory and sessionStorage.
   */
  set(secret: string): void {
    memorySecret = secret;
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(SESSION_STORAGE_KEY, secret);
      }
    } catch {
      // Ignore sessionStorage issues
    }
  },

  /**
   * Retrieves the temporary admin OTP, looking in memory first then sessionStorage.
   */
  get(): string | null {
    if (memorySecret) {
      return memorySecret;
    }
    try {
      if (typeof sessionStorage !== 'undefined') {
        const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (stored) {
          memorySecret = stored;
          return stored;
        }
      }
    } catch {
      // Ignore sessionStorage issues
    }
    return null;
  },

  /**
   * Wipes the temporary secret from both memory and sessionStorage.
   */
  clear(): void {
    memorySecret = null;
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      // Ignore sessionStorage issues
    }
  },
};
