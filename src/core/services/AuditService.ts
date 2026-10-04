import { db } from '../db';
import type { AuditLog } from '../../types/models';
import type { ActionContext } from '../repositories/IRepository';

export class AuditService {
  /**
   * Logs a repository write event with before/after snapshot diff.
   * Supports both positional args and options object.
   */
  static async log(
    actionOrOptions:
      | 'CREATE'
      | 'UPDATE'
      | 'DELETE'
      | 'STATUS_CHANGE'
      | {
          userId?: string;
          userName?: string;
          action: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE';
          entity: string;
          entityId: string;
          before?: Record<string, unknown> | null;
          after?: Record<string, unknown> | null;
          ipAddress?: string;
          context?: ActionContext;
        },
    entityArg?: string,
    entityIdArg?: string,
    beforeArg?: Record<string, unknown> | null | undefined,
    afterArg?: Record<string, unknown> | null | undefined,
    contextArg?: ActionContext
  ): Promise<void> {
    try {
      let action: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE';
      let entity: string;
      let entityId: string;
      let before: Record<string, unknown> | null | undefined;
      let after: Record<string, unknown> | null | undefined;
      let userId: string;
      let userName: string;
      let ipAddress: string;

      if (typeof actionOrOptions === 'object') {
        action = actionOrOptions.action;
        entity = actionOrOptions.entity;
        entityId = actionOrOptions.entityId;
        before = actionOrOptions.before;
        after = actionOrOptions.after;
        userId = actionOrOptions.userId || actionOrOptions.context?.userId || 'SYS-AUTO';
        userName = actionOrOptions.userName || actionOrOptions.context?.userName || 'النظام الآلي (System)';
        ipAddress = actionOrOptions.ipAddress || actionOrOptions.context?.ipAddress || '127.0.0.1 (Local Desktop)';
      } else {
        action = actionOrOptions;
        entity = entityArg || '';
        entityId = entityIdArg || '';
        before = beforeArg;
        after = afterArg;
        userId = contextArg?.userId || 'SYS-AUTO';
        userName = contextArg?.userName || 'النظام الآلي (System)';
        ipAddress = contextArg?.ipAddress || '127.0.0.1 (Local Desktop)';
      }

      const logEntry: AuditLog = {
        id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        userId,
        userName,
        action,
        entity,
        entityId,
        before: before ? JSON.parse(JSON.stringify(before)) : null,
        after: after ? JSON.parse(JSON.stringify(after)) : null,
        timestamp: new Date().toISOString(),
        ipAddress,
      };

      await db.auditLogs.add(logEntry);
    } catch (err) {
      console.error('Failed to write audit log:', err);
    }
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
