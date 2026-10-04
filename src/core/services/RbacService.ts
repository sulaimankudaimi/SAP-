import type { Role, AuthObject, ModuleCode, ActivityType } from '../../types/models';

export const SYSTEM_ROLES = {
  ADMIN: 'ADMIN',
  PROCUREMENT_MANAGER: 'PROCUREMENT_MANAGER',
  PROCUREMENT_OFFICER: 'PROCUREMENT_OFFICER',
  WAREHOUSE_CLERK: 'WAREHOUSE_CLERK',
  FLEET_MANAGER: 'FLEET_MANAGER',
  ACCOUNTANT: 'ACCOUNTANT',
  FINANCE_MANAGER: 'FINANCE_MANAGER',
  AUDITOR: 'AUDITOR',
  ASSET_MANAGER: 'ASSET_MANAGER',
  VIEWER: 'VIEWER',
} as const;

export class RbacService {
  /**
   * Generates standard permission code from module and activity.
   * e.g., MM_CREATE, FI_POST, WM_APPROVE
   */
  static getPermissionCode(module: ModuleCode, activity: ActivityType): string {
    return `${module}_${activity.toUpperCase()}`;
  }

  /**
   * Evaluates if a role possesses the required Authorization Object and scope constraints.
   */
  static hasPermission(
    role: Role | undefined | null,
    required: AuthObject,
    contextPlant?: string,
    contextCostCenter?: string,
    contextAmount?: number
  ): boolean {
    if (!role) return false;

    // Admin has superuser access to everything
    if (role.code === SYSTEM_ROLES.ADMIN) return true;

    // Check module + activity permission code
    const requiredCode = this.getPermissionCode(required.module, required.activity);
    const hasCode =
      role.permissionCodes.includes(requiredCode) ||
      role.permissionCodes.includes(`${required.module}_*`) ||
      role.permissionCodes.includes('*');

    if (!hasCode) return false;

    // Evaluate Scope Constraints if specified
    if (required.scope) {
      if (
        required.scope.plant &&
        contextPlant &&
        !required.scope.plant.includes(contextPlant)
      ) {
        return false;
      }

      if (
        required.scope.costCenter &&
        contextCostCenter &&
        !required.scope.costCenter.includes(contextCostCenter)
      ) {
        return false;
      }

      if (
        required.scope.amountLimit !== undefined &&
        contextAmount !== undefined &&
        contextAmount > required.scope.amountLimit
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Service-level guard. Throws an authorization exception if permission check fails.
   */
  static assertPermission(
    role: Role | undefined | null,
    required: AuthObject,
    contextPlant?: string,
    contextCostCenter?: string,
    contextAmount?: number
  ): void {
    const isAllowed = this.hasPermission(
      role,
      required,
      contextPlant,
      contextCostCenter,
      contextAmount
    );

    if (!isAllowed) {
      const code = this.getPermissionCode(required.module, required.activity);
      throw new Error(
        `خطأ صلاحيات: الدور [${role?.name || 'غير معروف'}] يفتقر إلى صلاحية [${code}] المطلوبة لتنفيذ هذا الإجراء.`
      );
    }
  }
}
