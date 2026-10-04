import { db } from '../../../core/db';
import {
  materialRepository,
  vendorRepository,
  customerRepository,
  plantRepository,
  storageLocationRepository,
  costCenterRepository,
  glAccountRepository,
  materialGroupRepository,
  unitRepository,
  attachmentRepository,
} from '../../../core/repositories';
import { AuditService } from '../../../core/services/AuditService';
import type {
  Material,
  Vendor,
  Customer,
  Plant,
  StorageLocation,
  CostCenter,
  GLAccount,
  MaterialGroup,
  UnitOfMeasure,
  Attachment,
  StockBalance,
  StockLedgerEntry,
  PurchaseOrder,
  VendorInvoice,
  AuditLog,
} from '../../../types/models';
import type { ValidationResult } from '../../../core/utils/importExport';

export class MasterDataService {
  /**
   * Checks if an entity code is unique across active records.
   */
  static async isCodeUnique(
    entity: 'materials' | 'vendors' | 'customers' | 'plants' | 'storageLocations' | 'costCenters' | 'glAccounts' | 'materialGroups' | 'units',
    codeField: string,
    codeValue: string,
    excludeId?: string
  ): Promise<boolean> {
    const trimmed = codeValue.trim();
    if (!trimmed) return true;

    let records: { id: string; isDeleted?: boolean }[] = [];
    switch (entity) {
      case 'materials':
        records = await db.materials.where('materialCode').equalsIgnoreCase(trimmed).toArray();
        break;
      case 'vendors':
        records = await db.vendors.where('vendorCode').equalsIgnoreCase(trimmed).toArray();
        break;
      case 'customers':
        records = await db.customers.where('customerCode').equalsIgnoreCase(trimmed).toArray();
        break;
      case 'plants':
        records = await db.plants.where('code').equalsIgnoreCase(trimmed).toArray();
        break;
      case 'storageLocations':
        records = await db.storageLocations.where('code').equalsIgnoreCase(trimmed).toArray();
        break;
      case 'costCenters':
        records = await db.costCenters.where('code').equalsIgnoreCase(trimmed).toArray();
        break;
      case 'glAccounts':
        records = await db.glAccounts.where('accountNumber').equalsIgnoreCase(trimmed).toArray();
        break;
      case 'materialGroups':
        records = await db.materialGroups.where('code').equalsIgnoreCase(trimmed).toArray();
        break;
      case 'units':
        records = await db.units.where('code').equalsIgnoreCase(trimmed).toArray();
        break;
    }

    const filtered = records.filter((r) => !r.isDeleted && r.id !== excludeId);
    return filtered.length === 0;
  }

