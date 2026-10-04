import { userRepository, roleRepository } from '../repositories';
import { CryptoService } from './crypto';
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
        // Unlock expired lock
        await userRepository.update(user.id, {
          isLocked: false,
          failedLoginAttempts: 0,
        });
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

      await userRepository.update(user.id, {
        failedLoginAttempts: attempts,
        isLocked: isNowLocked,
        lockedUntil,
      });

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

    // Login successful: reset failed attempts
    const now = new Date().toISOString();
    await userRepository.update(user.id, {
      failedLoginAttempts: 0,
      isLocked: false,
      lastLoginAt: now,
    });

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

    const salt = CryptoService.generateSalt();
    const hash = await CryptoService.hashPassword(newPlainPassword, salt);

    await userRepository.update(userId, {
      passwordSalt: salt,
      passwordHash: hash,
      mustChangePassword: false,
    });
  }
}
