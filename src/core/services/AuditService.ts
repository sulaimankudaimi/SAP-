import { db } from '../db';
import type { AuditLog } from '../../types/models';
import type { ActionContext } from '../repositories/IRepository';
import { SessionContext } from '../security/SessionContext';

export interface AuditLogOptions {
  userId?: string;
  userName?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE';
  entity: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ipAddress?: string;
  context?: ActionContext;
  system?: boolean;
}

export class AuditService {
  /**
   * Logs a repository write event with before/after snapshot diff.
   * Enforces actor authenticity: requires an authenticated actor or explicit system flag.
   */
  static async log(
    actionOrOptions:
      | 'CREATE'
      | 'UPDATE'
      | 'DELETE'
      | 'STATUS_CHANGE'
      | AuditLogOptions,
    entityArg?: string,
    entityIdArg?: string,
    beforeArg?: Record<string, unknown> | null | undefined,
    afterArg?: Record<string, unknown> | null | undefined,
    contextArg?: ActionContext & { system?: boolean }
  ): Promise<void> {
    let action: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE';
    let entity: string;
    let entityId: string;
    let before: Record<string, unknown> | null | undefined;
    let after: Record<string, unknown> | null | undefined;
    let userId: string | undefined;
    let userName: string | undefined;
    let ipAddress: string;
    let isSystem = false;

    if (typeof actionOrOptions === 'object') {
      action = actionOrOptions.action;
      entity = actionOrOptions.entity;
      entityId = actionOrOptions.entityId;
      before = actionOrOptions.before;
      after = actionOrOptions.after;
      userId = actionOrOptions.userId || actionOrOptions.context?.userId;
      userName = actionOrOptions.userName || actionOrOptions.context?.userName;
      ipAddress = actionOrOptions.ipAddress || actionOrOptions.context?.ipAddress || '127.0.0.1 (Local Desktop)';
      isSystem = Boolean(actionOrOptions.system);
    } else {
      action = actionOrOptions;
      entity = entityArg || '';
      entityId = entityIdArg || '';
      before = beforeArg;
      after = afterArg;
      userId = contextArg?.userId;
      userName = contextArg?.userName;
      ipAddress = contextArg?.ipAddress || '127.0.0.1 (Local Desktop)';
      isSystem = Boolean(contextArg?.system);
    }

    // Resolve Actor from SessionContext if no explicit userId provided
    if (!userId) {
      const activeActor = SessionContext.getActor();
      if (activeActor) {
        userId = activeActor.userId;
        userName = userName || activeActor.username;
      } else if (isSystem) {
        userId = 'SYSTEM';
        userName = userName || 'النظام (System)';
      } else {
        throw new Error(
          'Audit security violation: Cannot write audit log without an active authenticated actor or explicit system flag.'
        );
      }
    }

    const logEntry: AuditLog = {
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      userId,
      userName: userName || userId,
      action,
      entity,
      entityId,
      before: before ? JSON.parse(JSON.stringify(before)) : null,
      after: after ? JSON.parse(JSON.stringify(after)) : null,
      timestamp: new Date().toISOString(),
      ipAddress,
    };

    await db.auditLogs.add(logEntry);
  }

  /**
   * AuditLog viewer query API
   */
  static async getLogs(options?: {
    entity?: string;
    entityId?: string;
    userId?: string;
    action?: string;
    limit?: number;
  }): Promise<AuditLog[]> {
    let collection = db.auditLogs.orderBy('timestamp').reverse();

    if (options?.entity) {
      collection = collection.filter((log) => log.entity === options.entity);
    }
    if (options?.entityId) {
      collection = collection.filter((log) => log.entityId === options.entityId);
    }
    if (options?.userId) {
      collection = collection.filter((log) => log.userId === options.userId);
    }
    if (options?.action) {
      collection = collection.filter((log) => log.action === options.action);
    }

    const limit = options?.limit || 100;
    return await collection.limit(limit).toArray();
  }
}
