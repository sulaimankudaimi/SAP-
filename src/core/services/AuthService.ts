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
    if (!user) {
      throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة.');
    }

    // Check account lockout status
    if (user.isLocked) {
      if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
        const remainingMinutes = Math.ceil(
          (new Date(user.lockedUntil).getTime() - Date.now()) / 60000
        );
        throw new Error(
          `الحساب مقفل مؤقتاً لتجاوز المحاولات الخاطئة. يرجى المحاولة بعد ${remainingMinutes} دقيقة أو مراجعة مدير النظام.`
        );
      } else {
        // Unlock expired lock atomically with ACCOUNT_UNLOCKED audit
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
                before: freshUser,
                after: updatedUser,
              });
            }
          });
        } catch {
          throw new Error('تعذر إلغاء قفل الحساب. يرجى المحاولة لاحقاً.');
        }
      }
    }

    // Verify Password Hash
    const isValid = await CryptoService.verifyPassword(
      password,
      user.passwordSalt,
      user.passwordHash
    );

    if (!isValid) {
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

            // Log LOGIN_FAILED with attempt count (never log password)
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

      if (isNowLocked) {
        throw new Error(
          `تم قفل الحساب لمدة ${this.LOCKOUT_MINUTES} دقيقة بسبب تجاوز الحد الأقصى للمحاولات الخاطئة (5 محاولات).`
        );
      }

      const remaining = this.MAX_FAILED_ATTEMPTS - attempts;
      throw new Error(
        `كلمة المرور غير صحيحة. المتبقي لك ${remaining} محاولات قبل إقفال الحساب.`
      );
    }

    // Check if user has a legacy fixed salt that needs transparent upgrade
    const isLegacySalt = (this.LEGACY_SALTS as readonly string[]).includes(user.passwordSalt);
    let finalSalt = user.passwordSalt;
    let finalHash = user.passwordHash;

    if (isLegacySalt) {
      finalSalt = CryptoService.generateSalt();
      finalHash = await CryptoService.hashPassword(password, finalSalt);
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
            },
          });

          if (isLegacySalt) {
            await AuditService.log({
              action: 'UPDATE',
              entity: 'users',
              entityId: user.id,
              userId: user.id,
              userName: user.username,
              after: { reason: 'Cryptographic Salt Upgrade to Random Salt' },
            });
          }
        }
      });
    } catch {
      throw new Error('حدث خطأ في النظام أثناء توثيق الدخول.');
    }

    // If logging in as admin with temporary OTP, clear FirstBootSecret on successful login
    FirstBootSecret.clear();

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
    const isCurrentValid = await CryptoService.verifyPassword(
      currentPlainPassword,
      existingUser.passwordSalt,
      existingUser.passwordHash
    );
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

    // 4. Generate fresh random salt & PBKDF2 hash
    const newSalt = CryptoService.generateSalt();
    const newHash = await CryptoService.hashPassword(newPlainPassword, newSalt);

    const authContext = { userId: existingUser.id, userName: existingUser.username };

    await userRepository.update(
      userId,
      {
        passwordSalt: newSalt,
        passwordHash: newHash,
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
      after: { mustChangePassword: false },
    });
  }

  /**
   * Regenerates temporary one-time password for the initial admin.
   * Allowed ONLY when the admin has never logged in (lastLoginAt is undefined)
   * AND mustChangePassword is true.
   * Otherwise throws an error.
   */
  static async regenerateInitialAdminPassword(): Promise<string> {
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

    // Generate 16-character unambiguous OTP
    const newOtp = CryptoService.generateSecureOtp(16);
    const newSalt = CryptoService.generateSalt();
    const newHash = await CryptoService.hashPassword(newOtp, newSalt);

    const now = new Date().toISOString();
    const updatedAdmin: User = {
      ...admin,
      passwordSalt: newSalt,
      passwordHash: newHash,
      failedLoginAttempts: 0,
      isLocked: false,
      lockedUntil: undefined,
      updatedAt: now,
    };

    await db.users.put(updatedAdmin);

    // Save strictly to memory / sessionStorage
    FirstBootSecret.set(newOtp);

    await AuditService.log({
      action: 'UPDATE',
      entity: 'users',
      entityId: admin.id,
      system: true,
      userName: 'AdminPasswordRecovery',
      after: { reason: 'Initial temporary admin OTP regenerated' },
    });

    return newOtp;
  }
}
