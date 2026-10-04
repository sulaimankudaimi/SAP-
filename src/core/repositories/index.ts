import { db } from '../db';
import { DexieRepository } from './DexieRepository';
import type { Table } from 'dexie';
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
  AssetValuation,
  DepreciationRun,
  JournalEntry,
  VendorInvoice,
  Payment,
  Budget,
  ApprovalRequest,
  Notification,
  NumberRange,
  Setting,
  Attachment,
  FiscalPeriod,
  AccountDeterminationRule,
  CustomerInvoice,
  CustomerReceipt,
  CostAllocationCycle,
  InternalOrder,
} from '../../types/models';

export * from './IRepository';
export * from './DexieRepository';

function createRepo<T extends { id: string; isDeleted?: boolean }>(
  table: Table<T, string>,
  entityName: string
): DexieRepository<T> {
  return new DexieRepository<T>(table, entityName);
}

export const userRepository = createRepo<User>(db.users, 'users');
export const roleRepository = createRepo<Role>(db.roles, 'roles');
export const permissionRepository = createRepo<Permission>(db.permissions, 'permissions');
export const companyRepository = createRepo<Company>(db.companies, 'companies');
export const plantRepository = createRepo<Plant>(db.plants, 'plants');
export const storageLocationRepository = createRepo<StorageLocation>(db.storageLocations, 'storageLocations');
export const costCenterRepository = createRepo<CostCenter>(db.costCenters, 'costCenters');
export const glAccountRepository = createRepo<GLAccount>(db.glAccounts, 'glAccounts');
export const materialRepository = createRepo<Material>(db.materials, 'materials');
export const materialGroupRepository = createRepo<MaterialGroup>(db.materialGroups, 'materialGroups');
export const unitRepository = createRepo<UnitOfMeasure>(db.units, 'units');
export const vendorRepository = createRepo<Vendor>(db.vendors, 'vendors');
export const customerRepository = createRepo<Customer>(db.customers, 'customers');
export const prRepository = createRepo<PurchaseRequisition>(db.purchaseRequisitions, 'purchaseRequisitions');
export const rfqRepository = createRepo<RFQ>(db.rfqs, 'rfqs');
export const poRepository = createRepo<PurchaseOrder>(db.purchaseOrders, 'purchaseOrders');
export const contractRepository = createRepo<Contract>(db.contracts, 'contracts');
export const grRepository = createRepo<GoodsReceipt>(db.goodsReceipts, 'goodsReceipts');
export const stockLedgerRepository = createRepo<StockLedgerEntry>(db.stockLedger, 'stockLedger');
export const stockBalanceRepository = createRepo<StockBalance>(db.stockBalances, 'stockBalances');
export const physicalInvRepository = createRepo<PhysicalInventoryDoc>(db.physicalInventoryDocs, 'physicalInventoryDocs');
export const vehicleRepository = createRepo<Vehicle>(db.vehicles, 'vehicles');
export const driverRepository = createRepo<Driver>(db.drivers, 'drivers');
export const tripRepository = createRepo<Trip>(db.trips, 'trips');
export const fuelLogRepository = createRepo<FuelLog>(db.fuelLogs, 'fuelLogs');
export const maintenanceRepository = createRepo<MaintenanceOrder>(db.maintenanceOrders, 'maintenanceOrders');
export const assetRepository = createRepo<Asset>(db.assets, 'assets');
export const assetTransferRepository = createRepo<AssetTransfer>(db.assetTransfers, 'assetTransfers');
export const assetValuationRepository = createRepo<AssetValuation>(db.assetValuations, 'assetValuations');
export const depreciationRepository = createRepo<DepreciationRun>(db.depreciationRuns, 'depreciationRuns');
export const journalRepository = createRepo<JournalEntry>(db.journalEntries, 'journalEntries');
export const invoiceRepository = createRepo<VendorInvoice>(db.vendorInvoices, 'vendorInvoices');
export const paymentRepository = createRepo<Payment>(db.payments, 'payments');
export const budgetRepository = createRepo<Budget>(db.budgets, 'budgets');
export const approvalRepository = createRepo<ApprovalRequest>(db.approvalRequests, 'approvalRequests');
export const notificationRepository = createRepo<Notification>(db.notifications, 'notifications');
export const numberRangeRepository = createRepo<NumberRange>(db.numberRanges, 'numberRanges');
export const settingRepository = createRepo<Setting>(db.settings, 'settings');
export const attachmentRepository = createRepo<Attachment>(db.attachments, 'attachments');
export const fiscalPeriodRepository = createRepo<FiscalPeriod>(db.fiscalPeriods, 'fiscalPeriods');
export const accountDeterminationRepository = createRepo<AccountDeterminationRule>(db.accountDeterminations, 'accountDeterminations');
export const customerInvoiceRepository = createRepo<CustomerInvoice>(db.customerInvoices, 'customerInvoices');
export const customerReceiptRepository = createRepo<CustomerReceipt>(db.customerReceipts, 'customerReceipts');
export const costAllocationRepository = createRepo<CostAllocationCycle>(db.costAllocationCycles, 'costAllocationCycles');
export const internalOrderRepository = createRepo<InternalOrder>(db.internalOrders, 'internalOrders');
