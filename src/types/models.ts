export type ActivityType =
  | 'view'
  | 'create'
  | 'change'
  | 'delete'
  | 'approve'
  | 'post'
  | 'reverse'
  | 'export';

export type ModuleCode =
  | 'MM' // Material Management / Procurement
  | 'WM' // Warehouse & Inventory
  | 'TM' // Transportation & Fleet
  | 'AM' // Asset Management
  | 'FI' // Financial Accounting
  | 'CO' // Controlling
  | 'MD' // Master Data
  | 'ADM'; // Administration

export interface AuthScopeConstraints {
  plant?: string[];
  costCenter?: string[];
  amountLimit?: number;
}

export interface AuthObject {
  module: ModuleCode;
  activity: ActivityType;
  scope?: AuthScopeConstraints;
}

export interface Permission {
  id: string;
  code: string;
  name: string;
  module: ModuleCode;
  activity: ActivityType;
  description: string;
}

export interface Role {
  id: string;
  code: string;
  name: string;
  description: string;
  permissionCodes: string[];
  isSystem: boolean;
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  companyCode: string;
  plantCode: string;
  passwordHash: string;
  passwordSalt: string;
  failedLoginAttempts: number;
  isLocked: boolean;
  lockedUntil?: string;
  mustChangePassword: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

// Transaction Document base contract required by PROJECT_RULES.md
export interface TransactionDocument {
  [key: string]: unknown;
  id: string;
  docNumber: string;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  version: number;
  isDeleted: boolean;
}

export interface Attachment {
  id: string;
  entityType: 'material' | 'vendor' | 'customer' | 'plant' | 'storageLocation' | 'costCenter' | 'glAccount' | 'document';
  entityId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  dataUrl: string;
  uploadedBy: string;
  createdAt: string;
  isDeleted: boolean;
}

// Master Data Models
export interface Company {
  id: string;
  code: string;
  name: string;
  currency: string;
  country: string;
  taxNumber: string;
  isDeleted: boolean;
}

export interface Plant {
  id: string;
  code: string;
  name: string;
  companyCode: string;
  city: string;
  address?: string;
  manager?: string;
  status?: 'active' | 'inactive' | 'flagged_for_deletion';
  isDeleted: boolean;
}

export interface StorageLocation {
  id: string;
  code: string;
  name: string;
  plantCode: string;
  type: string;
  capacity?: string;
  status?: 'active' | 'inactive' | 'flagged_for_deletion';
  isDeleted: boolean;
}

export interface CostCenter {
  id: string;
  code: string;
  name: string;
  companyCode: string;
  responsiblePerson: string;
  department?: string;
  status?: 'active' | 'inactive' | 'flagged_for_deletion';
  isDeleted: boolean;
}

export interface GLAccount {
  id: string;
  accountNumber: string;
  name: string;
  category: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
  currency: string;
  balance?: number;
  status?: 'active' | 'inactive' | 'flagged_for_deletion';
  isDeleted: boolean;
}

export interface Material {
  id: string;
  materialCode: string;
  name: string;
  description: string;
  groupCode: string;
  baseUnit: string;
  abcClass: 'A' | 'B' | 'C';
  reorderPoint: number;
  safetyStock: number;
  standardPrice: number;
  currency: string;
  valuationMethod?: 'MovingAverage' | 'Standard';
  valuationClass?: string;
  glAccountCode?: string;
  purchasingGroup?: string;
  minOrderQty?: number;
  leadTimeDays?: number;
  weightKg?: number;
  barcode?: string;
  status?: 'active' | 'inactive' | 'flagged_for_deletion';
  isDeleted: boolean;
}

export interface MaterialGroup {
  id: string;
  code: string;
  name: string;
  description?: string;
  status?: 'active' | 'inactive';
  isDeleted: boolean;
}

export interface UnitOfMeasure {
  id: string;
  code: string;
  name: string;
  symbol?: string;
  isDeleted: boolean;
}

export interface Vendor {
  id: string;
  vendorCode: string;
  name: string;
  commercialRecord: string;
  taxNumber: string;
  category: string;
  rating: number; // 1-5
  ratingDelivery?: number;
  ratingQuality?: number;
  ratingPrice?: number;
  paymentTerms: string;
  city: string;
  address?: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  bankName?: string;
  bankIban?: string;
  bankSwift?: string;
  crExpiryDate?: string;
  taxCertExpiryDate?: string;
  isoCertExpiryDate?: string;
  status?: 'active' | 'inactive' | 'flagged_for_deletion';
  isDeleted: boolean;
}

export interface Customer {
  id: string;
  customerCode: string;
  name: string;
  taxNumber: string;
  creditLimit: number;
  city: string;
  address?: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  paymentTerms?: string;
  status?: 'active' | 'inactive' | 'flagged_for_deletion';
  isDeleted: boolean;
}

// Procurement Models
export interface PurchaseRequisitionItem {
  lineItem: number;
  materialCode: string;
  materialName: string;
  quantity: number;
  unit: string;
  estimatedPrice: number;
  totalPrice: number;
  requiredDate: string;
}

export interface PurchaseRequisition extends TransactionDocument {
  title: string;
  department: string;
  costCenter: string;
  plantCode: string;
  totalEstimatedAmount: number;
  currency: string;
  items: PurchaseRequisitionItem[];
}

export interface RFQItem {
  lineItem: number;
  materialCode: string;
  quantity: number;
  unit: string;
}

export interface RFQQuote {
  vendorCode: string;
  vendorName: string;
  quotedUnitPrice: number;
  totalPrice: number;
  deliveryDays: number;
  notes?: string;
}

export interface RFQ extends TransactionDocument {
  prNumber?: string;
  deadlineDate: string;
  items: RFQItem[];
  quotes: RFQQuote[];
}

export interface PurchaseOrderItem {
  lineItem: number;
  materialCode: string;
  materialName: string;
  quantity: number;
  receivedQuantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  storageLocation: string;
}

export interface PurchaseOrder extends TransactionDocument {
  vendorCode: string;
  vendorName: string;
  companyCode: string;
  plantCode: string;
  orderDate: string;
  deliveryDate: string;
  totalAmount: number;
  currency: string;
  paymentTerms: string;
  items: PurchaseOrderItem[];
}

export interface Contract extends TransactionDocument {
  vendorCode: string;
  title: string;
  validFrom: string;
  validTo: string;
  targetValue: number;
  releasedValue: number;
  currency: string;
}

// Inventory & Warehouse Models
export interface GoodsReceiptItem {
  lineItem: number;
  poItemNumber?: number;
  materialCode: string;
  materialName: string;
  quantity: number;
  unit: string;
  storageLocation: string;
}

export interface GoodsReceipt extends TransactionDocument {
  poNumber: string;
  vendorCode: string;
  deliveryNoteNumber: string;
  postingDate: string;
  plantCode: string;
  movementType: '101' | '102' | '201' | '311' | '501';
  items: GoodsReceiptItem[];
}

export interface StockLedgerEntry {
  id: string;
  materialCode: string;
  plantCode: string;
  storageLocation: string;
  movementType: string;
  referenceDocNumber: string;
  quantity: number;
  unit: string;
  amount: number;
  postingDate: string;
  createdBy: string;
  isDeleted: boolean;
}

export interface StockBalance {
  id: string;
  materialCode: string;
  plantCode: string;
  storageLocation: string;
  unrestrictedQty: number;
  qualityInspectionQty: number;
  blockedQty: number;
  unit: string;
  totalValuation: number;
  lastMovementDate: string;
  isDeleted: boolean;
}

export interface PhysicalInventoryItem {
  materialCode: string;
  bookQty: number;
  countedQty: number;
  varianceQty: number;
  unit: string;
}

export interface PhysicalInventoryDoc extends TransactionDocument {
  plantCode: string;
  storageLocation: string;
  countDate: string;
  items: PhysicalInventoryItem[];
}

// Fleet & Logistics Models
export interface Vehicle {
  id: string;
  plateNumber: string;
  code: string;
  type: 'Tanker' | 'HeavyTruck' | 'Trailer' | 'LightTruck';
  capacityLiters: number;
  makeModel: string;
  year: number;
  currentOdometer: number;
  status: 'available' | 'on_trip' | 'maintenance' | 'out_of_service';
  assignedDriverId?: string;
  isDeleted: boolean;
}

export interface Driver {
  id: string;
  code: string;
  name: string;
  iqamaNumber: string;
  licenseNumber: string;
  licenseExpiry: string;
  mobile: string;
  safetyRating: number;
  status: 'available' | 'on_trip' | 'vacation';
  isDeleted: boolean;
}

export interface Trip extends TransactionDocument {
  vehicleId: string;
  driverId: string;
  originPlant: string;
  destinationLocation: string;
  cargoType: string;
  cargoVolumeLiters: number;
  scheduledDeparture: string;
  actualDeparture?: string;
  actualArrival?: string;
  startOdometer: number;
  endOdometer?: number;
}

export interface FuelLog {
  id: string;
  vehicleId: string;
  driverId: string;
  date: string;
  fuelType: 'Diesel' | 'Gasoline95' | 'Gasoline91';
  quantityLiters: number;
  costPerLiter: number;
  totalCost: number;
  odometer: number;
  stationName: string;
  isDeleted: boolean;
}

export interface MaintenanceOrder extends TransactionDocument {
  vehicleId: string;
  orderType: 'Preventive' | 'Corrective' | 'Inspection';
  description: string;
  estimatedCost: number;
  actualCost: number;
  startDate: string;
  completionDate?: string;
}

// Fixed Assets Models
export interface Asset {
  id: string;
  assetNumber: string;
  name: string;
  category: 'Machinery' | 'Vehicles' | 'Buildings' | 'StorageTanks' | 'IT';
  acquisitionDate: string;
  acquisitionCost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  plantCode: string;
  costCenter: string;
  status: 'Active' | 'UnderMaintenance' | 'Disposed';
  isDeleted: boolean;
}

export interface AssetTransfer extends TransactionDocument {
  assetNumber: string;
  fromPlant: string;
  toPlant: string;
  fromCostCenter: string;
  toCostCenter: string;
  transferDate: string;
}

export interface DepreciationRun extends TransactionDocument {
  fiscalYear: string;
  period: number; // 1-12
  totalDepreciationAmount: number;
  postedToGL: boolean;
  journalEntryDocNumber?: string;
}

// Financial Accounting Models
export interface JournalEntryLine {
  lineNumber: number;
  accountNumber: string;
  accountName: string;
  debit: number;
  credit: number;
  costCenter?: string;
  lineText?: string;
}

export interface JournalEntry extends TransactionDocument {
  companyCode: string;
  fiscalYear: string;
  period: number;
  postingDate: string;
  documentDate: string;
  documentType: 'SA' | 'KR' | 'KG' | 'DZ' | 'AB'; // SAP Standard Document Types
  headerText: string;
  totalDebit: number;
  totalCredit: number;
  lines: JournalEntryLine[];
}

export interface VendorInvoiceItem {
  lineItem: number;
  description: string;
  amount: number;
  vatRate: number;
  vatAmount: number;
  totalWithVat: number;
}

export interface VendorInvoice extends TransactionDocument {
  vendorCode: string;
  poNumber?: string;
  vendorInvoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  vatAmount: number;
  netAmount: number;
  paymentStatus: 'Unpaid' | 'PartiallyPaid' | 'Paid';
  items: VendorInvoiceItem[];
}

export interface Payment extends TransactionDocument {
  invoiceId: string;
  vendorCode: string;
  amount: number;
  paymentDate: string;
  bankAccount: string;
  referenceNumber: string;
}

export interface Budget {
  id: string;
  costCenter: string;
  fiscalYear: string;
  allocatedAmount: number;
  committedAmount: number;
  actualAmount: number;
  availableAmount: number;
  isDeleted: boolean;
}

// Workflow & System Models
export interface ApprovalStep {
  stepNumber: number;
  roleCode: string;
  roleName: string;
  approverUserId?: string;
  approverUserName?: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  actionDate?: string;
  comment?: string;
}

export interface ApprovalRequest {
  [key: string]: unknown;
  id: string;
  documentType: 'PR' | 'PO' | 'CONTRACT' | 'DISPOSAL';
  documentId: string;
  documentNumber: string;
  amount: number;
  currency: string;
  requesterUserId: string;
  requesterUserName: string;
  currentStep: number;
  status: 'pending' | 'approved' | 'rejected';
  steps: ApprovalStep[];
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'approval' | 'inventory' | 'finance' | 'system';
  isRead: boolean;
  link?: string;
  createdAt: string;
  isDeleted: boolean;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE';
  entity: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  timestamp: string;
  ipAddress?: string;
}

export interface NumberRange {
  id: string;
  docType: string;
  fiscalYear: string;
  prefix: string;
  currentNumber: number;
  fromNumber: number;
  toNumber: number;
  updatedAt: string;
  isDeleted: boolean;
}

export interface Setting {
  id: string;
  key: string;
  value: string;
  category: 'general' | 'numbering' | 'security' | 'workflow';
  description: string;
  updatedAt: string;
  isDeleted: boolean;
}