  /**
   * SAP Referential Integrity Checker:
   * Prevents hard deletion when references exist in transaction documents or inventory balances.
   * Directs user to deactivation / deletion flag (LOEKZ).
   */
  static async checkReferentialIntegrity(
    entity: 'materials' | 'vendors' | 'customers' | 'plants' | 'storageLocations' | 'costCenters' | 'glAccounts' | 'materialGroups' | 'units',
    id: string,
    code: string
  ): Promise<{ canDelete: boolean; reason?: string }> {
    switch (entity) {
      case 'materials': {
        // Check stock balances
        const balances = await db.stockBalances.where('materialCode').equals(code).toArray();
        const hasStock = balances.some((b) => !b.isDeleted && ((b.unrestrictedQty || 0) > 0 || (b.blockedQty || 0) > 0));
        if (hasStock) {
          return {
            canDelete: false,
            reason: 'لا يمكن حذف الصنف لوجود أرصدة كميات فعلية في المستودعات. يمكنك تعطيله بدلاً من ذلك.',
          };
        }

        // Check purchase orders
        const pos = await db.purchaseOrders.toArray();
        const poReferenced = pos.some((po) => !po.isDeleted && po.items?.some((i) => i.materialCode === code));
        if (poReferenced) {
          return {
            canDelete: false,
            reason: 'لا يمكن حذف الصنف لارتباطه بأوامر شراء سابقة ومستندات تدفق مشتريات (PO). استخدم خيار التعطيل.',
          };
        }

        // Check stock movements
        const movements = await db.stockLedger.where('materialCode').equals(code).count();
        if (movements > 0) {
          return {
            canDelete: false,
            reason: 'لا يمكن حذف الصنف لوجود حركات مستودعية مسجلة في سجل حركة المواد (MIGO).',
          };
        }
        break;
      }

      case 'vendors': {
        const pos = await db.purchaseOrders.where('vendorCode').equals(code).count();
        if (pos > 0) {
          return {
            canDelete: false,
            reason: 'لا يمكن حذف المورد لوجود أوامر شراء مسجلة باسمه في النظام. يمكنك تعطيله لإيقاف التعاملات المستقبلية.',
          };
        }

        const contracts = await db.contracts.where('vendorCode').equals(code).count();
        if (contracts > 0) {
          return {
            canDelete: false,
            reason: 'لا يمكن حذف المورد لوجود عقود إطارية سارية مرتبطة به.',
          };
        }

        const invoices = await db.vendorInvoices.where('vendorCode').equals(code).count();
        if (invoices > 0) {
          return {
            canDelete: false,
            reason: 'لا يمكن حذف المورد لوجود فواتير وذمم دائنة مسجلة في دفتر الأستاذ.',
          };
        }
        break;
      }

      case 'customers': {
        const trips = await db.trips.toArray();
        const tripReferenced = trips.some((t) => !t.isDeleted && (t.destinationPlant === code || t.docNumber.includes(code)));
        if (tripReferenced) {
          return {
            canDelete: false,
            reason: 'لا يمكن حذف العميل لارتباطه برحلات شحن ونقل جارية.',
          };
        }
        break;
      }

      case 'plants': {
        const slocs = await db.storageLocations.where('plantCode').equals(code).count();
        if (slocs > 0) {
          return {
            canDelete: false,
            reason: 'لا يمكن حذف المحطة لأنها تحتوي على مستودعات تخزين فرعية تابعة لها.',
          };
        }
        const balances = await db.stockBalances.where('plantCode').equals(code).count();
        if (balances > 0) {
          return {
            canDelete: false,
            reason: 'لا يمكن حذف المحطة لوجود سجلات مخزون مرتبطة بها.',
          };
        }
        break;
      }

      case 'storageLocations': {
        const balances = await db.stockBalances.where('storageLocation').equals(code).toArray();
        const hasStock = balances.some((b) => !b.isDeleted && ((b.unrestrictedQty || 0) > 0 || (b.blockedQty || 0) > 0));
        if (hasStock) {
          return {
            canDelete: false,
            reason: 'المستودع يحتوي على بضائع وأرصدة مواد نشطة.',
          };
        }
        break;
      }

      case 'costCenters': {
        const prs = await db.purchaseRequisitions.where('costCenter').equals(code).count();
        if (prs > 0) {
          return {
            canDelete: false,
            reason: 'مركز التكلفة مرتبط بطلبات شراء داخلية وموازنات تشغيلية.',
          };
        }
        break;
      }

      case 'glAccounts': {
        const jes = await db.journalEntries.toArray();
        const referenced = jes.some((je) => !je.isDeleted && je.lines?.some((l) => l.accountNumber === code));
        if (referenced) {
          return {
            canDelete: false,
            reason: 'الحساب المالي مسجل عليه قيود وترحيلات في دفتر الأستاذ العام.',
          };
        }
        break;
      }

      case 'materialGroups': {
        const mats = await db.materials.where('groupCode').equals(code).count();
        if (mats > 0) {
          return {
            canDelete: false,
            reason: 'المجموعة تحتوي على أصناف ومواد تابعة لها في سجل المواد.',
          };
        }
        break;
      }

      case 'units': {
        const mats = await db.materials.where('baseUnit').equals(code).count();
        if (mats > 0) {
          return {
            canDelete: false,
            reason: 'الوحدة مستخدمة كوحدة قياس أساسية لعدد من الأصناف المسجلة.',
          };
        }
        break;
      }
    }

    return { canDelete: true };
  }

  /**
   * Toggles active / inactive or sets SAP Deletion Flag (LOEKZ).
   */
  static async toggleStatus(
    entity: 'materials' | 'vendors' | 'customers' | 'plants' | 'storageLocations' | 'costCenters' | 'glAccounts',
    id: string,
    newStatus: 'active' | 'inactive' | 'flagged_for_deletion',
    userId: string,
    userName: string
  ): Promise<void> {
    const repoMap = {
      materials: materialRepository,
      vendors: vendorRepository,
      customers: customerRepository,
      plants: plantRepository,
      storageLocations: storageLocationRepository,
      costCenters: costCenterRepository,
      glAccounts: glAccountRepository,
    };

    const repo = repoMap[entity];
    const before = await repo.getById(id);
    if (!before) throw new Error('السجل المطلوب غير موجود');

    await repo.update(id, { status: newStatus }, userId, userName);

    await AuditService.log({
      userId,
      userName,
      action: 'STATUS_CHANGE',
      entity: entity,
      entityId: id,
      before: { status: before.status },
      after: { status: newStatus },
    });
  }

