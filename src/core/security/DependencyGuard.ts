import { db } from '../db';
import { DependencyError } from '../errors';

import type { Table } from 'dexie';

export interface DependencyCheckResult {
  canDelete: boolean;
  reason?: string;
  blockingReferences: string[];
}

export class DependencyGuard {
  /**
   * Returns list of database tables involved in dependency checks for an entity.
   */
  static getTablesForEntity(entityName: string): Table<unknown, string>[] {
    const norm = entityName.toLowerCase();
    switch (norm) {
      case 'purchaseorders':
      case 'purchaseorder':
      case 'po':
        return [db.purchaseOrders, db.goodsReceipts, db.vendorInvoices, db.contracts, db.auditLogs] as unknown as Table<unknown, string>[];
      case 'vendorinvoices':
      case 'vendorinvoice':
      case 'invoice':
      case 'invoices':
        return [db.vendorInvoices, db.payments, db.journalEntries, db.auditLogs] as unknown as Table<unknown, string>[];
      case 'trips':
      case 'trip':
        return [db.trips, db.fuelLogs, db.journalEntries, db.auditLogs] as unknown as Table<unknown, string>[];
      case 'maintenanceorders':
      case 'maintenanceorder':
        return [db.maintenanceOrders, db.materialDocuments, db.journalEntries, db.auditLogs] as unknown as Table<unknown, string>[];
      case 'vehicles':
      case 'vehicle':
        return [db.vehicles, db.trips, db.maintenanceOrders, db.fuelLogs, db.auditLogs] as unknown as Table<unknown, string>[];
      case 'assets':
      case 'asset':
        return [db.assets, db.assetTransfers, db.depreciationRuns, db.journalEntries, db.auditLogs] as unknown as Table<unknown, string>[];
      case 'vendors':
      case 'vendor':
        return [db.vendors, db.purchaseOrders, db.vendorInvoices, db.contracts, db.auditLogs] as unknown as Table<unknown, string>[];
      case 'materials':
      case 'material':
        return [db.materials, db.stockBalances, db.stockLedger, db.materialDocuments, db.purchaseOrders, db.auditLogs] as unknown as Table<unknown, string>[];
      case 'drivers':
      case 'driver':
        return [db.drivers, db.trips, db.vehicles, db.auditLogs] as unknown as Table<unknown, string>[];
      case 'customers':
      case 'customer':
        return [db.customers, db.contracts, db.auditLogs] as unknown as Table<unknown, string>[];
      case 'contracts':
      case 'contract':
        return [db.contracts, db.purchaseOrders, db.auditLogs] as unknown as Table<unknown, string>[];
      case 'costcenters':
      case 'costcenter':
        return [db.costCenters, db.vehicles, db.maintenanceOrders, db.budgets, db.journalEntries, db.auditLogs] as unknown as Table<unknown, string>[];
      case 'journalentries':
      case 'journalentry':
      case 'je':
        return [db.journalEntries, db.postingRegistry, db.auditLogs] as unknown as Table<unknown, string>[];
      default:
        return [db.auditLogs] as unknown as Table<unknown, string>[];
    }
  }
  /**
   * Checks whether an entity can be deleted (only unreferenced drafts are allowed to be deleted).
   * If any dependent records or posted statuses exist, throws DependencyError in Arabic.
   */
  static async check(entityName: string, id: string): Promise<void> {
    const result = await this.evaluate(entityName, id);
    if (!result.canDelete) {
      throw new DependencyError(
        result.reason || 'لا يمكن حذف هذا المستند لوجود ارتباطات تشغيلية أو قيود محاسبية مسجلة عليه.',
        result.blockingReferences
      );
    }
  }

  /**
   * Checks whether a document can be cancelled.
   * If money moved without a reversal path or if downstream dependencies block it, throws DependencyError.
   */
  static async checkCancel(entityName: string, id: string): Promise<void> {
    const norm = entityName.toLowerCase();

    if (norm === 'vendorinvoices' || norm === 'invoice' || norm === 'invoices') {
      const inv = await db.vendorInvoices.get(id);
      if (!inv || inv.isDeleted) return;

      // Check if there are active payments
      const payments = await db.payments.where('invoiceId').equals(id).filter((p) => !p.isDeleted).toArray();
      if (payments.length > 0) {
        throw new DependencyError(
          `لا يمكن إلغاء فاتورة المورد ${inv.docNumber} لوجود سندات صرف ومدفوعات مسجلة ومكتملة عليها (${payments.length} سند صرف). يجب عكس المدفوعات أولاً.`,
          payments.map((p) => `سند صرف: ${p.docNumber}`)
        );
      }
    }
  }

