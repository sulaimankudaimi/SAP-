import { userRepository, roleRepository } from '../repositories';
import { CryptoService } from './crypto';
import { AuditService } from './AuditService';
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

    const authContext = { userId: user.id, userName: user.username };

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

    // Login successful: reset failed attempts & record LOGIN audit in a single transaction
    const now = new Date().toISOString();
    try {
      await db.transaction('rw', [db.users, db.auditLogs], async () => {
        const freshUser = await db.users.get(user.id);
        if (freshUser) {
          const updatedUser = {
            ...freshUser,
            failedLoginAttempts: 0,
            isLocked: false,
            lockedUntil: undefined,
            lastLoginAt: now,
            updatedAt: now,
          };
          await db.users.put(updatedUser);

          await AuditService.log({
            action: 'LOGIN',
            entity: 'users',
            entityId: user.id,
            userId: user.id,
            userName: user.username,
            after: { lastLoginAt: now },
          });
        }
      });
    } catch {
      throw new Error('حدث خطأ في النظام أثناء توثيق الدخول.');
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
      user: { ...user, lastLoginAt: now },
      role,
      token,
      expiresAt,
    };
  }

  /**
   * Updates user password and resets mustChangePassword flag.
   * Enforces 10+ chars, upper, lower, digit, symbol.
   */
  static async changePassword(
    userId: string,
    newPlainPassword: string
  ): Promise<void> {
    if (!this.validatePasswordPolicy(newPlainPassword)) {
      throw new Error(
        'كلمة المرور يجب أن لا تقل عن 10 خانات، وتحتوي على حرف كبير، حرف صغير، رقم، ورمز خاص واحد على الأقل.'
      );
    }

    const existingUser = await userRepository.getById(userId);
    if (!existingUser) {
      throw new Error('المستخدم غير موجود.');
    }

    const salt = CryptoService.generateSalt();
    const hash = await CryptoService.hashPassword(newPlainPassword, salt);

    await userRepository.update(
      userId,
      {
        passwordSalt: salt,
        passwordHash: hash,
        mustChangePassword: false,
      },
      { userId: existingUser.id, userName: existingUser.username }
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
}
