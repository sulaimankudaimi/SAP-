import type { Role, AuthObject } from '../../types/models';
import { RbacService } from '../services/RbacService';

export interface ActorContext {
  userId: string;
  username: string;
  role: Role;
}

export interface PermissionScope {
  plant?: string;
  costCenter?: string;
  amount?: number;
}

let activeActor: ActorContext | null = null;

export class SessionContext {
  /**
   * Sets the active authenticated actor for the current session.
   */
  static setActor(actor: ActorContext): void {
    activeActor = actor;
  }

  /**
   * Gets the active authenticated actor, or null if unauthenticated.
   */
  static getActor(): ActorContext | null {
    return activeActor;
  }

  /**
   * Clears the current active actor on logout.
   */
  static clearActor(): void {
    activeActor = null;
  }

  /**
   * Service-level guard. Validates the active actor's role against the required AuthObject.
   * Throws if no actor exists or if the actor lacks required permissions or scope.
   */
  static requirePermission(auth: AuthObject, scope?: PermissionScope): void {
    if (!activeActor) {
      throw new Error(
        `خطأ أمني: لم يتم العثور على جلسة مستخدم نشطة لتنفيذ الإجراء [${auth.module}_${auth.activity.toUpperCase()}].`
      );
    }

    RbacService.assertPermission(
      activeActor.role,
      auth,
      scope?.plant,
      scope?.costCenter,
      scope?.amount
    );
  }
}

/**
 * Convenience helper to enforce authorization at the top of service methods.
 */
export function requirePermission(auth: AuthObject, scope?: PermissionScope): void {
  SessionContext.requirePermission(auth, scope);
}
