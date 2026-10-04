export interface ActionContext {
  userId: string;
  userName: string;
  ipAddress?: string;
}

export interface RepositoryQuery<T> {
  where?: Partial<Record<keyof T, unknown>>;
  search?: {
    term: string;
    fields: (keyof T)[];
  };
  orderBy?: keyof T;
  orderDirection?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
  includeDeleted?: boolean;
}

export interface IRepository<T extends { id: string; isDeleted?: boolean }> {
  getById(id: string): Promise<T | undefined>;
  list(query?: RepositoryQuery<T>): Promise<T[]>;
  create(entity: T, context?: ActionContext | string, userName?: string): Promise<T>;
  update(id: string, patch: Partial<T>, context?: ActionContext | string, userName?: string): Promise<T>;
  delete(id: string, context?: ActionContext | string, userName?: string): Promise<boolean>;
  count(query?: RepositoryQuery<T>): Promise<number>;
  bulkCreate(entities: T[], context?: ActionContext | string, userName?: string): Promise<void>;
}