  /**
   * Evaluates dependencies without throwing directly, returning reasons and blocking records.
   */
  static async evaluate(entityName: string, id: string): Promise<DependencyCheckResult> {
    const norm = entityName.toLowerCase();
    const blockingReferences: string[] = [];

    switch (norm) {
      case 'purchaseorders':
      case 'purchaseorder':
      case 'po': {
        const po = await db.purchaseOrders.get(id);
        if (!po || po.isDeleted) return { canDelete: true, blockingReferences: [] };

        // 1. Check Goods Receipts (MIGO) & Material Documents
        const grs = await db.goodsReceipts
          .where('poNumber')
          .equals(po.docNumber)
          .filter((g) => !g.isDeleted)
          .toArray();
        if (grs.length > 0) {
          blockingReferences.push(...grs.map((g) => `سند استلام بضاعة (GR): ${g.docNumber}`));
        }

        const matDocs = await db.materialDocuments
          .where('poNumber')
          .equals(po.docNumber)
          .filter((m) => !m.isDeleted)
          .toArray();
        if (matDocs.length > 0) {
          blockingReferences.push(...matDocs.map((m) => `مستند استلام مواد (MIGO): ${m.docNumber}`));
        }

        // 2. Check Vendor Invoices (MIRO)
        const invoices = await db.vendorInvoices
          .where('poNumber')
          .equals(po.docNumber)
          .filter((inv) => !inv.isDeleted)
          .toArray();
        if (invoices.length > 0) {
          blockingReferences.push(...invoices.map((i) => `فاتورة مورد (IR): ${i.docNumber} (${i.vendorInvoiceNumber})`));
        }

        // 3. Check Contracts
        if (typeof po.contractNumber === 'string' && po.contractNumber.trim().length > 0) {
          const contracts = await db.contracts
            .where('docNumber')
            .equals(po.contractNumber)
            .filter((c) => !c.isDeleted)
            .toArray();
          if (contracts.length > 0) {
            blockingReferences.push(...contracts.map((c) => `عقد إطاري مرتبط: ${c.docNumber}`));
          }
        }

        // 4. Check posted / non-draft status
        if (po.status && po.status !== 'draft') {
          blockingReferences.push(`حالة أمر الشراء معتمدة ومرحلة: ${po.status}`);
        }

        if (blockingReferences.length > 0) {
          return {
            canDelete: false,
            reason: `لا يمكن حذف أمر الشراء [${po.docNumber}] لارتباطه بمستندات لاحقة أو لكونه في حالة معتمدة:\n${blockingReferences.join('، ')}`,
            blockingReferences,
          };
        }
        break;
      }

      case 'vendorinvoices':
      case 'vendorinvoice':
      case 'invoice':
      case 'invoices': {
        const inv = await db.vendorInvoices.get(id);
        if (!inv || inv.isDeleted) return { canDelete: true, blockingReferences: [] };

        // Check payments
        const payments = await db.payments.where('invoiceId').equals(id).filter((p) => !p.isDeleted).toArray();
        if (payments.length > 0) {
          blockingReferences.push(...payments.map((p) => `سند صرف: ${p.docNumber}`));
        }

        // Check journal entry
        if (inv.jeDocNumber) {
          blockingReferences.push(`قيد اليومية العام المرتبط: ${inv.jeDocNumber}`);
        }

        // Check status
        if (inv.paymentStatus === 'Paid' || inv.paymentStatus === 'PartiallyPaid' || inv.status === 'approved' || inv.status === 'posted') {
          blockingReferences.push(`الفاتورة مرحلة في الحسابات العامة (الحالة: ${inv.paymentStatus || inv.status})`);
        }

        if (blockingReferences.length > 0) {
          return {
            canDelete: false,
            reason: `لا يمكن حذف فاتورة المورد [${inv.docNumber}] لارتباطها بحركات مالية أو قيود مسجلة. يمكن إلغاؤها فقط عبر مستند عكسي:\n${blockingReferences.join('، ')}`,
            blockingReferences,
          };
        }
        break;
      }

      case 'trips':
      case 'trip': {
        const trip = await db.trips.get(id);
        if (!trip || trip.isDeleted) return { canDelete: true, blockingReferences: [] };

        // Check if posted to GL
        if (trip.postedAccountingDocNumber) {
          blockingReferences.push(`قيد محاسبي مرحل لتكاليف الرحلة: ${trip.postedAccountingDocNumber}`);
        }

        // Check status
        if (trip.status !== 'draft') {
          blockingReferences.push(`الرحلة مسجلة وبدأت بالفعل (الحالة: ${trip.status})`);
        }

        if (blockingReferences.length > 0) {
          return {
            canDelete: false,
            reason: `لا يمكن حذف رحلة الشحن [${trip.docNumber}] لوجود تكاليف مرحلة أو لكونها جارية/مكتملة:\n${blockingReferences.join('، ')}`,
            blockingReferences,
          };
        }
        break;
      }

      case 'maintenanceorders':
      case 'maintenanceorder': {
        const mo = await db.maintenanceOrders.get(id);
        if (!mo || mo.isDeleted) return { canDelete: true, blockingReferences: [] };

        // Check material documents
        const matDocs = await db.materialDocuments
          .filter((m) => !m.isDeleted && m.items.some((it) => it.orderNumber === mo.docNumber))
          .toArray();
        if (matDocs.length > 0) {
          blockingReferences.push(...matDocs.map((m) => `مستند صرف مواد لقطع الغيار: ${m.docNumber}`));
        }

        // Check status
        if (mo.status !== 'draft') {
          blockingReferences.push(`أمر الصيانة نشط أو مكتمل (الحالة: ${mo.status})`);
        }

        if (blockingReferences.length > 0) {
          return {
            canDelete: false,
            reason: `لا يمكن حذف أمر الصيانة [${mo.docNumber}] لوجود قطع غيار مصروفة أو لكونه قيد التنفيذ/مكتمل:\n${blockingReferences.join('، ')}`,
            blockingReferences,
          };
        }
        break;
      }

      case 'vehicles':
      case 'vehicle': {
        const v = await db.vehicles.get(id);
        if (!v || v.isDeleted) return { canDelete: true, blockingReferences: [] };

        const trips = await db.trips.where('vehicleId').equals(id).filter((t) => !t.isDeleted).count();
        if (trips > 0) {
          blockingReferences.push(`رحلات شحن مرتبطة بالمركبة: ${trips} رحلة`);
        }

        const mos = await db.maintenanceOrders.where('vehicleId').equals(id).filter((m) => !m.isDeleted).count();
        if (mos > 0) {
          blockingReferences.push(`أوامر صيانة مسجلة للشاحنة: ${mos} أمر`);
        }

        const fuelLogs = await db.fuelLogs.where('vehicleId').equals(id).filter((f) => !f.isDeleted).count();
        if (fuelLogs > 0) {
          blockingReferences.push(`سجلات وقود مسجلة للشاحنة: ${fuelLogs} سجل`);
        }

        if (blockingReferences.length > 0) {
          return {
            canDelete: false,
            reason: `لا يمكن حذف المركبة [${v.plateNumber}] لوجود سجلات مرتبطة بها في الأسطول:\n${blockingReferences.join('، ')}`,
            blockingReferences,
          };
        }
        break;
      }

      case 'assets':
      case 'asset': {
        const asset = await db.assets.get(id);
        if (!asset || asset.isDeleted) return { canDelete: true, blockingReferences: [] };

        const transfers = await db.assetTransfers.where('assetId').equals(id).filter((t) => !t.isDeleted).count();
        if (transfers > 0) {
          blockingReferences.push(`طلبات نقل عهدة ومواقع: ${transfers} طلب`);
        }

        const depRuns = await db.depreciationRuns
          .filter((d) => !d.isDeleted && d.items.some((it) => it.assetId === id))
          .count();
        if (depRuns > 0) {
          blockingReferences.push(`دورات إهلاك مسجلة للأصل: ${depRuns} دورة`);
        }

        if (asset.capitalizationJeDocNumber) {
          blockingReferences.push(`قيد رسملة الأصل في دفتر الأستاذ: ${asset.capitalizationJeDocNumber}`);
        }

        if (asset.status !== 'UnderConstruction') {
          blockingReferences.push(`الأصل مفعل ورأسمالي (الحالة: ${asset.status})`);
        }

        if (blockingReferences.length > 0) {
          return {
            canDelete: false,
            reason: `لا يمكن حذف الأصل الثابت [${asset.assetNumber}] لوجود دورات إهلاك أو قيود رأسمالية مسجلة:\n${blockingReferences.join('، ')}`,
            blockingReferences,
          };
        }
        break;
      }

      case 'vendors':
      case 'vendor': {
        const vendor = await db.vendors.get(id);
        if (!vendor || vendor.isDeleted) return { canDelete: true, blockingReferences: [] };

        const pos = await db.purchaseOrders.where('vendorCode').equals(vendor.vendorCode).filter((p) => !p.isDeleted).count();
        if (pos > 0) blockingReferences.push(`أوامر شراء مسجلة للمورد: ${pos}`);

        const invs = await db.vendorInvoices.where('vendorCode').equals(vendor.vendorCode).filter((i) => !i.isDeleted).count();
        if (invs > 0) blockingReferences.push(`فواتير مسجلة للمورد: ${invs}`);

        if (blockingReferences.length > 0) {
          return {
            canDelete: false,
            reason: `لا يمكن حذف المورد [${vendor.vendorCode}] لوجود تعاملات تجارية مسجلة:\n${blockingReferences.join('، ')}`,
            blockingReferences,
          };
        }
        break;
      }

      case 'materials':
      case 'material': {
        const mat = await db.materials.get(id);
        if (!mat || mat.isDeleted) return { canDelete: true, blockingReferences: [] };

        const balances = await db.stockBalances.where('materialCode').equals(mat.materialCode).toArray();
        const hasStock = balances.some((b) => !b.isDeleted && ((b.unrestrictedQty || 0) > 0 || (b.blockedQty || 0) > 0));
        if (hasStock) {
          blockingReferences.push('يوجد رصيد مادي نشط للصنف في المستودعات');
        }

        const movements = await db.stockLedger.where('materialCode').equals(mat.materialCode).count();
        if (movements > 0) {
          blockingReferences.push(`حركات مستودعية مسجلة للصنف: ${movements}`);
        }

        if (blockingReferences.length > 0) {
          return {
            canDelete: false,
            reason: `لا يمكن حذف المادة [${mat.materialCode}] لوجود رصيد أو حركات مستودعية سابقة:\n${blockingReferences.join('، ')}`,
            blockingReferences,
          };
        }
        break;
      }

      case 'drivers':
      case 'driver': {
        const driver = await db.drivers.get(id);
        if (!driver || driver.isDeleted) return { canDelete: true, blockingReferences: [] };

        const trips = await db.trips.where('driverId').equals(id).filter((t) => !t.isDeleted).count();
        if (trips > 0) blockingReferences.push(`رحلات مسجلة للسائق: ${trips} رحلة`);

        const vehicles = await db.vehicles.where('assignedDriverId').equals(id).filter((v) => !v.isDeleted).count();
        if (vehicles > 0) blockingReferences.push(`مركبات معينة للسائق: ${vehicles} مركبة`);

        if (blockingReferences.length > 0) {
          return {
            canDelete: false,
            reason: `لا يمكن حذف السائق [${driver.name}] لوجود رحلات أو مركبات معينة له:\n${blockingReferences.join('، ')}`,
            blockingReferences,
          };
        }
        break;
      }

      case 'customers':
      case 'customer': {
        const customer = await db.customers.get(id);
        if (!customer || customer.isDeleted) return { canDelete: true, blockingReferences: [] };

        const contracts = await db.contracts.where('vendorCode').equals(customer.customerCode).filter((c) => !c.isDeleted).count();
        if (contracts > 0) blockingReferences.push(`عقود تجارية مرتبطة بالعميل: ${contracts}`);

        if (blockingReferences.length > 0) {
          return {
            canDelete: false,
            reason: `لا يمكن حذف العميل [${customer.customerCode}] لوجود تعاملات تجارية:\n${blockingReferences.join('، ')}`,
            blockingReferences,
          };
        }
        break;
      }

      case 'contracts':
      case 'contract': {
        const contract = await db.contracts.get(id);
        if (!contract || contract.isDeleted) return { canDelete: true, blockingReferences: [] };

        const pos = await db.purchaseOrders.where('contractNumber').equals(contract.contractNumber).filter((p) => !p.isDeleted).count();
        if (pos > 0) blockingReferences.push(`أوامر شراء مرتبطة بالعقد: ${pos}`);

        if (blockingReferences.length > 0) {
          return {
            canDelete: false,
            reason: `لا يمكن حذف العقد [${contract.contractNumber}] لوجود أوامر شراء مسجلة:\n${blockingReferences.join('، ')}`,
            blockingReferences,
          };
        }
        break;
      }

      case 'costcenters':
      case 'costcenter': {
        const cc = await db.costCenters.get(id);
        if (!cc || cc.isDeleted) return { canDelete: true, blockingReferences: [] };

        const vehicles = await db.vehicles
          .where('costCenter')
          .equals(cc.code)
          .filter((v) => !v.isDeleted)
          .count();
        if (vehicles > 0) blockingReferences.push(`مركبات مسندة لمركز التكلفة: ${vehicles}`);

        const orders = await db.maintenanceOrders
          .filter((m) => !m.isDeleted && m.costCenter === cc.code)
          .count();
        if (orders > 0) blockingReferences.push(`أوامر صيانة مرتبطة بمركز التكلفة: ${orders}`);

        const budgets = await db.budgets
          .where('costCenter')
          .equals(cc.code)
          .filter((b) => !b.isDeleted)
          .count();
        if (budgets > 0) blockingReferences.push(`موازنات تقديرية معتمدة لمركز التكلفة: ${budgets}`);

        const journals = await db.journalEntries
          .filter((j) => !j.isDeleted && j.lines.some((l) => l.costCenter === cc.code))
          .count();
        if (journals > 0) blockingReferences.push(`قيود محاسبية مسجلة على مركز التكلفة: ${journals}`);

        if (blockingReferences.length > 0) {
          return {
            canDelete: false,
            reason: `لا يمكن حذف مركز التكلفة [${cc.code}] لوجود ارتباطات تشغيلية أو مالية مسجلة:\n${blockingReferences.join('، ')}`,
            blockingReferences,
          };
        }
        break;
      }

      case 'journalentries':
      case 'journalentry':
      case 'je': {
        const je = await db.journalEntries.get(id);
        if (!je || je.isDeleted) return { canDelete: true, blockingReferences: [] };

        if (je.status === 'posted') {
          blockingReferences.push('القيد في حالة مرحل نهائياً (posted) ولا يمكن حذفه إلا عبر قيد عكسي');
        }
        if (je.isReversed) {
          blockingReferences.push(`القيد تم عكسه مسبقاً بموجب القيد [${je.reversalDocNumber || ''}]`);
        }
        if (je.reversalDocNumber) {
          blockingReferences.push(`مرتبط بقيد عكسي رقم: ${je.reversalDocNumber}`);
        }
        const reversedEntries = await db.journalEntries
          .filter((j) => !j.isDeleted && j.reversalDocNumber === je.docNumber)
          .count();
        if (reversedEntries > 0) {
          blockingReferences.push(`هذا القيد يمثل عملية عكس لقيود أخرى سابقة: ${reversedEntries}`);
        }

        if (blockingReferences.length > 0) {
          return {
            canDelete: false,
            reason: `لا يمكن حذف القيد المحاسبي [${je.docNumber}] لارتباطه بدورة الإلغاء والعكس المحاسبي:\n${blockingReferences.join('، ')}`,
            blockingReferences,
          };
        }
        break;
      }

      default:
        return { canDelete: true, blockingReferences: [] };
    }

    return { canDelete: true, blockingReferences: [] };
  }
}
