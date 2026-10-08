import type { Table } from 'dexie';
import type { IRepository, RepositoryQuery, ActionContext } from './IRepository';
import { AuditService } from '../services/AuditService';

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
      isDeleted: false,
    };
    await this.table.add(itemToSave);

    await AuditService.log('CREATE', this.entityName, entity.id, null, itemToSave, context);
    return itemToSave;
  }

  async update(id: string, patch: Partial<T>, contextOrUserId?: ActionContext | string, userName?: string): Promise<T> {
    const context = this.resolveContext(contextOrUserId, userName);
    const existing = await this.table.get(id);
    if (!existing || existing.isDeleted) {
      throw new Error(`Record with ID ${id} not found in ${this.entityName}`);
    }

    const updated = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    await this.table.put(updated);

    const action = 'status' in patch && Object.keys(patch).length <= 3 ? 'STATUS_CHANGE' : 'UPDATE';
    await AuditService.log(action, this.entityName, id, existing, updated, context);

    return updated;
  }

  async delete(id: string, contextOrUserId?: ActionContext | string, userName?: string): Promise<boolean> {
    const context = this.resolveContext(contextOrUserId, userName);
    const existing = await this.table.get(id);
    if (!existing || existing.isDeleted) {
      return false;
    }

    // Soft delete
    const patched = {
      ...existing,
      isDeleted: true,
      updatedAt: new Date().toISOString(),
    };
    await this.table.put(patched);

    await AuditService.log('DELETE', this.entityName, id, existing, patched, context);
    return true;
  }

  async bulkCreate(entities: T[], contextOrUserId?: ActionContext | string, userName?: string): Promise<void> {
    const context = this.resolveContext(contextOrUserId, userName);
    const items = entities.map((e) => ({ ...e, isDeleted: false }));
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
