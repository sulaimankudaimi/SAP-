/**
 * Audit Snapshot Redaction Engine
 * 
 * Central redaction mechanism ensuring that password hashes, salts, OTPs,
 * session tokens, secrets, and private keys never leak into the append-only
 * audit trail, export bundles, diagnostic logs, or console.
 */

export const SENSITIVE_KEY_PATTERN = /(password|passwd|salt|otp|secret|token|passphrase|privatekey|apikey)/i;

export const SENSITIVE_KEYS = new Set<string>(['passwordHash', 'passwordSalt']);

export interface RedactSnapshotOptions {
  scrubMode?: boolean;
}

/**
 * Compares two raw primitive/object values to detect changes without leaking content.
 */
function rawValuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null || typeof a !== 'object') return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Checks if a property key represents a sensitive credential or secret.
 * Explicitly preserves non-sensitive keys such as 'checksum' or a bare 'hash'.
 */
export function isSensitiveKey(key: string): boolean {
  if (key === 'mustChangePassword') return false;
  if (SENSITIVE_KEYS.has(key)) return true;
  return SENSITIVE_KEY_PATTERN.test(key);
}

/**
 * Deeply redacts sensitive keys from snapshot objects without mutating inputs.
 * Safe against circular references and deep nesting.
 *
 * Markers:
 * - '[REDACTED]' when the value is unchanged between before and after, or only present on one side.
 * - '[REDACTED:CHANGED]' on the AFTER side when the raw value differs from the BEFORE side.
 */
export function redactSnapshot(
  before: unknown,
  after: unknown,
  options?: RedactSnapshotOptions | boolean
): { before: unknown; after: unknown } {
  const scrubMode = typeof options === 'boolean' ? options : Boolean(options?.scrubMode);

  const seenBefore = new WeakMap<object, unknown>();
  const seenAfter = new WeakMap<object, unknown>();

  function walk(
    bNode: unknown,
    aNode: unknown
  ): { bResult: unknown; aResult: unknown } {
    // 1. If both are null/undefined or primitives
    const bIsObj = bNode !== null && typeof bNode === 'object';
    const aIsObj = aNode !== null && typeof aNode === 'object';

    if (!bIsObj && !aIsObj) {
      return { bResult: bNode, aResult: aNode };
    }

    // 2. Handle circular references
    if (bIsObj && seenBefore.has(bNode as object)) {
      return { bResult: seenBefore.get(bNode as object), aResult: aNode };
    }
    if (aIsObj && seenAfter.has(aNode as object)) {
      return { bResult: bNode, aResult: seenAfter.get(aNode as object) };
    }

    // 3. Handle Arrays
    const bIsArr = Array.isArray(bNode);
    const aIsArr = Array.isArray(aNode);

    if (bIsArr || aIsArr) {
      const bArray = (bIsArr ? (bNode as unknown[]) : []) as unknown[];
      const aArray = (aIsArr ? (aNode as unknown[]) : []) as unknown[];

      const bClone: unknown[] = [];
      const aClone: unknown[] = [];

      if (bIsArr) seenBefore.set(bNode as object, bClone);
      if (aIsArr) seenAfter.set(aNode as object, aClone);

      const maxLen = Math.max(bArray.length, aArray.length);
      for (let i = 0; i < maxLen; i++) {
        const bElem = i < bArray.length ? bArray[i] : undefined;
        const aElem = i < aArray.length ? aArray[i] : undefined;

        const { bResult, aResult } = walk(bElem, aElem);
        if (i < bArray.length) bClone.push(bResult);
        if (i < aArray.length) aClone.push(aResult);
      }

      return {
        bResult: bIsArr ? bClone : bNode,
        aResult: aIsArr ? aClone : aNode,
      };
    }

    // 4. Handle Objects
    const bObj = bIsObj ? (bNode as Record<string, unknown>) : {};
    const aObj = aIsObj ? (aNode as Record<string, unknown>) : {};

    const bClone: Record<string, unknown> = {};
    const aClone: Record<string, unknown> = {};

    if (bIsObj) seenBefore.set(bNode as object, bClone);
    if (aIsObj) seenAfter.set(aNode as object, aClone);

    const allKeys = new Set<string>([
      ...(bIsObj ? Object.keys(bObj) : []),
      ...(aIsObj ? Object.keys(aObj) : []),
    ]);

    for (const key of allKeys) {
      const hasBefore = bIsObj && Object.prototype.hasOwnProperty.call(bObj, key);
      const hasAfter = aIsObj && Object.prototype.hasOwnProperty.call(aObj, key);

      const rawBVal = hasBefore ? bObj[key] : undefined;
      const rawAVal = hasAfter ? aObj[key] : undefined;

      if (isSensitiveKey(key)) {
        if (hasBefore && hasAfter) {
          const changed = !rawValuesEqual(rawBVal, rawAVal);
          bClone[key] = '[REDACTED]';
          aClone[key] = changed && !scrubMode ? '[REDACTED:CHANGED]' : '[REDACTED]';
        } else if (hasBefore) {
          bClone[key] = '[REDACTED]';
        } else if (hasAfter) {
          aClone[key] = '[REDACTED]';
        }
      } else {
        // Recursive walk for non-sensitive key
        const { bResult, aResult } = walk(rawBVal, rawAVal);
        if (hasBefore) bClone[key] = bResult;
        if (hasAfter) aClone[key] = aResult;
      }
    }

    return {
      bResult: bIsObj ? bClone : bNode,
      aResult: aIsObj ? aClone : aNode,
    };
  }

  const { bResult, aResult } = walk(before, after);
  return {
    before: bResult,
    after: aResult,
  };
}
