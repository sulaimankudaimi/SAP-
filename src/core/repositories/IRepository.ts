export interface ActionContext {
  userId?: string;
  userName: string;
  ipAddress?: string;
  system?: boolean;
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

export const VERSIONED_ENTITIES = [
  'vehicles',
  'drivers',
  'trips',
  'maintenanceOrders',
  'vendorInvoices',
  'journalEntries',
  'assets',
  'materials',
  'vendors',
  'purchaseOrders',
  'contracts',
  'budgets',
  'costCenters',
] as const;

export type VersionedEntityName = (typeof VERSIONED_ENTITIES)[number];

export interface UpdateOptions {
  expectedVersion?: number;
  skipVersionCheck?: boolean;
  reason?: string;
}

export interface IRepository<T extends { id: string; isDeleted?: boolean }> {
  getById(id: string): Promise<T | undefined>;
  list(query?: RepositoryQuery<T>): Promise<T[]>;
  create(entity: T, context?: ActionContext | string, userName?: string): Promise<T>;
  update(
    id: string,
    patch: Partial<T>,
    context?: ActionContext | string | UpdateOptions,
    userNameOrOptions?: string | UpdateOptions,
    options?: UpdateOptions
  ): Promise<T>;
  delete(id: string, context?: ActionContext | string, userName?: string): Promise<boolean>;
  count(query?: RepositoryQuery<T>): Promise<number>;
  bulkCreate(entities: T[], context?: ActionContext | string, userName?: string): Promise<void>;
}
