/**
 * Web Crypto API Salted PBKDF2 Implementation
 * 100% offline, zero network, zero external dependencies
 */

export class CryptoService {
  private static ITERATIONS = 100000;
  private static KEY_LENGTH = 32; // 256 bits

  /**
   * Generates a random cryptographic salt (16 bytes hex).
   */
  static generateSalt(): string {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    return Array.from(array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Hashes a password with salt using PBKDF2 + SHA-256.
   */
  static async hashPassword(password: string, salt: string): Promise<string> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    const saltBuffer = encoder.encode(salt);

    const baseKey = await window.crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const derivedBits = await window.crypto.subtle.deriveBits(
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
}
