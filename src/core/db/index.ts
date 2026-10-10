import Dexie, { type Table } from 'dexie';
import type {
  User,
  Role,
  Permission,
  Company,
  Plant,
  StorageLocation,
  CostCenter,
  GLAccount,
  Material,
  MaterialGroup,
  UnitOfMeasure,
  Vendor,
  Customer,
  PurchaseRequisition,
  RFQ,
  PurchaseOrder,
  Contract,
  GoodsReceipt,
  StockLedgerEntry,
  StockBalance,
  PhysicalInventoryDoc,
  Vehicle,
  Driver,
  Trip,
  FuelLog,
  MaintenanceOrder,
  Asset,
  AssetTransfer,
  DepreciationRun,
  JournalEntry,
  VendorInvoice,
  Payment,
  Budget,
  ApprovalRequest,
  Notification,
  AuditLog,
  NumberRange,
  Setting,
  Attachment,
} from '../../types/models';

export class GulfErpDatabase extends Dexie {
  users!: Table<User, string>;
  roles!: Table<Role, string>;
  permissions!: Table<Permission, string>;
  companies!: Table<Company, string>;
  plants!: Table<Plant, string>;
  storageLocations!: Table<StorageLocation, string>;
  costCenters!: Table<CostCenter, string>;
  glAccounts!: Table<GLAccount, string>;
  materials!: Table<Material, string>;
  materialGroups!: Table<MaterialGroup, string>;
  units!: Table<UnitOfMeasure, string>;
  vendors!: Table<Vendor, string>;
  customers!: Table<Customer, string>;
  purchaseRequisitions!: Table<PurchaseRequisition, string>;
  rfqs!: Table<RFQ, string>;
  purchaseOrders!: Table<PurchaseOrder, string>;
  contracts!: Table<Contract, string>;
  goodsReceipts!: Table<GoodsReceipt, string>;
  stockLedger!: Table<StockLedgerEntry, string>;
  stockBalances!: Table<StockBalance, string>;
  physicalInventoryDocs!: Table<PhysicalInventoryDoc, string>;
  vehicles!: Table<Vehicle, string>;
  drivers!: Table<Driver, string>;
  trips!: Table<Trip, string>;
  fuelLogs!: Table<FuelLog, string>;
  maintenanceOrders!: Table<MaintenanceOrder, string>;
  assets!: Table<Asset, string>;
  assetTransfers!: Table<AssetTransfer, string>;
  depreciationRuns!: Table<DepreciationRun, string>;
  journalEntries!: Table<JournalEntry, string>;
  vendorInvoices!: Table<VendorInvoice, string>;
  payments!: Table<Payment, string>;
  budgets!: Table<Budget, string>;
  approvalRequests!: Table<ApprovalRequest, string>;
  notifications!: Table<Notification, string>;
  auditLogs!: Table<AuditLog, string>;
  numberRanges!: Table<NumberRange, string>;
  settings!: Table<Setting, string>;
  attachments!: Table<Attachment, string>;
  materialDocuments!: Table<import('../../types/models').MaterialDocument, string>;
  inventoryAlerts!: Table<import('../../types/models').InventoryAlert, string>;
  auctionRecords!: Table<import('../../types/models').AuctionRecord, string>;
  fuelAnomalyAlerts!: Table<import('../../types/models').FuelAnomalyAlert, string>;
  preventiveSchedules!: Table<import('../../types/models').PreventiveSchedule, string>;
  assetValuations!: Table<import('../../types/models').AssetValuation, string>;
  fiscalPeriods!: Table<import('../../types/models').FiscalPeriod, string>;
  accountDeterminations!: Table<import('../../types/models').AccountDeterminationRule, string>;
  customerInvoices!: Table<import('../../types/models').CustomerInvoice, string>;
  customerReceipts!: Table<import('../../types/models').CustomerReceipt, string>;
  costAllocationCycles!: Table<import('../../types/models').CostAllocationCycle, string>;
  internalOrders!: Table<import('../../types/models').InternalOrder, string>;
  reportSnapshots!: Table<import('../../types/models').ReportSnapshot, string>;
  approvalRules!: Table<import('../../types/models').ApprovalRule, string>;
  printTemplates!: Table<import('../../types/models').PrintTemplate, string>;
  postingRegistry!: Table<import('../../types/models').PostingRegistryEntry, string>;

