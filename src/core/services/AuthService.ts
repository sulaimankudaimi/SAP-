import { userRepository, roleRepository } from '../repositories';
import { CryptoService } from './crypto';
import { AuditService } from './AuditService';
import { FirstBootSecret } from '../security/FirstBootSecret';
import { db } from '../db';
import type { User, Role } from '../../types/models';

export interface AuthSession {
  user: User;
  role: Role;
  token: string;
  expiresAt: number;
}

export const GENERIC_CREDENTIAL_ERROR =
  'اسم المستخدم أو كلمة المرور غير صحيحة، وقد يؤدي تكرار المحاولات إلى قفل الحساب مؤقتاً.';

const DUMMY_SALT = '00000000000000000000000000000000';
const DUMMY_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

const failureThrottleMap = new Map<string, number[]>();
let adminPasswordRegenCount = 0;

export function _resetThrottleMapForTesting(): void {
  failureThrottleMap.clear();
  adminPasswordRegenCount = 0;
}

export function _getFailureThrottleCount(key: string): number {
  return failureThrottleMap.get(key.trim().toLowerCase())?.length ?? 0;
}

async function applyFailureThrottle(key: string): Promise<void> {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const history = failureThrottleMap.get(key) || [];
  const validHistory = history.filter((t) => now - t <= windowMs);
  failureThrottleMap.set(key, validHistory);

  if (validHistory.length >= 5) {
    const excess = validHistory.length - 5;
    // 1s, 2s, 4s, max 8s
    const delayMs = Math.min(8000, 1000 * Math.pow(2, excess));
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

function recordFailureInThrottle(key: string): void {
  const history = failureThrottleMap.get(key) || [];
  history.push(Date.now());
  failureThrottleMap.set(key, history);
}

function clearThrottle(key: string): void {
  failureThrottleMap.delete(key);
}

export class AuthService {
  private static MAX_FAILED_ATTEMPTS = 5;
  private static LOCKOUT_MINUTES = 15;

  /**
   * Known legacy salt from prior static seeder implementations.
   * Kept exclusively for transparent runtime cryptographic upgrade upon successful verification.
   */
  static readonly LEGACY_SALTS = ['e8f7b2c14a9018d423985710bcdef012'] as const;

  /**
   * Validates strong password policy:
   * Min 10 chars, uppercase, lowercase, digit, and special symbol.
   */
  static validatePasswordPolicy(password: string): boolean {
    if (!password || password.length < 10) return false;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSymbol = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password);
    return hasUpper && hasLower && hasDigit && hasSymbol;
  }

  /**
   * Authenticates user against salted PBKDF2 hash with automatic lockout protection.
   * Issues HMAC-SHA256 signed token.
   * Upgrades legacy fixed salts transparently upon successful login.
   * Performs user updates and audit logs atomically inside Dexie transaction.
   */
  static async login(username: string, password: string): Promise<AuthSession> {
    const cleanUsername = username.trim().toLowerCase();

    const users = await userRepository.list({
      where: { username: cleanUsername },
    });

    const user = users[0];

    // Unknown username: throttle, dummy verify for timing equalization, then throw generic error
    if (!user) {
      await applyFailureThrottle(cleanUsername);
      await CryptoService.verifyPassword(password, DUMMY_SALT, DUMMY_HASH, CryptoService.CURRENT_ITERATIONS);
      recordFailureInThrottle(cleanUsername);
      throw new Error(GENERIC_CREDENTIAL_ERROR);
    }

    // Check account lockout status
    if (user.isLocked) {
      if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
        await applyFailureThrottle(cleanUsername);
        await CryptoService.verifyPassword(password, DUMMY_SALT, DUMMY_HASH, CryptoService.CURRENT_ITERATIONS);
        recordFailureInThrottle(cleanUsername);
        throw new Error(GENERIC_CREDENTIAL_ERROR);
      } else {
        // Unlock expired lock atomically with ACCOUNT_UNLOCKED audit (explicit non-secret snapshot)
        try {
          await db.transaction('rw', [db.users, db.auditLogs], async () => {
            const freshUser = await db.users.get(user.id);
            if (freshUser) {
              const updatedUser = {
                ...freshUser,
                isLocked: false,
                failedLoginAttempts: 0,
                lockedUntil: undefined,
                updatedAt: new Date().toISOString(),
              };
              await db.users.put(updatedUser);
              await AuditService.log({
                action: 'ACCOUNT_UNLOCKED',
                entity: 'users',
                entityId: user.id,
                userId: user.id,
                userName: user.username,
                before: { isLocked: true },
                after: { isLocked: false, failedLoginAttempts: 0, reason: 'Expired lock auto-reset' },
              });
            }
          });
        } catch {
          throw new Error('تعذر إلغاء قفل الحساب. يرجى المحاولة لاحقاً.');
        }
      }
    }

    // Verify Password Hash using stored iterations count (defaulting to 100,000 for legacy users)
    let userIterations = user.passwordIterations ?? CryptoService.LEGACY_ITERATIONS;
    await applyFailureThrottle(cleanUsername);
    let isValid = await CryptoService.verifyPassword(
      password,
      user.passwordSalt,
      user.passwordHash,
      userIterations
    );

    // If passwordIterations was missing and 100k failed, check CURRENT_ITERATIONS in case user had default hash
    if (!isValid && user.passwordIterations === undefined) {
      const isCurrentDefaultValid = await CryptoService.verifyPassword(
        password,
        user.passwordSalt,
        user.passwordHash,
        CryptoService.CURRENT_ITERATIONS
      );
      if (isCurrentDefaultValid) {
        isValid = true;
        userIterations = CryptoService.CURRENT_ITERATIONS;
      }
    }

    if (!isValid) {
      recordFailureInThrottle(cleanUsername);
      const attempts = (user.failedLoginAttempts || 0) + 1;
      const isNowLocked = attempts >= this.MAX_FAILED_ATTEMPTS;
      const lockedUntil = isNowLocked
        ? new Date(Date.now() + this.LOCKOUT_MINUTES * 60000).toISOString()
        : undefined;

      try {
        await db.transaction('rw', [db.users, db.auditLogs], async () => {
          const freshUser = await db.users.get(user.id);
          if (freshUser) {
            const updatedUser = {
              ...freshUser,
              failedLoginAttempts: attempts,
              isLocked: isNowLocked,
              lockedUntil,
              updatedAt: new Date().toISOString(),
            };
            await db.users.put(updatedUser);

            // Log LOGIN_FAILED with attempt count (never log password or raw row)
            await AuditService.log({
              action: 'LOGIN_FAILED',
              entity: 'users',
              entityId: user.id,
              userId: user.id,
              userName: user.username,
              after: { attempt: attempts, isNowLocked },
            });

            // If threshold reached, log ACCOUNT_LOCKED
            if (isNowLocked) {
              await AuditService.log({
                action: 'ACCOUNT_LOCKED',
                entity: 'users',
                entityId: user.id,
                userId: user.id,
                userName: user.username,
                after: { lockedUntil, reason: 'Max failed login attempts reached' },
              });
            }
          }
        });
      } catch {
        throw new Error('حدث خطأ أثناء معالجة تسجيل الدخول. يرجى المحاولة لاحقاً.');
      }

      // Uniform error message without leaking remaining attempts or lockout status
      throw new Error(GENERIC_CREDENTIAL_ERROR);
    }

    // Clear throttle record on valid credentials
    clearThrottle(cleanUsername);

    // Check if user has a legacy fixed salt or iterations < 600,000 that needs transparent upgrade
    const isLegacySalt = (this.LEGACY_SALTS as readonly string[]).includes(user.passwordSalt);
    const isLegacyIterations = userIterations < CryptoService.CURRENT_ITERATIONS;
    const needsUpgrade = isLegacySalt || isLegacyIterations;

    let finalSalt = user.passwordSalt;
    let finalHash = user.passwordHash;
    let finalIterations = userIterations;

    if (needsUpgrade) {
      finalSalt = CryptoService.generateSalt();
      finalIterations = CryptoService.CURRENT_ITERATIONS;
      finalHash = await CryptoService.hashPassword(password, finalSalt, finalIterations);
    }

    // Login successful: reset failed attempts & record LOGIN audit in a single transaction
    const now = new Date().toISOString();
    let updatedSessionUser: User = { ...user, lastLoginAt: now };

    try {
      await db.transaction('rw', [db.users, db.auditLogs], async () => {
        const freshUser = await db.users.get(user.id);
        if (freshUser) {
          const updatedUser: User = {
            ...freshUser,
            passwordSalt: finalSalt,
            passwordHash: finalHash,
            passwordIterations: finalIterations,
            failedLoginAttempts: 0,
            isLocked: false,
            lockedUntil: undefined,
            lastLoginAt: now,
            updatedAt: now,
          };
          await db.users.put(updatedUser);
          updatedSessionUser = updatedUser;

          await AuditService.log({
            action: 'LOGIN',
            entity: 'users',
            entityId: user.id,
            userId: user.id,
            userName: user.username,
            after: {
              lastLoginAt: now,
              saltUpgraded: isLegacySalt,
              iterationsUpgraded: isLegacyIterations,
            },
          });

          if (needsUpgrade) {
            await AuditService.log({
              action: 'UPDATE',
              entity: 'users',
              entityId: user.id,
              userId: user.id,
              userName: user.username,
              after: {
                reason: isLegacyIterations
                  ? 'Cryptographic PBKDF2 Iteration Upgrade to 600,000'
                  : 'Cryptographic Salt Upgrade to Random Salt',
              },
            });
          }
        }
      });
    } catch {
      throw new Error('حدث خطأ في النظام أثناء توثيق الدخول.');
    }

    // Clear FirstBootSecret only after successful login of the bootstrap admin
    const isBootstrapAdmin =
      (user.username === 'admin' || user.id === 'admin') && !user.lastLoginAt;
    if (isBootstrapAdmin) {
      FirstBootSecret.clear();
    }

    const role = await roleRepository.getById(user.roleId);
    if (!role) {
      throw new Error(`الدور الوظيفي المحدد للمستخدم [${user.roleId}] غير موجود بالنظام.`);
    }

    // Create session token: HMAC-SHA256 signed over userId:roleCode:expiresAt
    const expiresAt = Date.now() + 12 * 60 * 60 * 1000; // 12 hours
    const tokenPayload = `${user.id}:${role.code}:${expiresAt}`;
    const token = await CryptoService.sign(tokenPayload);

    return {
      user: updatedSessionUser,
      role,
      token,
      expiresAt,
    };
  }

  /**
   * Updates user password and resets mustChangePassword flag.
   * Requires and verifies current password.
   * Enforces 10+ chars, upper, lower, digit, symbol.
   * Enforces that new password must differ from current password.
   * Generates a NEW random salt and hashes with PBKDF2.
   */
  static async changePassword(
    userId: string,
    currentPlainPassword: string,
    newPlainPassword: string
  ): Promise<void> {
    const existingUser = await userRepository.getById(userId);
    if (!existingUser) {
      throw new Error('المستخدم غير موجود.');
    }

    // 1. Verify current password
    const currentIterations = existingUser.passwordIterations ?? CryptoService.LEGACY_ITERATIONS;
    let isCurrentValid = await CryptoService.verifyPassword(
      currentPlainPassword,
      existingUser.passwordSalt,
      existingUser.passwordHash,
      currentIterations
    );
    if (!isCurrentValid && existingUser.passwordIterations === undefined) {
      isCurrentValid = await CryptoService.verifyPassword(
        currentPlainPassword,
        existingUser.passwordSalt,
        existingUser.passwordHash,
        CryptoService.CURRENT_ITERATIONS
      );
    }
    if (!isCurrentValid) {
      throw new Error('كلمة المرور الحالية غير صحيحة.');
    }

    // 2. Ensure new password differs from current password
    if (currentPlainPassword === newPlainPassword) {
      throw new Error('كلمة المرور الجديدة يجب أن تكون مختلفة عن كلمة المرور الحالية.');
    }

    // 3. Validate password policy
    if (!this.validatePasswordPolicy(newPlainPassword)) {
      throw new Error(
        'كلمة المرور يجب أن لا تقل عن 10 خانات، وتحتوي على حرف كبير، حرف صغير، رقم، ورمز خاص واحد على الأقل.'
      );
    }

    // 4. Generate fresh random salt & PBKDF2 hash with 600,000 iterations
    const newSalt = CryptoService.generateSalt();
    const newHash = await CryptoService.hashPassword(
      newPlainPassword,
      newSalt,
      CryptoService.CURRENT_ITERATIONS
    );

    const authContext = { userId: existingUser.id, userName: existingUser.username };

    await userRepository.update(
      userId,
      {
        passwordSalt: newSalt,
        passwordHash: newHash,
        passwordIterations: CryptoService.CURRENT_ITERATIONS,
        mustChangePassword: false,
        updatedAt: new Date().toISOString(),
      },
      authContext
    );

    await AuditService.log({
      action: 'PASSWORD_CHANGED',
      entity: 'users',
      entityId: userId,
      userId: existingUser.id,
      userName: existingUser.username,
      after: { mustChangePassword: false, updatedAt: new Date().toISOString() },
    });
  }

  /**
   * Regenerates temporary one-time password for the initial admin.
   * Allowed ONLY when the admin has never logged in (lastLoginAt is undefined)
   * AND mustChangePassword is true.
   * Throttled to at most 3 regenerations per page session.
   */
  static async regenerateInitialAdminPassword(): Promise<string> {
    if (adminPasswordRegenCount >= 3) {
      throw new Error('تجاوزت الحد الأقصى لإعادة توليد كلمة المرور المؤقتة (3 محاولات لكل جلسة).');
    }

    const admin = await db.users.where({ username: 'admin' }).first();
    if (!admin) {
      throw new Error('حساب مدير النظام غير موجود.');
    }

    if (admin.lastLoginAt) {
      throw new Error('لا يمكن إعادة توليد كلمة المرور المؤقتة بعد تسجيل الدخول الأول للنظام.');
    }

    if (!admin.mustChangePassword) {
      throw new Error('تم تغيير كلمة المرور مسبقاً وتأكيد الهوية.');
    }

    // Generate 16-character unambiguous OTP with 600,000 iterations
    const newOtp = CryptoService.generateSecureOtp(16);
    const newSalt = CryptoService.generateSalt();
    const newHash = await CryptoService.hashPassword(
      newOtp,
      newSalt,
      CryptoService.CURRENT_ITERATIONS
    );

    const now = new Date().toISOString();

    // Perform user update through userRepository.update with explicit system context inside one db.transaction
    // The repository already audits; do not double-log.
    await db.transaction('rw', [db.users, db.auditLogs], async () => {
      await userRepository.update(
        admin.id,
        {
          passwordSalt: newSalt,
          passwordHash: newHash,
          passwordIterations: CryptoService.CURRENT_ITERATIONS,
          failedLoginAttempts: 0,
          isLocked: false,
          lockedUntil: undefined,
          updatedAt: now,
        },
        { system: true, userName: 'AdminPasswordRecovery' }
      );
    });

    adminPasswordRegenCount++;

    // Save strictly to memory / sessionStorage
    FirstBootSecret.set(newOtp);

    return newOtp;
  }
}