  /**
   * Fetches full stock summary and movement history for a Material.
   */
  static async getMaterialStockDetails(materialCode: string): Promise<{
    balances: StockBalance[];
    movements: StockLedgerEntry[];
    totalQuantity: number;
    totalValue: number;
  }> {
    const balances = await db.stockBalances.where('materialCode').equals(materialCode).toArray();
    const activeBalances = balances.filter((b) => !b.isDeleted);

    const movements = await db.stockLedger
      .where('materialCode')
      .equals(materialCode)
      .reverse()
      .sortBy('postingDate');
    const activeMovements = movements.filter((m) => !m.isDeleted);

    let totalQuantity = 0;
    let totalValue = 0;
    activeBalances.forEach((b) => {
      const qty = (b.unrestrictedQty || 0) + (b.qualityInspectionQty || 0) + (b.blockedQty || 0);
      totalQuantity += qty;
      totalValue += b.totalValuation || 0;
    });

    return {
      balances: activeBalances,
      movements: activeMovements,
      totalQuantity,
      totalValue,
    };
  }

  /**
   * Fetches POs and Invoices history for a Vendor.
   */
  static async getVendorPurchases(vendorCode: string): Promise<{
    pos: PurchaseOrder[];
    invoices: VendorInvoice[];
    totalAmount: number;
  }> {
    const pos = await db.purchaseOrders.where('vendorCode').equals(vendorCode).toArray();
    const activePOs = pos.filter((p) => !p.isDeleted);

    const invoices = await db.vendorInvoices.where('vendorCode').equals(vendorCode).toArray();
    const activeInvoices = invoices.filter((i) => !i.isDeleted);

    const totalAmount = activePOs.reduce((sum, po) => sum + (po.totalAmount || 0), 0);

    return {
      pos: activePOs,
      invoices: activeInvoices,
      totalAmount,
    };
  }

  /**
   * Computes dynamic vendor ratings based on KPIs (Delivery, Quality, Price).
   */
  static computeVendorRating(vendor: Vendor): {
    delivery: number;
    quality: number;
    price: number;
    overall: number;
  } {
    const delivery = vendor.ratingDelivery ?? (vendor.rating ? Math.min(5, Math.max(1, vendor.rating + 0.2)) : 4.5);
    const quality = vendor.ratingQuality ?? (vendor.rating ? Math.min(5, Math.max(1, vendor.rating - 0.1)) : 4.8);
    const price = vendor.ratingPrice ?? (vendor.rating ?? 4.2);
    // Weighted formula: 40% Delivery + 40% Quality + 20% Price
    const overall = parseFloat(((delivery * 0.4) + (quality * 0.4) + (price * 0.2)).toFixed(1));
    return { delivery, quality, price, overall };
  }

