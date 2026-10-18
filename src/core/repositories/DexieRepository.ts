import Dexie, { type Table } from 'dexie';
import type { IRepository, RepositoryQuery, ActionContext, UpdateOptions } from './IRepository';
import { VERSIONED_ENTITIES } from './IRepository';
import { AuditService } from '../services/AuditService';
import { ConcurrencyError } from '../errors';
import { DependencyGuard } from '../security/DependencyGuard';
import { db } from '../db';

export class DexieRepository<T extends { id: string; isDeleted?: boolean; [key: string]: unknown }>
  implements IRepository<T>
{
  constructor(
    private table: Table<T, string>,
    private entityName: string
  ) {}

  async getById(id: string): Promise<T | undefined> {
    const item = await this.table.get(id);
    if (!item || item.isDeleted) return undefined;
    return item;
  }

  async list(query?: RepositoryQuery<T>): Promise<T[]> {
    let collection = this.table.toCollection();

    // Soft-delete filter
    if (!query?.includeDeleted) {
      collection = collection.filter((item) => !item.isDeleted);
    }

    // Exact where filters
    if (query?.where) {
      for (const [key, val] of Object.entries(query.where)) {
        if (val !== undefined && val !== null) {
          collection = collection.filter((item) => item[key] === val);
        }
      }
    }

    // Text search
    if (query?.search && query.search.term) {
      const termLower = query.search.term.toLowerCase();
      const fields = query.search.fields;
      collection = collection.filter((item) => {
        return fields.some((field) => {
          const val = item[field as string];
          return val !== undefined && val !== null && String(val).toLowerCase().includes(termLower);
        });
      });
    }

    let results = await collection.toArray();

    // Sorting
    if (query?.orderBy) {
      const field = query.orderBy as string;
      const dir = query.orderDirection === 'desc' ? -1 : 1;
      results.sort((a, b) => {
        const valA = a[field];
        const valB = b[field];
        if (valA === valB) return 0;
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;
        return valA > valB ? dir : -dir;
      });
    }

    // Pagination
    if (query?.page !== undefined && query?.pageSize !== undefined) {
      const start = (query.page - 1) * query.pageSize;
      results = results.slice(start, start + query.pageSize);
    }

    return results;
  }

  async count(query?: RepositoryQuery<T>): Promise<number> {
    if (!query || Object.keys(query).length === 0) {
      return await this.table.filter((item) => !item.isDeleted).count();
    }
    const items = await this.list(query);
    return items.length;
  }

  private resolveContext(contextOrUserId?: ActionContext | string, userName?: string): ActionContext | undefined {
    if (!contextOrUserId) return undefined;
    if (typeof contextOrUserId === 'string') {
      return { userId: contextOrUserId, userName: userName || contextOrUserId };
    }
    return {
      userId: contextOrUserId.userId,
      userName: contextOrUserId.userName,
      ipAddress: contextOrUserId.ipAddress,
      system: contextOrUserId.system,
    };
  }

  async create(entity: T, contextOrUserId?: ActionContext | string, userName?: string): Promise<T> {
    const context = this.resolveContext(contextOrUserId, userName);
    const itemToSave = {
      ...entity,
      version: typeof entity.version === 'number' ? entity.version : 1,
      isDeleted: false,
    };
    await this.table.add(itemToSave);

    await AuditService.log('CREATE', this.entityName, entity.id, null, itemToSave, context);
    return itemToSave;
  }

  async update(
    id: string,
    patch: Partial<T>,
    contextOrUserId?: ActionContext | string | UpdateOptions,
    userNameOrOptions?: string | UpdateOptions,
    explicitOptions?: UpdateOptions
  ): Promise<T> {
    let options: UpdateOptions | undefined;
    let contextCandidate: ActionContext | string | undefined;
    let uName: string | undefined;

    if (
      contextOrUserId &&
      typeof contextOrUserId === 'object' &&
      ('expectedVersion' in contextOrUserId || 'skipVersionCheck' in contextOrUserId)
    ) {
      options = contextOrUserId as UpdateOptions;
    } else {
      contextCandidate = contextOrUserId as ActionContext | string | undefined;
    }

    if (
      userNameOrOptions &&
      typeof userNameOrOptions === 'object' &&
      ('expectedVersion' in userNameOrOptions || 'skipVersionCheck' in userNameOrOptions)
    ) {
      options = userNameOrOptions as UpdateOptions;
    } else if (typeof userNameOrOptions === 'string') {
      uName = userNameOrOptions;
    }

    if (explicitOptions) {
      options = explicitOptions;
    }

    const context = this.resolveContext(contextCandidate, uName);

    const executeUpdate = async (): Promise<T> => {
      const existing = await this.table.get(id);
      if (!existing || existing.isDeleted) {
        throw new Error(`Record with ID ${id} not found in ${this.entityName}`);
      }

      // Enforce optimistic versioning on VERSIONED_ENTITIES
      const isVersioned = (VERSIONED_ENTITIES as readonly string[]).includes(this.entityName);
      if (isVersioned) {
        if (options?.skipVersionCheck === true) {
          if (!options.reason || !options.reason.trim()) {
            throw new Error(
              `خطأ برمجي: تجاوز التحقق من النسخة لكيان [${this.entityName}] يتطلب تقديم سبب التجاوز صراحة { skipVersionCheck: true, reason: string }.`
            );
          }
        } else if (options?.expectedVersion === undefined) {
          throw new Error(
            `خطأ برمجي: الكيان [${this.entityName}] من الكيانات المحمية بإصدار متفائل (VERSIONED_ENTITIES) ويتطلب تمرير expectedVersion صراحة لمنع فقدان البيانات، أو تمرير { skipVersionCheck: true, reason: '...' } للتحديثات الداخلية للنظام.`
          );
        }
      }

      if (options?.expectedVersion !== undefined) {
        const storedVer = typeof existing.version === 'number' ? existing.version : 1;
        if (storedVer !== options.expectedVersion) {
          throw new ConcurrencyError('تم تعديل هذا السجل بواسطة مستخدم آخر. أعد التحميل ثم حاول مجدداً.');
        }
      }

      const currentVer = typeof existing.version === 'number' ? existing.version : 1;
      const nextVersion = currentVer + 1;

      const updated = {
        ...existing,
        ...patch,
        version: nextVersion,
        updatedAt: new Date().toISOString(),
      };

      await this.table.put(updated);

      const action = 'status' in patch && Object.keys(patch).length <= 3 ? 'STATUS_CHANGE' : 'UPDATE';
      const auditPayload = options?.skipVersionCheck
        ? { ...updated, _versionCheckSkippedReason: options.reason }
        : updated;
      await AuditService.log(action, this.entityName, id, existing, auditPayload, context);

      return updated;
    };

    const currentTx = Dexie.currentTransaction || (db as unknown as { _currentTransaction?: { storeNames?: string[] } })._currentTransaction;
    if (currentTx?.storeNames?.includes(this.table.name)) {
      return await executeUpdate();
    }

    return await db.transaction('rw', [this.table, db.auditLogs], async () => {
      return await executeUpdate();
    });
  }

  async delete(id: string, contextOrUserId?: ActionContext | string, userName?: string): Promise<boolean> {
    const context = this.resolveContext(contextOrUserId, userName);

    const executeDelete = async (): Promise<boolean> => {
      const existing = await this.table.get(id);
      if (!existing || existing.isDeleted) {
        return false;
      }

      // Check dependent documents and posted statuses inside transaction
      await DependencyGuard.check(this.entityName, id);

      // Soft delete
      const patched = {
        ...existing,
        isDeleted: true,
        updatedAt: new Date().toISOString(),
      };
      await this.table.put(patched);

      await AuditService.log('DELETE', this.entityName, id, existing, patched, context);
      return true;
    };

    const currentTx = Dexie.currentTransaction || (db as unknown as { _currentTransaction?: { storeNames?: string[] } })._currentTransaction;
    const requiredTables = [this.table, ...DependencyGuard.getTablesForEntity(this.entityName)];

    if (currentTx && requiredTables.every((t) => currentTx.storeNames?.includes(t.name))) {
      return await executeDelete();
    }

    return await db.transaction('rw', requiredTables, async () => {
      return await executeDelete();
    });
  }

  async bulkCreate(entities: T[], contextOrUserId?: ActionContext | string, userName?: string): Promise<void> {
    const context = this.resolveContext(contextOrUserId, userName);
    const items = entities.map((e) => ({
      ...e,
      version: typeof e.version === 'number' ? e.version : 1,
      isDeleted: false,
    }));
    await this.table.bulkAdd(items);

    if (context) {
      await AuditService.log(
        'CREATE',
        this.entityName,
        `bulk-${items.length}`,
        null,
        { count: items.length },
        context
      );
    }
  }
}