  constructor() {
    super('gulf_erp');

    // Version 1 schema definition
    this.version(1).stores({
      users: 'id, username, roleCode, companyCode, plantCode, isLocked, isDeleted',
      roles: 'id, code, isDeleted',
      permissions: 'id, code, module, activity',
      companies: 'id, code, isDeleted',
      plants: 'id, code, companyCode, isDeleted',
      storageLocations: 'id, code, plantCode, isDeleted',
      costCenters: 'id, code, companyCode, isDeleted',
      glAccounts: 'id, accountNumber, category, isDeleted',
      materials: 'id, materialCode, groupCode, abcClass, isDeleted',
      materialGroups: 'id, code, isDeleted',
      units: 'id, code, isDeleted',
      vendors: 'id, vendorCode, category, rating, isDeleted',
      customers: 'id, customerCode, isDeleted',
      purchaseRequisitions: 'id, docNumber, status, plantCode, costCenter, createdBy, isDeleted',
      rfqs: 'id, docNumber, status, prNumber, isDeleted',
      purchaseOrders: 'id, docNumber, status, vendorCode, plantCode, orderDate, isDeleted',
      contracts: 'id, docNumber, status, vendorCode, isDeleted',
      goodsReceipts: 'id, docNumber, poNumber, vendorCode, plantCode, postingDate, isDeleted',
      materialDocuments: 'id, docNumber, movementType, plantCode, storageLocation, poNumber, postingDate, isDeleted',
      stockLedger: 'id, materialCode, plantCode, storageLocation, movementType, referenceDocNumber, postingDate, isDeleted',
      stockBalances: 'id, materialCode, plantCode, storageLocation, [materialCode+plantCode+storageLocation], isDeleted',
      physicalInventoryDocs: 'id, docNumber, plantCode, storageLocation, status, isDeleted',
      inventoryAlerts: 'id, materialCode, plantCode, alertType, status, isDeleted',
      auctionRecords: 'id, materialCode, plantCode, status, isDeleted',
      vehicles: 'id, code, plateNumber, status, isDeleted',
      drivers: 'id, code, status, isDeleted',
      trips: 'id, docNumber, status, vehicleId, driverId, originPlant, isDeleted',
      fuelLogs: 'id, vehicleId, driverId, date, isDeleted',
      fuelAnomalyAlerts: 'id, vehicleId, status, isDeleted',
      maintenanceOrders: 'id, docNumber, vehicleId, orderType, status, isDeleted',
      preventiveSchedules: 'id, vehicleId, status, isDeleted',
      assets: 'id, assetNumber, category, plantCode, costCenter, status, isDeleted',
      assetTransfers: 'id, docNumber, assetNumber, fromPlant, toPlant, isDeleted',
      depreciationRuns: 'id, docNumber, fiscalYear, period, postedToGL, isDeleted',
      assetValuations: 'id, docNumber, assetId, assetNumber, inspectionDate, isDeleted',
      journalEntries: 'id, docNumber, companyCode, fiscalYear, period, documentType, postingDate, isParked, isDeleted',
      vendorInvoices: 'id, docNumber, vendorCode, poNumber, paymentStatus, isPaymentBlocked, isDeleted',
      payments: 'id, docNumber, invoiceId, vendorCode, isDeleted',
      budgets: 'id, costCenter, fiscalYear, [costCenter+fiscalYear], isDeleted',
      approvalRequests: 'id, documentType, documentId, documentNumber, status, requesterUserId, isDeleted',
      notifications: 'id, userId, type, isRead, isDeleted',
      auditLogs: 'id, userId, action, entity, entityId, timestamp',
      numberRanges: 'id, docType, fiscalYear, [docType+fiscalYear], isDeleted',
      settings: 'id, key, category, isDeleted',
      attachments: 'id, entityType, entityId, fileName, createdAt, isDeleted',
      fiscalPeriods: 'id, fiscalYear, period, status, [fiscalYear+period]',
      accountDeterminations: 'id, transactionKey',
      customerInvoices: 'id, docNumber, customerCode, paymentStatus, isDeleted',
      customerReceipts: 'id, docNumber, customerCode, invoiceId, isDeleted',
      costAllocationCycles: 'id, docNumber, cycleCode, fiscalYear, period, isDeleted',
      internalOrders: 'id, orderNumber, responsibleCostCenter, status, isDeleted',
      reportSnapshots: 'id, reportId, reportCode, category, createdBy, createdAt',
      approvalRules: 'id, documentType, isDeleted',
      printTemplates: 'id, documentType',
    });

    // Version 2: Index baseUnit on materials for high-speed MasterDataService where/count lookups
    this.version(2).stores({
      materials: 'id, materialCode, groupCode, abcClass, baseUnit, isDeleted',
    });

    // Version 3: Idempotent posting registry with compound unique index
    this.version(3).stores({
      postingRegistry: 'id, &[sourceType+sourceId+event], sourceType, sourceId, event, journalDocNumber, createdAt',
    });
  }
}

export const db = new GulfErpDatabase();