  /**
   * Fetches audit trail history for an entity.
   */
  static async getChangeHistory(entity: string, entityId: string): Promise<AuditLog[]> {
    const logs = await db.auditLogs.where('entity').equals(entity).toArray();
    return logs
      .filter((l) => l.entityId === entityId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Attachments management (100% offline IndexedDB storage).
   */
  static async getAttachments(entityType: string, entityId: string): Promise<Attachment[]> {
    const items = await db.attachments.where('entityId').equals(entityId).toArray();
    return items.filter((a) => !a.isDeleted && a.entityType === entityType);
  }

  static async uploadAttachment(
    attachmentData: Omit<Attachment, 'id' | 'createdAt' | 'isDeleted'>,
    userId: string,
    userName: string
  ): Promise<Attachment> {
    const newRecord: Attachment = {
      ...attachmentData,
      id: `ATT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      isDeleted: false,
    };

    await attachmentRepository.create(newRecord, userId, userName);

    await AuditService.log({
      userId,
      userName,
      action: 'CREATE',
      entity: 'attachments',
      entityId: newRecord.id,
      after: { fileName: newRecord.fileName, entityType: newRecord.entityType, entityId: newRecord.entityId },
    });

    return newRecord;
  }

  static async deleteAttachment(id: string, userId: string, userName: string): Promise<void> {
    const before = await attachmentRepository.getById(id);
    if (!before) return;

    await attachmentRepository.delete(id, userId, userName);

    await AuditService.log({
      userId,
      userName,
      action: 'DELETE',
      entity: 'attachments',
      entityId: id,
      before: { fileName: before.fileName },
    });
  }

  /**
   * CSV / Excel Dry-Run Validation and Bulk Import.
   */
  static async dryRunImport<T extends Record<string, unknown>>(
    entityType: 'materials' | 'vendors' | 'customers' | 'costCenters' | 'glAccounts',
    rawRows: Record<string, string>[],
    columnMapping: Record<string, string>
  ): Promise<ValidationResult<T>> {
    const validRows: T[] = [];
    const invalidRows: ValidationResult<T>['invalidRows'] = [];

    // Preload existing codes to prevent duplicate insertions
    const existingCodes = new Set<string>();
    switch (entityType) {
      case 'materials': {
        const list = await db.materials.toArray();
        list.forEach((m) => !m.isDeleted && existingCodes.add(m.materialCode.toLowerCase().trim()));
        break;
      }
      case 'vendors': {
        const list = await db.vendors.toArray();
        list.forEach((v) => !v.isDeleted && existingCodes.add(v.vendorCode.toLowerCase().trim()));
        break;
      }
      case 'customers': {
        const list = await db.customers.toArray();
        list.forEach((c) => !c.isDeleted && existingCodes.add(c.customerCode.toLowerCase().trim()));
        break;
      }
      case 'costCenters': {
        const list = await db.costCenters.toArray();
        list.forEach((c) => !c.isDeleted && existingCodes.add(c.code.toLowerCase().trim()));
        break;
      }
      case 'glAccounts': {
        const list = await db.glAccounts.toArray();
        list.forEach((g) => !g.isDeleted && existingCodes.add(g.accountNumber.toLowerCase().trim()));
        break;
      }
    }

    const seenInBatch = new Set<string>();

    rawRows.forEach((row, idx) => {
      const rowNumber = idx + 2; // header is row 1
      const errors: string[] = [];

      // Map values
      const mappedRecord: Record<string, unknown> = {};
      for (const [targetField, sourceCol] of Object.entries(columnMapping)) {
        if (sourceCol && row[sourceCol] !== undefined) {
          mappedRecord[targetField] = row[sourceCol].trim();
        }
      }

      // Check key codes
      let codeKey = '';
      if (entityType === 'materials') codeKey = String(mappedRecord['materialCode'] || '');
      else if (entityType === 'vendors') codeKey = String(mappedRecord['vendorCode'] || '');
      else if (entityType === 'customers') codeKey = String(mappedRecord['customerCode'] || '');
      else if (entityType === 'costCenters') codeKey = String(mappedRecord['code'] || '');
      else if (entityType === 'glAccounts') codeKey = String(mappedRecord['accountNumber'] || '');

      if (!codeKey) {
        errors.push('رمز السجل الأساسي مفقود أو فارغ');
      } else {
        const lowerCode = codeKey.toLowerCase();
        if (existingCodes.has(lowerCode)) {
          errors.push(`الرمز [${codeKey}] موجود مسبقاً في قاعدة البيانات`);
        } else if (seenInBatch.has(lowerCode)) {
          errors.push(`تكرار الرمز [${codeKey}] داخل نفس ملف الاستيراد`);
        } else {
          seenInBatch.add(lowerCode);
        }
      }

      // Entity specific checks
      if (entityType === 'materials') {
        if (!mappedRecord['name']) errors.push('اسم الصنف مطلوب');
        if (!mappedRecord['baseUnit']) errors.push('وحدة القياس الأساسية مطلوبة');
        const price = Number(mappedRecord['standardPrice'] || 0);
        if (isNaN(price) || price < 0) errors.push('السعر المعياري يجب أن يكون رقماً موجباً');
      } else if (entityType === 'vendors') {
        if (!mappedRecord['name']) errors.push('اسم المورد مطلوب');
        if (!mappedRecord['commercialRecord']) errors.push('رقم السجل التجاري مطلوب');
      }

      if (errors.length > 0) {
        invalidRows.push({
          rowNumber,
          raw: row,
          errors,
        });
      } else {
        // Set standard defaults
        mappedRecord['id'] = `${entityType}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        mappedRecord['status'] = 'active';
        mappedRecord['isDeleted'] = false;
        validRows.push(mappedRecord as T);
      }
    });

    return {
      totalRows: rawRows.length,
      validRows,
      invalidRows,
      summary: {
        validCount: validRows.length,
        errorCount: invalidRows.length,
      },
    };
  }

  /**
   * Commits validated import rows to Dexie repository with audit log.
   */
  static async commitBulkImport<T extends { id: string }>(
    entityType: 'materials' | 'vendors' | 'customers' | 'costCenters' | 'glAccounts',
    validRows: T[],
    userId: string,
    userName: string
  ): Promise<number> {
    if (validRows.length === 0) return 0;

    switch (entityType) {
      case 'materials':
        await materialRepository.bulkCreate(validRows as unknown as Material[], userId, userName);
        break;
      case 'vendors':
        await vendorRepository.bulkCreate(validRows as unknown as Vendor[], userId, userName);
        break;
      case 'customers':
        await customerRepository.bulkCreate(validRows as unknown as Customer[], userId, userName);
        break;
      case 'costCenters':
        await costCenterRepository.bulkCreate(validRows as unknown as CostCenter[], userId, userName);
        break;
      case 'glAccounts':
        await glAccountRepository.bulkCreate(validRows as unknown as GLAccount[], userId, userName);
        break;
    }

    await AuditService.log({
      userId,
      userName,
      action: 'CREATE',
      entity: entityType,
      entityId: `BATCH-IMPORT-${validRows.length}`,
      after: {
        count: validRows.length,
        message: `استيراد جماعي ناجح لـ ${validRows.length} سجل`,
      },
    });

    return validRows.length;
  }
}
