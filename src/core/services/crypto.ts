/**
 * Web Crypto API Salted PBKDF2 & HMAC-SHA256 Implementation
 * 100% offline, zero network, zero external dependencies
 */

const IDB_KEY_DB = 'gulf_erp_keystore';
const IDB_KEY_STORE = 'keys';
const HMAC_KEY_ID = 'session_hmac_key';

let cachedHmacKey: CryptoKey | null = null;

function getWebCrypto(): Crypto {
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto;
  }
  throw new Error('Web Crypto API is not available in this environment');
}

function openKeyDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available in this environment'));
      return;
    }
    const request = indexedDB.open(IDB_KEY_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_KEY_STORE)) {
        db.createObjectStore(IDB_KEY_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getOrGenerateHmacKey(): Promise<CryptoKey> {
  if (cachedHmacKey) {
    return cachedHmacKey;
  }

  const cryptoApi = getWebCrypto();

  if (typeof indexedDB === 'undefined') {
    cachedHmacKey = await cryptoApi.subtle.generateKey(
      {
        name: 'HMAC',
        hash: { name: 'SHA-256' },
      },
      false, // non-extractable per security spec
      ['sign', 'verify']
    );
    return cachedHmacKey;
  }

  const idb = await openKeyDatabase();
  
  // 1. Try reading existing key first
  const existingKey = await new Promise<CryptoKey | null>((resolve, reject) => {
    const tx = idb.transaction(IDB_KEY_STORE, 'readonly');
    const store = tx.objectStore(IDB_KEY_STORE);
    const getReq = store.get(HMAC_KEY_ID);
    getReq.onsuccess = () => {
      resolve(getReq.result?.key || null);
    };
    getReq.onerror = () => reject(getReq.error);
  });

  if (existingKey) {
    cachedHmacKey = existingKey;
    return cachedHmacKey;
  }

  // 2. Generate key outside of IDB transaction
  const generatedKey = await cryptoApi.subtle.generateKey(
    {
      name: 'HMAC',
      hash: { name: 'SHA-256' },
    },
    false, // non-extractable per security spec
    ['sign', 'verify']
  );

  // 3. Save generated key in a fresh readwrite transaction
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction(IDB_KEY_STORE, 'readwrite');
    const store = tx.objectStore(IDB_KEY_STORE);
    const putReq = store.put({ id: HMAC_KEY_ID, key: generatedKey });
    putReq.onsuccess = () => resolve();
    putReq.onerror = () => reject(putReq.error);
  });

  cachedHmacKey = generatedKey;
  return cachedHmacKey;
}

export class CryptoService {
  private static ITERATIONS = 100000;
  private static KEY_LENGTH = 32; // 256 bits

  /**
   * Generates a random cryptographic salt (16 bytes hex = 32 chars).
   */
  static generateSalt(): string {
    const array = new Uint8Array(16);
    getWebCrypto().getRandomValues(array);
    return Array.from(array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Generates a 16-character secure OTP from an unambiguous alphabet (no 0/O/1/l/I)
   * using cryptographic random values.
   */
  static generateSecureOtp(length: number = 16): string {
    // Unambiguous character set excluding 0, O, o, 1, l, I
    const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz#@!';
    const array = new Uint8Array(length);
    getWebCrypto().getRandomValues(array);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += alphabet[array[i] % alphabet.length];
    }
    return result;
  }

  /**
   * Hashes a password with salt using PBKDF2 + SHA-256.
   */
  static async hashPassword(password: string, salt: string): Promise<string> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    const saltBuffer = encoder.encode(salt);
    const cryptoApi = getWebCrypto();

    const baseKey = await cryptoApi.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const derivedBits = await cryptoApi.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: this.ITERATIONS,
        hash: 'SHA-256',
      },
      baseKey,
      this.KEY_LENGTH * 8
    );

    const hashArray = Array.from(new Uint8Array(derivedBits));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Verifies a plain password against stored salt and hash.
   */
  static async verifyPassword(
    password: string,
    salt: string,
    storedHash: string
  ): Promise<boolean> {
    const computedHash = await this.hashPassword(password, salt);
    return computedHash === storedHash;
  }

  /**
   * Constant-time byte comparison to eliminate timing side-channels.
   */
  static constantTimeCompare(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      diff |= a[i] ^ b[i];
    }
    return diff === 0;
  }

  /**
   * Signs a payload with HMAC-SHA256 using the non-extractable installation key.
   * Returns a hex-encoded signature.
   */
  static async sign(payload: string): Promise<string> {
    const key = await getOrGenerateHmacKey();
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(payload);
    const sigBuffer = await getWebCrypto().subtle.sign('HMAC', key, dataBuffer);
    return Array.from(new Uint8Array(sigBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Verifies an HMAC-SHA256 signature using constant-time comparison.
   */
  static async verify(payload: string, signatureHex: string): Promise<boolean> {
    try {
      if (!signatureHex || typeof signatureHex !== 'string') return false;
      const expectedSigHex = await this.sign(payload);

      // Convert hex strings to byte arrays for constant-time comparison
      if (expectedSigHex.length !== signatureHex.length) return false;
      const a = new Uint8Array(expectedSigHex.length / 2);
      const b = new Uint8Array(signatureHex.length / 2);
      for (let i = 0; i < a.length; i++) {
        a[i] = parseInt(expectedSigHex.substr(i * 2, 2), 16);
        b[i] = parseInt(signatureHex.substr(i * 2, 2), 16);
      }

      return this.constantTimeCompare(a, b);
    } catch (err) {
      console.warn('HMAC verification error:', err);
      return false;
    }
  }
}
