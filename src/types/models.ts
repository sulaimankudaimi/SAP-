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
  | 'ADM' // Administration
  | 'SYS'; // System / Technical Administration

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
  scopeConstraints?: AuthScopeConstraints;
  isDeleted?: boolean;
}

export interface UserSession {
  id: string;
  loginTime: string;
  ipAddress: string;
  device: string;
  isCurrent?: boolean;
}

export interface User {
  [key: string]: unknown;
  id: string;
  username: string;
  fullName: string;
  email: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  roleIds?: string[];
  roles?: { id: string; code: string; name: string }[];
  companyCode: string;
  plantCode: string;
  passwordHash: string;
  passwordSalt: string;
  passwordIterations?: number;
  failedLoginAttempts: number;
  isLocked: boolean;
  lockedUntil?: string;
  mustChangePassword: boolean;
  isActive?: boolean;
  passwordExpiryDate?: string;
  sessions?: UserSession[];
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
export type MovementTypeCode =
  | '101' // Goods Receipt against PO
  | '102' // Reversal of GR
  | '201' // Goods Issue for Cost Center
  | '261' // Goods Issue for Maintenance Order
  | '301' // Plant to Plant Transfer
  | '311' // Storage Location Transfer
  | '501' // Goods Receipt without PO
  | '551' // Scrapping
  | '701' // Physical Inventory Difference (Surplus / Increase)
  | '702'; // Physical Inventory Difference (Deficit / Decrease)

export interface MaterialDocumentItem {
  lineItem: number;
  materialCode: string;
  materialName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalAmount: number;
  storageLocation: string;
  toPlantCode?: string;
  toStorageLocation?: string;
  batchNumber?: string;
  serialNumber?: string;
  qualityInspection?: boolean;
  costCenter?: string;
  orderNumber?: string;
  scrapReason?: string;
}

export interface MaterialDocument extends TransactionDocument {
  movementType: MovementTypeCode;
  postingDate: string;
  documentDate: string;
  plantCode: string;
  storageLocation?: string;
  poNumber?: string;
  deliveryNoteNumber?: string;
  headerText?: string;
  accountingDocNumber?: string;
  items: MaterialDocumentItem[];
  attachmentIds?: string[];
}

export interface GoodsReceiptItem {
  lineItem: number;
  poItemNumber?: number;
  materialCode: string;
  materialName: string;
  quantity: number;
  unit: string;
  storageLocation: string;
  batchNumber?: string;
  serialNumber?: string;
  qualityInspection?: boolean;
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
  movementType: MovementTypeCode | string;
  referenceDocNumber: string;
  quantity: number;
  unit: string;
  amount: number;
  unitPrice?: number;
  movingAveragePriceAfter?: number;
  postingDate: string;
  createdBy: string;
  notes?: string;
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
  movingAveragePrice?: number;
  binLocation?: string;
  lastMovementDate: string;
  isDeleted: boolean;
}

export interface PhysicalInventoryItem {
  lineItem: number;
  materialCode: string;
  materialName: string;
  bookQty: number;
  countedQty: number;
  varianceQty: number;
  unit: string;
  unitPrice: number;
  varianceValue: number;
  counted: boolean;
}

export interface PhysicalInventoryDoc extends TransactionDocument {
  plantCode: string;
  storageLocation: string;
  countDate: string;
  freezeMovements: boolean;
  abcClassFilter?: 'A' | 'B' | 'C' | 'ALL';
  items: PhysicalInventoryItem[];
  totalVarianceValue: number;
  approvedBy?: string;
  approvedAt?: string;
  postedDocNumber?: string;
}

export interface InventoryAlert {
  id: string;
  materialCode: string;
  materialName: string;
  plantCode: string;
  alertType: 'critical' | 'low' | 'reorder' | 'overstock' | 'slow_moving';
  currentStock: number;
  thresholdQty: number;
  suggestedReorderQty: number;
  unit: string;
  createdAt: string;
  status: 'active' | 'acknowledged' | 'converted_to_pr' | 'resolved';
  convertedPrDocNumber?: string;
  isDeleted: boolean;
}

export interface AuctionRecord {
  id: string;
  materialCode: string;
  materialName: string;
  plantCode: string;
  storageLocation: string;
  quantity: number;
  unit: string;
  startingPrice: number;
  reservePrice: number;
  currentBid?: number;
  currency: string;
  condition: 'Fair' | 'Scrap' | 'UsedGood' | 'Obsolete';
  auctionReference: string;
  status: 'draft' | 'published' | 'awarded' | 'cancelled';
  createdAt: string;
  createdBy: string;
  isDeleted: boolean;
}

export interface ScannerDeviceStatus {
  id: string;
  deviceName: string;
  deviceType: 'RFID' | 'HandheldBarcode' | 'FixedGate';
  plantCode: string;
  location: string;
  ipAddress: string;
  batteryLevel: number;
  status: 'online' | 'offline' | 'warning';
  lastSyncAt: string;
}

// Hook interface for Phase 8 Finance Service Posting
export interface IFinancePostingService {
  postInventoryMovement(doc: MaterialDocument): Promise<{ success: boolean; jeDocNumber: string }>;
}

// Fleet & Logistics Models
export type VehicleType = 'Tanker' | 'HeavyTruck' | 'LightTruck' | 'Crane' | 'Trailer';

export interface Vehicle {
  id: string;
  code: string;
  plateNumber: string;
  vin: string;
  type: VehicleType;
  fuelType: 'Diesel' | 'Gasoline95' | 'Gasoline91';
  capacityLiters: number;
  capacityTons?: number;
  makeModel: string;
  year: number;
  currentOdometer: number;
  status: 'available' | 'on_trip' | 'maintenance' | 'out_of_service';
  assignedDriverId?: string;
  assignedDriverName?: string;
  insuranceExpiry: string;
  registrationExpiry: string;
  lastMaintenanceDate?: string;
  nextMaintenanceOdometer?: number;
  isDeleted: boolean;
}

export interface Driver {
  id: string;
  code: string;
  name: string;
  iqamaNumber: string;
  licenseNumber: string;
  licenseClass: 'عمومي ثقيل' | 'نقل مواد خطرة (HazMat)' | 'عمومي متوسط' | 'خصوصي';
  licenseExpiry: string;
  mobile: string;
  safetyRating: number;
  performanceScore: number;
  certifications: string[];
  status: 'available' | 'on_trip' | 'vacation';
  totalTripsCompleted: number;
  totalDistanceKm: number;
  isDeleted: boolean;
}

export interface Trip extends TransactionDocument {
  vehicleId: string;
  vehiclePlate: string;
  driverId: string;
  driverName: string;
  originPlant: string;
  destinationLocation: string;
  cargoType: string;
  cargoVolumeLiters: number;
  scheduledDeparture: string;
  scheduledArrival: string;
  actualDeparture?: string;
  actualArrival?: string;
  startOdometer: number;
  endOdometer?: number;
  distanceKm?: number;
  delayMinutes?: number;
  delayReason?: string;
  fuelLitersConsumed?: number;
  fuelCost?: number;
  driverAllowanceCost?: number;
  totalTripCost?: number;
  postedAccountingDocNumber?: string;
}

export interface FuelLog {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  driverId: string;
  driverName: string;
  date: string;
  fuelType: 'Diesel' | 'Gasoline95' | 'Gasoline91';
  quantityLiters: number;
  costPerLiter: number;
  totalCost: number;
  odometer: number;
  stationName: string;
  calculatedConsumptionPer100Km?: number;
  isAnomaly?: boolean;
  anomalyDeviationPercentage?: number;
  isDeleted: boolean;
}

export interface FuelAnomalyAlert {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  fuelLogId: string;
  date: string;
  liters: number;
  recordedLPer100Km: number;
  averageLPer100Km: number;
  deviationPercentage: number;
  severity: 'warning' | 'critical';
  reasonSummary: string;
  status: 'active' | 'investigated' | 'resolved';
  resolvedNotes?: string;
  isDeleted: boolean;
}

export interface MaintenancePartItem {
  lineItem: number;
  materialCode: string;
  materialName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalCost: number;
  storageLocation: string;
}

export interface MaintenanceOrder extends TransactionDocument {
  vehicleId: string;
  vehiclePlate: string;
  orderType: 'Preventive' | 'Corrective' | 'Inspection';
  description: string;
  faultReported?: string;
  estimatedCost: number;
  actualCost: number;
  partsCost: number;
  laborCost: number;
  laborHours: number;
  startDate: string;
  completionDate?: string;
  downtimeHours: number;
  partsUsed: MaintenancePartItem[];
  materialDocNumber?: string; // Movement 261 material document link
  preventiveScheduleId?: string;
}

export interface PreventiveSchedule {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  serviceName: string;
  intervalKm: number;
  intervalDays: number;
  lastDoneOdometer: number;
  lastDoneDate: string;
  nextDueOdometer: number;
  nextDueDate: string;
  status: 'due' | 'soon' | 'completed';
  isDeleted: boolean;
}

// Fixed Assets Models
export type AssetClass =
  | 'Machinery'
  | 'Vehicles'
  | 'Buildings'
  | 'StorageTanks'
  | 'IT'
  | 'Pipelines'
  | 'AuC'; // Asset under Construction (أصول قيد التنفيذ)

export type AssetStatus =
  | 'UnderConstruction' // قيد الإنشاء
  | 'Active'            // نشط
  | 'InTransfer'         // قيد النقل
  | 'InDepreciation'     // قيد الإهلاك
  | 'Disposed';          // مُكهَّن / مستبعد

export type DepreciationMethod = 'StraightLine' | 'DecliningBalance';

export interface Asset {
  id: string;
  assetNumber: string;               // AA-style: e.g. AA-2026-000001
  name: string;                      // Description
  description?: string;
  category: 'Machinery' | 'Vehicles' | 'Buildings' | 'StorageTanks' | 'IT' | 'Pipelines' | 'AuC';
  serialNumber?: string;
  barcode: string;                   // Code128 barcode string
  plantCode: string;
  costCenter: string;
  location?: string;                 // Storage location or site facility
  custodian: string;                 // Person in custody
  custodianEmployeeId?: string;
  acquisitionDate: string;
  acquisitionCost: number;
  acquisitionSource?: 'PO' | 'GR' | 'Invoice' | 'Manual' | 'AuCSettlement';
  sourceDocNumber?: string;
  usefulLifeMonths: number;
  depreciationMethod: DepreciationMethod;
  decliningBalanceRate?: number;     // e.g. 0.20 for 20%
  salvageValue: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  status: AssetStatus;
  imageUri?: string;                 // SVG or base64 image
  commissioningDate?: string;
  depreciationStartDate?: string;
  disposalDate?: string;
  disposalType?: 'Scrap' | 'Sale';
  disposalProceeds?: number;
  disposalGainLoss?: number;
  disposalReason?: string;
  disposalJeDocNumber?: string;
  capitalizationJeDocNumber?: string;
  isDeleted: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CustodyHandoverLog {
  id: string;
  assetNumber: string;
  date: string;
  fromCustodian: string;
  toCustodian: string;
  fromLocation?: string;
  toLocation?: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
  notes?: string;
}

export interface AssetTransfer extends TransactionDocument {
  assetNumber: string;
  assetId: string;
  assetName: string;
  fromPlant: string;
  toPlant: string;
  fromCostCenter: string;
  toCostCenter: string;
  fromLocation?: string;
  toLocation?: string;
  fromCustodian: string;
  toCustodian: string;
  transferDate: string;
  reason: string;
  acknowledgedByCustodian?: boolean;
  acknowledgedAt?: string;
  approvalRequestId?: string;
  jeDocNumber?: string;
}

export interface DepreciationRunItem {
  assetId: string;
  assetNumber: string;
  assetName: string;
  category: string;
  costCenter: string;
  glAccount: string;
  depreciationAccount: string;
  previousBookValue: number;
  depreciationAmount: number;
  newBookValue: number;
  method: DepreciationMethod;
}

export interface DepreciationRun extends TransactionDocument {
  companyCode: string;
  fiscalYear: string;
  period: number; // 1-12
  runDate: string;
  runType: 'Monthly' | 'Yearly';
  isSimulation: boolean;
  totalDepreciationAmount: number;
  assetCount: number;
  postedToGL: boolean;
  journalEntryDocNumber?: string;
  reversalDocNumber?: string;
  items: DepreciationRunItem[];
}

export interface AssetValuation {
  id: string;
  docNumber: string;                 // INSP-2026-000001
  assetId: string;
  assetNumber: string;
  inspectionDate: string;
  inspectorName: string;
  inspectorId?: string;
  conditionScore: number;            // 1-100
  conditionGrade: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical';
  physicalConditionNotes: string;
  estimatedMarketValue?: number;
  recommendedAction: 'Continue' | 'Maintenance' | 'Overhaul' | 'Disposal';
  attachments?: { name: string; size: string; type: string }[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

// Financial Accounting & Controlling Models (SAP FI/CO)

export type PostingKey =
  | '40' // Debit G/L
  | '50' // Credit G/L
  | '01' // Debit Customer (Invoice)
  | '15' // Credit Customer (Payment/Receipt)
  | '21' // Debit Vendor (Payment/Credit Memo)
  | '31'; // Credit Vendor (Invoice)

export type SAPDocumentType =
  | 'SA' // G/L account document (قيود عامة)
  | 'KR' // Vendor invoice (فاتورة مورد)
  | 'KZ' // Vendor payment (سند صرف مورد)
  | 'KG' // Vendor credit memo (إشعار دائن مورد)
  | 'DR' // Customer invoice (فاتورة عميل)
  | 'DZ' // Customer payment (سند قبض عميل)
  | 'AB' // General document clearing (مقاصة وتسوية)
  | 'WE' // Goods receipt (إذن استلام مخزني)
  | 'RE' // Invoice receipt (استلام فاتورة بضاعة)
  | 'AA'; // Asset posting (قيد أصول)

export interface JournalEntryLine {
  lineNumber: number;
  postingKey?: PostingKey;
  accountNumber: string;
  accountName: string;
  debit: number;
  credit: number;
  costCenter?: string;
  internalOrder?: string;
  lineText?: string;
}

export interface JournalEntry extends TransactionDocument {
  companyCode: string;
  fiscalYear: string;
  period: number;
  postingDate: string;
  documentDate: string;
  documentType: SAPDocumentType;
  headerText: string;
  reference?: string; // Links to PO, GR, Invoice, etc.
  totalDebit: number;
  totalCredit: number;
  lines: JournalEntryLine[];
  isReversed?: boolean;
  reversalDocNumber?: string;
  reversalReason?: string;
  reversedAt?: string;
  isParked?: boolean; // Parked document (FBV1)
  parkedBy?: string;
  attachments?: { name: string; size: string; type: string }[];
}

export interface FiscalPeriod {
  id: string;
  fiscalYear: string;
  period: number; // 1 to 12
  startDate: string;
  endDate: string;
  status: 'Open' | 'Closed';
  closedAt?: string;
  closedBy?: string;
}

export interface AccountDeterminationRule {
  id: string;
  transactionKey:
    | 'GR'       // Goods receipt (Dr Inventory / Cr GR-IR)
    | 'IR'       // Invoice receipt (Dr GR-IR / Cr Vendor Payable)
    | 'GI'       // Goods issue (Dr Consumption / Cr Inventory)
    | 'DEP'      // Depreciation (Dr Dep Expense / Cr Acc Dep)
    | 'FUEL'     // Fleet Fuel (Dr Fuel Exp / Cr Bank/AP)
    | 'MAINT'    // Fleet Maint (Dr Maint Exp / Cr Bank/AP)
    | 'SCRAP'    // Asset Scrap (Dr Loss / Dr AccDep / Cr Asset)
    | 'PAYMENT'  // Vendor Payment (Dr Vendor / Cr Bank)
    | 'AR_INV'   // Customer Invoice (Dr AR / Cr Revenue)
    | 'AR_PAY';  // Customer Receipt (Dr Bank / Cr AR)
  title: string;
  debitAccountNumber: string;
  debitAccountName: string;
  creditAccountNumber: string;
  creditAccountName: string;
  postingKeyDebit: PostingKey;
  postingKeyCredit: PostingKey;
  description: string;
}

export interface VendorInvoiceItem {
  lineItem: number;
  description: string;
  quantity?: number;
  unitPrice?: number;
  amount: number;
  vatRate: number;
  vatAmount: number;
  totalWithVat: number;
  poItemNumber?: number;
}

export type BlockingReason =
  | 'PriceVariance'
  | 'QuantityMismatch'
  | 'MissingGoodsReceipt'
  | 'TermsDiscrepancy';

export interface VendorInvoice extends TransactionDocument {
  vendorCode: string;
  vendorName?: string;
  poNumber?: string;
  grNumber?: string;
  vendorInvoiceNumber: string;
  invoiceDate: string;
  postingDate: string;
  dueDate: string;
  totalAmount: number;
  vatAmount: number;
  netAmount: number;
  paymentStatus: 'Unpaid' | 'PartiallyPaid' | 'Paid';
  paymentTerms?: string; // e.g., 'Net 30', '2/10 Net 30'
  cashDiscountPercentage?: number;
  cashDiscountDays?: number;
  items: VendorInvoiceItem[];
  // 3-way match
  isThreeWayMatched?: boolean;
  isPaymentBlocked?: boolean;
  blockingReasons?: BlockingReason[];
  releasedBy?: string;
  releasedAt?: string;
  releaseReason?: string;
  jeDocNumber?: string; // Linked accounting doc
}

export interface Payment extends TransactionDocument {
  invoiceId: string;
  invoiceDocNumber?: string;
  vendorCode: string;
  vendorName?: string;
  amount: number;
  discountTaken?: number;
  netPaidAmount?: number;
  paymentDate: string;
  bankAccount: string;
  referenceNumber: string;
  paymentMethod?: 'BankTransfer' | 'Check' | 'Electronic';
  jeDocNumber?: string;
}

export interface CustomerInvoiceItem {
  lineItem: number;
  description: string;
  quantity?: number;
  unitPrice?: number;
  amount: number;
  vatRate: number;
  vatAmount: number;
  totalWithVat: number;
}

export interface CustomerInvoice extends TransactionDocument {
  customerCode: string;
  customerName: string;
  invoiceDate: string;
  postingDate: string;
  dueDate: string;
  totalAmount: number;
  vatAmount: number;
  netAmount: number;
  paymentStatus: 'Unpaid' | 'PartiallyPaid' | 'Paid';
  items: CustomerInvoiceItem[];
  jeDocNumber?: string;
}

export interface CustomerReceipt extends TransactionDocument {
  invoiceId: string;
  invoiceDocNumber?: string;
  customerCode: string;
  customerName: string;
  amount: number;
  receiptDate: string;
  bankAccount: string;
  referenceNumber: string;
  paymentMethod?: 'BankTransfer' | 'Check' | 'Cash';
  jeDocNumber?: string;
}

export interface Budget {
  id: string;
  costCenter: string;
  costCenterName?: string;
  accountNumber?: string;
  fiscalYear: string;
  allocatedAmount: number;
  committedAmount: number; // Open POs / PRs
  actualAmount: number;    // Posted expenses
  availableAmount: number; // allocated - committed - actual
  isDeleted: boolean;
}

export interface InternalOrder {
  id: string;
  orderNumber: string;
  description: string;
  orderType: 'Maintenance' | 'Capex' | 'Marketing' | 'Logistics';
  responsibleCostCenter: string;
  responsiblePerson: string;
  budgetAmount: number;
  actualCost: number;
  commitmentAmount: number;
  status: 'Open' | 'Closed' | 'Settled';
  isDeleted: boolean;
}

export interface CostAllocationSegment {
  receiverCostCenter: string;
  receiverCostCenterName?: string;
  percentage: number;
  allocatedAmount: number;
}

export interface CostAllocationCycle extends TransactionDocument {
  cycleCode: string;
  name: string;
  fiscalYear: string;
  period: number;
  senderCostCenter: string;
  senderCostCenterName?: string;
  totalAllocatedAmount: number;
  segments: CostAllocationSegment[];
  jeDocNumber?: string;
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
  documentType: WorkflowDocumentType;
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
  type: 'approval' | 'inventory' | 'finance' | 'procurement' | 'fleet' | 'assets' | 'system' | 'security';
  isRead: boolean;
  link?: string;
  documentType?: string;
  documentId?: string;
  documentNumber?: string;
  createdAt: string;
  isDeleted: boolean;
}

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'STATUS_CHANGE'
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_UNLOCKED'
  | 'PASSWORD_CHANGED';

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  timestamp: string;
  ipAddress?: string;
  prevHash?: string;
  hash?: string;
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
  category: 'general' | 'numbering' | 'security' | 'workflow' | 'system';
  description: string;
  updatedAt: string;
  isDeleted: boolean;
}

// ---------------------------------------------------------------------------
// Analytics, Reporting & BI Models (SAP Standard BI / Analytics Cloud)
// ---------------------------------------------------------------------------

export type ReportCategory = 'procurement' | 'inventory' | 'fleet' | 'assets' | 'finance';

export interface ReportColumn {
  key: string;
  header: string;
  type: 'string' | 'number' | 'currency' | 'date' | 'badge' | 'percentage';
  sortable?: boolean;
  aggregate?: 'sum' | 'avg' | 'count';
  align?: 'start' | 'center' | 'end';
}

export interface ReportFilterDef {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'dateRange' | 'numberRange';
  options?: { label: string; value: string }[];
  defaultValue?: unknown;
}

export interface ReportDefinition {
  id: string;
  code: string;
  title: string;
  description: string;
  category: ReportCategory;
  requiredModule: ModuleCode;
  columns: ReportColumn[];
  filters: ReportFilterDef[];
  defaultSort?: { columnKey: string; direction: 'asc' | 'desc' };
  groupBy?: string;
}

export interface ReportSnapshot {
  id: string;
  reportId: string;
  reportCode: string;
  reportTitle: string;
  category: ReportCategory;
  appliedFilters: Record<string, unknown>;
  dataJson: string; // JSON serialized rows
  rowCount: number;
  totalsJson?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface KPIRawData {
  pos?: PurchaseOrder[];
  grs?: GoodsReceipt[];
  materials?: Material[];
  stockLedger?: StockLedgerEntry[];
  vehicles?: Vehicle[];
  fuelLogs?: FuelLog[];
  maintenanceOrders?: MaintenanceOrder[];
  assets?: Asset[];
  contracts?: Contract[];
  invoices?: VendorInvoice[];
}

export interface KPIResult {
  id: string;
  key: string;
  name: string;
  category: ReportCategory | 'general';
  formula: string;
  description: string;
  unit: string;
  value: number;
  formattedValue: string;
  targetValue: number;
  warningValue: number;
  higherIsBetter: boolean;
  trend: number; // percentage change vs previous period
  status: 'healthy' | 'warning' | 'critical';
  keywords: string[];
  relatedReportId: string;
}

export type ForecastModelType = 'SMA' | 'EXPONENTIAL_SMOOTHING' | 'SEASONAL_DECOMPOSITION';

export interface ForecastPoint {
  period: string; // e.g., '2026-10'
  actual?: number;
  forecast: number;
  lowerBound: number;
  upperBound: number;
  isProjected: boolean;
}

export interface ForecastResult {
  seriesName: string;
  selectedModel: ForecastModelType;
  modelAccuracyMape: number; // e.g. 4.8%
  points: ForecastPoint[];
  suggestedReorderPoint?: number;
  economicOrderQuantity?: number;
  explanationArabic: string;
}

export interface AnomalyItem {
  id: string;
  domain: 'procurement' | 'fleet' | 'inventory';
  entityId: string;
  entityName: string;
  metric: string;
  actualValue: number;
  expectedMean: number;
  standardDev: number;
  zScore: number;
  date: string;
  severity: 'high' | 'medium' | 'low';
  explanationArabic: string;
}

// Workflow Approval Rules Models
export type WorkflowDocumentType = 'PR' | 'PO' | 'CONTRACT' | 'DISPOSAL' | 'PAYMENT';

export interface ApprovalRuleStep {
  stepNumber: number;
  roleCode: string;
  roleName: string;
}

export interface ApprovalRule {
  id: string;
  documentType: WorkflowDocumentType;
  minAmount: number;
  maxAmount: number;
  steps: ApprovalRuleStep[];
  isActive: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

// Print Templates Models
export type PrintDocumentType = 'PO' | 'GR' | 'INVOICE' | 'VOUCHER';

export interface PrintTemplate {
  id: string;
  documentType: PrintDocumentType;
  companyNameArabic: string;
  companyNameEnglish: string;
  taxNumber: string;
  commercialRecord: string;
  headerText: string;
  footerText: string;
  termsAndConditions: string;
  logoBase64?: string;
  showSignatureBlock: boolean;
  showStampBlock: boolean;
  bankDetails?: string;
  updatedAt: string;
}

// Idempotent Posting Registry Model (Dexie v3)
export interface PostingRegistryEntry {
  id: string;
  sourceType: string;
  sourceId: string;
  event: string;
  journalDocNumber: string;
  createdAt: string;
  isReversed?: boolean;
  reversedAt?: string;
  reversalDocNumber?: string;
}

