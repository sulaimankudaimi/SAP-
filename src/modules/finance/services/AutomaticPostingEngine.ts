import Dexie, { type Table } from 'dexie';
import { db } from '../../../core/db';
import { FinanceService } from './FinanceService';
import { NumberRangeService } from '../../../core/services/NumberRangeService';
import { AuditService } from '../../../core/services/AuditService';
import { requirePermission } from '../../../core/security/SessionContext';
import type {
  AccountDeterminationRule,
  JournalEntry,
  VendorInvoice,
  Payment,
  CustomerInvoice,
  CustomerReceipt,
} from '../../../types/models';

export class AutomaticPostingEngine {
  /**
   * Initializes default OBYC-style Account Determination rules if not seeded.
   */
  static async initAccountDeterminations(): Promise<void> {
    const count = await db.accountDeterminations.count();
    if (count > 0) return;

    const defaultRules: AccountDeterminationRule[] = [
      {
        id: 'ad-gr',
        transactionKey: 'GR',
        title: 'استلام البضائع والمواد ضد أمر الشراء (MIGO - 101)',
        debitAccountNumber: '120010',
        debitAccountName: 'مخزون وقود الديزل والمواد البترولية',
        creditAccountNumber: '201020',
        creditAccountName: 'حساب وسيط البضاعة الواردة والفواتير غير المستلمة (GR/IR)',
        postingKeyDebit: '40',
        postingKeyCredit: '50',
        description: 'ترحيل استلام بضائع: مدين المخزون / دائن وسيط GR/IR',
      },
      {
        id: 'ad-ir',
        transactionKey: 'IR',
        title: 'استلام واعتماد فاتورة المورد (MIRO)',
        debitAccountNumber: '201020',
        debitAccountName: 'حساب وسيط البضاعة الواردة والفواتير غير المستلمة (GR/IR)',
        creditAccountNumber: '201010',
        creditAccountName: 'الذمم الدائنة التجارية (موردي الوقود والمعدات)',
        postingKeyDebit: '40',
        postingKeyCredit: '31',
        description: 'ترحيل فاتورة مورد: مدين وسيط GR/IR / دائن ذمم الموردين',
      },
      {
        id: 'ad-gi',
        transactionKey: 'GI',
        title: 'صرف مخزون لمركز تكلفة تشغيلي (MIGO - 201)',
        debitAccountNumber: '501010',
        debitAccountName: 'تكلفة مشتريات واستهلاك الوقود والمواد',
        creditAccountNumber: '120010',
        creditAccountName: 'مخزون وقود الديزل والمواد البترولية',
        postingKeyDebit: '40',
        postingKeyCredit: '50',
        description: 'صرف مخزون: مدين مصروف استهلاك لمركز تكلفة / دائن المخزون',
      },
      {
        id: 'ad-payment',
        transactionKey: 'PAYMENT',
        title: 'سند صرف ودفع مستحقات المورد (F-53 / F110)',
        debitAccountNumber: '201010',
        debitAccountName: 'الذمم الدائنة التجارية (موردي الوقود والمعدات)',
        creditAccountNumber: '101010',
        creditAccountName: 'النقدية بالبنوك المحلية (الراجحي / الأهلي)',
        postingKeyDebit: '21',
        postingKeyCredit: '50',
        description: 'سداد مورد: مدين ذمم الموردين / دائن النقدية بالبنك',
      },
      {
        id: 'ad-dep',
        transactionKey: 'DEP',
        title: 'تشغيل دورة الإهلاك الدوري للأصول (AFAB)',
        debitAccountNumber: '701010',
        debitAccountName: 'استهلاك صهاريج وشاحنات ومعدات الطاقة',
        creditAccountNumber: '150090',
        creditAccountName: 'مجمع استهلاك الأصول الثابتة',
        postingKeyDebit: '40',
        postingKeyCredit: '50',
        description: 'إهلاك دوري: مدين مصروف الإهلاك / دائن مجمع الإهلاك',
      },
      {
        id: 'ad-fuel',
        transactionKey: 'FUEL',
        title: 'تكاليف وقود أسطول النقل والشاحنات',
        debitAccountNumber: '603010',
        debitAccountName: 'وقود تشغيل الشاحنات ومعدات النقل',
        creditAccountNumber: '101010',
        creditAccountName: 'النقدية بالبنوك المحلية (الراجحي / الأهلي)',
        postingKeyDebit: '40',
        postingKeyCredit: '50',
        description: 'تموين وقود: مدين مصروف وقود مركز التكلفة / دائن البنك أو العهدة',
      },
      {
        id: 'ad-maint',
        transactionKey: 'MAINT',
        title: 'تكاليف أوامر صيانة المركبات والمضخات',
        debitAccountNumber: '602010',
        debitAccountName: 'مصروفات صيانة وإصلاح أسطول الصهاريج والمحطات',
        creditAccountNumber: '201010',
        creditAccountName: 'الذمم الدائنة التجارية (موردي الوقود والمعدات)',
        postingKeyDebit: '40',
        postingKeyCredit: '50',
        description: 'أمر صيانة: مدين مصروف الصيانة / دائن المورد أو البنك',
      },
      {
        id: 'ad-scrap',
        transactionKey: 'SCRAP',
        title: 'تخريد واستبعاد الأصول الرأسمالية (ABAVN)',
        debitAccountNumber: '502010',
        debitAccountName: 'خسائر استبعاد وتخريد الأصول الثابتة',
        creditAccountNumber: '150010',
        creditAccountName: 'أصول ثابتة - خزانات ومحطات الضخ',
        postingKeyDebit: '40',
        postingKeyCredit: '50',
        description: 'تخريد أصل: مدين خسائر استبعاد ومجمع الإهلاك / دائن تكلفة الأصل',
      },
      {
        id: 'ad-ar-inv',
        transactionKey: 'AR_INV',
        title: 'إصدار فاتورة مبيعات عميل (FB70)',
        debitAccountNumber: '110010',
        debitAccountName: 'الذمم المدينة التجارية (عملاء الطاقة)',
        creditAccountNumber: '401010',
        creditAccountName: 'إيرادات مبيعات وقود الديزل الصناعي',
        postingKeyDebit: '01',
        postingKeyCredit: '50',
        description: 'فاتورة عميل: مدين ذمم العملاء / دائن إيرادات المبيعات',
      },
      {
        id: 'ad-ar-pay',
        transactionKey: 'AR_PAY',
        title: 'تحصيل سند قبض من عميل (F-28)',
        debitAccountNumber: '101010',
        debitAccountName: 'النقدية بالبنوك المحلية (الراجحي / الأهلي)',
        creditAccountNumber: '110010',
        creditAccountName: 'الذمم المدينة التجارية (عملاء الطاقة)',
        postingKeyDebit: '40',
        postingKeyCredit: '15',
        description: 'قبض من عميل: مدين البنك / دائن ذمم العملاء',
      },
    ];

    await db.transaction('rw', db.accountDeterminations, async () => {
      for (const r of defaultRules) {
        await db.accountDeterminations.add(r);
      }
    });
  }

  /**
   * Retrieves an account determination rule by key, with safe fallback.
   */
  static async getRule(key: AccountDeterminationRule['transactionKey']): Promise<AccountDeterminationRule> {
    const rule = await db.accountDeterminations.where('transactionKey').equals(key).first();
    if (rule) return rule;

    await this.initAccountDeterminations();
    const fallback = await db.accountDeterminations.where('transactionKey').equals(key).first();
    if (!fallback) {
      throw new Error(`لم يتم العثور على قاعدة توجيه محاسبي للمفتاح: ${key}`);
    }
    return fallback;
  }

  /**
   * Helper to execute idempotent posting with stable registration.
   * If already posted, returns existing journalDocNumber.
   */
  static async executeIdempotentPosting(options: {
    sourceType: string;
    sourceId: string;
    event?: string;
    createEntry: () => Promise<JournalEntry>;
    additionalTxTables?: Table<unknown, string>[];
    onPersist?: (je: JournalEntry) => Promise<void>;
  }): Promise<{ success: boolean; jeDocNumber: string; isDuplicate?: boolean }> {
    const event = options.event || 'POST';

    // 1. Fast path check outside transaction
    const existing = await db.postingRegistry
      .where('[sourceType+sourceId+event]')
      .equals([options.sourceType, options.sourceId, event])
      .first();

    if (existing) {
      return { success: true, jeDocNumber: existing.journalDocNumber, isDuplicate: true };
    }

    const txTables = [
      db.journalEntries,
      db.postingRegistry,
      db.numberRanges,
      db.auditLogs,
      ...(options.additionalTxTables || []),
    ];

    let resultJeDocNumber = '';
    let duplicateDetected = false;

    const executeOperation = async () => {
      // 2. Double-check inside transaction for race conditions
      const innerExisting = await db.postingRegistry
        .where('[sourceType+sourceId+event]')
        .equals([options.sourceType, options.sourceId, event])
        .first();

      if (innerExisting) {
        resultJeDocNumber = innerExisting.journalDocNumber;
        duplicateDetected = true;
        return;
      }

      // 3. Perform entry creation INSIDE transaction so number range increment is rolled back on error
      const journalEntry = await options.createEntry();
      const now = new Date().toISOString();

      const regEntry: import('../../../types/models').PostingRegistryEntry = {
        id: `reg-${options.sourceType}-${options.sourceId}-${event}-${Date.now()}`,
        sourceType: options.sourceType,
        sourceId: options.sourceId,
        event,
        journalDocNumber: journalEntry.docNumber,
        createdAt: now,
      };

      await db.journalEntries.add(journalEntry);
      await db.postingRegistry.add(regEntry);

      if (options.onPersist) {
        await options.onPersist(journalEntry);
      }

      await AuditService.log({
        userId: journalEntry.createdBy,
        action: 'CREATE',
        entity: 'JournalEntry',
        entityId: journalEntry.id,
        after: journalEntry as unknown as Record<string, unknown>,
      });

      resultJeDocNumber = journalEntry.docNumber;
    };

    // If an ambient transaction is active that already includes our tables, join it directly!
    const currentTx = Dexie.currentTransaction || (db as unknown as { _currentTransaction?: { storeNames?: string[] } })._currentTransaction;
    const requiredTableNames = ['journalEntries', 'postingRegistry', 'numberRanges', 'auditLogs', ...(options.additionalTxTables || []).map((t) => (t as { name: string }).name)];
    const ambientStores = currentTx?.storeNames || [];
    const isAmbientCovering = Boolean(currentTx && requiredTableNames.every((name) => ambientStores.includes(name)));

    if (isAmbientCovering) {
      await executeOperation();
      return { success: true, jeDocNumber: resultJeDocNumber, isDuplicate: duplicateDetected };
    }

    try {
      await db.transaction('rw', txTables, executeOperation);
      return { success: true, jeDocNumber: resultJeDocNumber, isDuplicate: duplicateDetected };
    } catch (err: unknown) {
      // In case of concurrent race condition catching ConstraintError
      const isConstraintErr = err && typeof err === 'object' && (err as { name?: string }).name === 'ConstraintError';
      if (isConstraintErr) {
        const raceExisting = await db.postingRegistry
          .where('[sourceType+sourceId+event]')
          .equals([options.sourceType, options.sourceId, event])
          .first();
        if (raceExisting) {
          return { success: true, jeDocNumber: raceExisting.journalDocNumber, isDuplicate: true };
        }
      }
      throw err;
    }
  }

  /**
   * Reverses a registered posting exactly once.
   */
  static async reversePosting(options: {
    sourceType: string;
    sourceId: string;
    event?: string;
    reason: string;
    userId: string;
  }): Promise<{ success: boolean; reversalDocNumber: string }> {
    const event = options.event || 'POST';
    const regEntry = await db.postingRegistry
      .where('[sourceType+sourceId+event]')
      .equals([options.sourceType, options.sourceId, event])
      .first();

    if (!regEntry) {
      throw new Error(`لا يوجد قيد محاسبي مسجل للعملية (${options.sourceType} - ${options.sourceId}).`);
    }

    if (regEntry.isReversed) {
      throw new Error(`تم عكس هذا القيد مسبقاً بموجب المستند ${regEntry.reversalDocNumber}. لا يمكن عكس القيد أكثر من مرة.`);
    }

    let revJeDocNumber = '';

    const executeReverse = async () => {
      // Double check reversal status inside transaction
      const innerReg = await db.postingRegistry.get(regEntry.id);
      if (innerReg?.isReversed) {
        throw new Error(`تم عكس هذا القيد مسبقاً بموجب المستند ${innerReg.reversalDocNumber}. لا يمكن عكس القيد أكثر من مرة.`);
      }

      // Call FinanceService.reverseJournalEntry inside the ambient transaction
      const revJe = await FinanceService.reverseJournalEntry(
        regEntry.journalDocNumber,
        options.reason,
        options.userId
      );

      const now = new Date().toISOString();
      await db.postingRegistry.update(regEntry.id, {
        isReversed: true,
        reversedAt: now,
        reversalDocNumber: revJe.docNumber,
      });

      revJeDocNumber = revJe.docNumber;
    };

    const currentTx = Dexie.currentTransaction || (db as unknown as { _currentTransaction?: { storeNames?: string[] } })._currentTransaction;
    const ambientStores = currentTx?.storeNames || [];
    const isAmbientCovering = Boolean(currentTx && ['journalEntries', 'postingRegistry', 'numberRanges', 'auditLogs', 'fiscalPeriods'].every((n) => ambientStores.includes(n)));

    if (isAmbientCovering) {
      await executeReverse();
    } else {
      await db.transaction('rw', [db.journalEntries, db.postingRegistry, db.numberRanges, db.auditLogs, db.fiscalPeriods], executeReverse);
    }

    return { success: true, reversalDocNumber: revJeDocNumber };
  }

  /**
   * Posts Goods Receipt (MIGO - 101):
   * Debit: Inventory Account (e.g. 120010)
   * Credit: GR-IR Clearing Account (e.g. 201020)
   * Document Type: 'WE' (Goods Receipt)
   */
  static async postGoodsReceipt(params: {
    grDocNumber: string;
    poNumber?: string;
    vendorCode?: string;
    plantCode: string;
    amount: number;
    postingDate: string;
    createdBy: string;
    costCenter?: string;
  }): Promise<{ success: boolean; jeDocNumber: string }> {
    if (params.amount <= 0) {
      return { success: true, jeDocNumber: '' };
    }

    requirePermission(
      { module: 'FI', activity: 'post' },
      { plant: params.plantCode, costCenter: params.costCenter, amount: params.amount }
    );

    const rule = await this.getRule('GR');
    const { fiscalYear, period } = await FinanceService.validatePeriodOpen(params.postingDate);

    return await this.executeIdempotentPosting({
      sourceType: 'GOODS_RECEIPT',
      sourceId: params.grDocNumber,
      createEntry: async () => {
        const docNumber = await NumberRangeService.getNextNumber('JE', fiscalYear);
        const now = new Date().toISOString();
        return {
          id: `je-${docNumber}`,
          docNumber,
          status: 'posted',
          companyCode: '1000',
          fiscalYear,
          period,
          postingDate: params.postingDate,
          documentDate: params.postingDate,
          documentType: 'WE',
          headerText: `استلام مخزني بضاعة واردة - مستند ${params.grDocNumber}${params.poNumber ? ` (أمر شراء ${params.poNumber})` : ''}`,
          reference: params.grDocNumber,
          totalDebit: params.amount,
          totalCredit: params.amount,
          lines: [
            {
              lineNumber: 1,
              postingKey: rule.postingKeyDebit,
              accountNumber: rule.debitAccountNumber,
              accountName: rule.debitAccountName,
              debit: params.amount,
              credit: 0,
              costCenter: params.costCenter,
              lineText: `إثبات مخزون بضاعة مستلمة - ${params.grDocNumber}`,
            },
            {
              lineNumber: 2,
              postingKey: rule.postingKeyCredit,
              accountNumber: rule.creditAccountNumber,
              accountName: rule.creditAccountName,
              debit: 0,
              credit: params.amount,
              costCenter: params.costCenter,
              lineText: `مقاصة وسيط بضاعة واردة وفواتير غير مستلمة GR/IR`,
            },
          ],
          createdBy: params.createdBy,
          createdAt: now,
          updatedBy: params.createdBy,
          updatedAt: now,
          version: 1,
          isDeleted: false,
        };
      },
    });
  }

  /**
   * Posts Vendor Invoice (MIRO - RE):
   * Debit: GR-IR Clearing (201020)
   * Debit: Input VAT if applicable
   * Credit: Vendor Payable (201010)
   * Document Type: 'RE'
   */
  static async postVendorInvoice(params: {
    invoice: VendorInvoice;
    createdBy: string;
  }): Promise<{ success: boolean; jeDocNumber: string }> {
    const inv = params.invoice;
    requirePermission(
      { module: 'FI', activity: 'post' },
      { amount: inv.totalAmount }
    );
    const rule = await this.getRule('IR');
    const { fiscalYear, period } = await FinanceService.validatePeriodOpen(inv.postingDate || inv.invoiceDate);

    const netAmount = Math.round((inv.netAmount || (inv.totalAmount - (inv.vatAmount || 0))) * 100) / 100;
    const vatAmount = Math.round((inv.vatAmount || 0) * 100) / 100;
    const totalAmount = Math.round(inv.totalAmount * 100) / 100;

    const lines = [
      {
        lineNumber: 1,
        postingKey: rule.postingKeyDebit,
        accountNumber: rule.debitAccountNumber,
        accountName: rule.debitAccountName,
        debit: netAmount,
        credit: 0,
        lineText: `إقفال حساب وسيط GR/IR لفاتورة مورد ${inv.vendorInvoiceNumber}`,
      },
    ];

    if (vatAmount > 0) {
      lines.push({
        lineNumber: 2,
        postingKey: '40',
        accountNumber: '202010',
        accountName: 'ضريبة القيمة المضافة المستحقة (مدخلات قابلة للخصم)',
        debit: vatAmount,
        credit: 0,
        lineText: `ضريبة مدخلات فواتير مشتريات 15%`,
      });
    }

    lines.push({
      lineNumber: lines.length + 1,
      postingKey: rule.postingKeyCredit,
      accountNumber: rule.creditAccountNumber,
      accountName: `${rule.creditAccountName} - [${inv.vendorCode}]`,
      debit: 0,
      credit: totalAmount,
      lineText: `استحقاق فاتورة مورد ${inv.vendorInvoiceNumber} (${inv.vendorName || inv.vendorCode})`,
    });

    return await this.executeIdempotentPosting({
      sourceType: 'VENDOR_INVOICE',
      sourceId: inv.id,
      additionalTxTables: [db.vendorInvoices as unknown as Table<unknown, string>],
      createEntry: async () => {
        const docNumber = await NumberRangeService.getNextNumber('JE', fiscalYear);
        const now = new Date().toISOString();
        return {
          id: `je-${docNumber}`,
          docNumber,
          status: 'posted',
          companyCode: '1000',
          fiscalYear,
          period,
          postingDate: inv.postingDate || inv.invoiceDate,
          documentDate: inv.invoiceDate,
          documentType: 'RE',
          headerText: `فاتورة مشتريات مورد - ${inv.docNumber} (${inv.vendorInvoiceNumber})`,
          reference: inv.docNumber,
          totalDebit: totalAmount,
          totalCredit: totalAmount,
          lines,
          createdBy: params.createdBy,
          createdAt: now,
          updatedBy: params.createdBy,
          updatedAt: now,
          version: 1,
          isDeleted: false,
        };
      },
      onPersist: async (je) => {
        await db.vendorInvoices.update(inv.id, {
          jeDocNumber: je.docNumber,
          updatedAt: new Date().toISOString(),
        });
      },
    });
  }

  /**
   * Posts Goods Issue to Cost Center (MIGO - 201):
   * Debit: Consumption Expense (501010)
   * Credit: Inventory Account (120010)
   */
  static async postGoodsIssue(params: {
    giDocNumber: string;
    costCenter: string;
    amount: number;
    postingDate: string;
    createdBy: string;
  }): Promise<{ success: boolean; jeDocNumber: string }> {
    if (params.amount <= 0) return { success: true, jeDocNumber: '' };

    requirePermission(
      { module: 'FI', activity: 'post' },
      { costCenter: params.costCenter, amount: params.amount }
    );

    const rule = await this.getRule('GI');
    const { fiscalYear, period } = await FinanceService.validatePeriodOpen(params.postingDate);

    return await this.executeIdempotentPosting({
      sourceType: 'GOODS_ISSUE',
      sourceId: params.giDocNumber,
      additionalTxTables: [db.budgets as unknown as Table<unknown, string>],
      createEntry: async () => {
        const docNumber = await NumberRangeService.getNextNumber('JE', fiscalYear);
        const now = new Date().toISOString();
        return {
          id: `je-${docNumber}`,
          docNumber,
          status: 'posted',
          companyCode: '1000',
          fiscalYear,
          period,
          postingDate: params.postingDate,
          documentDate: params.postingDate,
          documentType: 'SA',
          headerText: `صرف مخزون تشغيلي لمركز تكلفة ${params.costCenter} - مستند ${params.giDocNumber}`,
          reference: params.giDocNumber,
          totalDebit: params.amount,
          totalCredit: params.amount,
          lines: [
            {
              lineNumber: 1,
              postingKey: rule.postingKeyDebit,
              accountNumber: rule.debitAccountNumber,
              accountName: rule.debitAccountName,
              debit: params.amount,
              credit: 0,
              costCenter: params.costCenter,
              lineText: `استهلاك مخزون تشغيلي لمركز تكلفة ${params.costCenter}`,
            },
            {
              lineNumber: 2,
              postingKey: rule.postingKeyCredit,
              accountNumber: rule.creditAccountNumber,
              accountName: rule.creditAccountName,
              debit: 0,
              credit: params.amount,
              costCenter: params.costCenter,
              lineText: `تخفيض رصيد المخزون - صرف بضاعة`,
            },
          ],
          createdBy: params.createdBy,
          createdAt: now,
          updatedBy: params.createdBy,
          updatedAt: now,
          version: 1,
          isDeleted: false,
        };
      },
      onPersist: async () => {
        const budget = await db.budgets
          .where({ costCenter: params.costCenter, fiscalYear })
          .first();

        if (budget) {
          budget.actualAmount += params.amount;
          budget.availableAmount = budget.allocatedAmount - budget.committedAmount - budget.actualAmount;
          await db.budgets.put(budget);
        }
      },
    });
  }

  /**
   * Posts Vendor Payment (F-53 / F110):
   * Debit: Vendor Payable (201010)
   * Credit: Bank (101010)
   */
  static async postVendorPayment(params: {
    payment: Payment;
    discountTaken?: number;
    createdBy: string;
  }): Promise<{ success: boolean; jeDocNumber: string }> {
    requirePermission(
      { module: 'FI', activity: 'post' },
      { amount: params.payment.amount }
    );
    const pay = params.payment;
    const rule = await this.getRule('PAYMENT');
    const { fiscalYear, period } = await FinanceService.validatePeriodOpen(pay.paymentDate);

    const discount = Math.round((params.discountTaken || 0) * 100) / 100;
    const grossAmount = Math.round(pay.amount * 100) / 100;
    const netBankPayment = Math.round((grossAmount - discount) * 100) / 100;

    const lines = [
      {
        lineNumber: 1,
        postingKey: rule.postingKeyDebit,
        accountNumber: rule.debitAccountNumber,
        accountName: `${rule.debitAccountName} - [${pay.vendorCode}]`,
        debit: grossAmount,
        credit: 0,
        lineText: `سداد مستحقات المورد ${pay.vendorName || pay.vendorCode} بموجب سند ${pay.docNumber}`,
      },
      {
        lineNumber: 2,
        postingKey: rule.postingKeyCredit,
        accountNumber: rule.creditAccountNumber,
        accountName: rule.creditAccountName,
        debit: 0,
        credit: netBankPayment,
        lineText: `تحويل بنكي صادر - حساب ${pay.bankAccount} (مرجع: ${pay.referenceNumber})`,
      },
    ];

    if (discount > 0) {
      lines.push({
        lineNumber: 3,
        postingKey: '50',
        accountNumber: '403010',
        accountName: 'خصم تعجيل الدفع المكتسب (Cash Discount Received)',
        debit: 0,
        credit: discount,
        lineText: `خصم تعجيل دفع مكتسب عن سداد مبكر`,
      });
    }

    return await this.executeIdempotentPosting({
      sourceType: 'VENDOR_PAYMENT',
      sourceId: pay.id,
      additionalTxTables: [db.payments as unknown as Table<unknown, string>],
      createEntry: async () => {
        const docNumber = await NumberRangeService.getNextNumber('JE', fiscalYear);
        const now = new Date().toISOString();
        return {
          id: `je-${docNumber}`,
          docNumber,
          status: 'posted',
          companyCode: '1000',
          fiscalYear,
          period,
          postingDate: pay.paymentDate,
          documentDate: pay.paymentDate,
          documentType: 'KZ',
          headerText: `سند صرف وسداد مورد - ${pay.docNumber} (${pay.vendorName || pay.vendorCode})`,
          reference: pay.docNumber,
          totalDebit: grossAmount,
          totalCredit: grossAmount,
          lines,
          createdBy: params.createdBy,
          createdAt: now,
          updatedBy: params.createdBy,
          updatedAt: now,
          version: 1,
          isDeleted: false,
        };
      },
      onPersist: async (je) => {
        await db.payments.update(pay.id, {
          jeDocNumber: je.docNumber,
          updatedAt: new Date().toISOString(),
        });
      },
    });
  }

  /**
   * Posts Customer Invoice (FB70 - DR):
   */
  static async postCustomerInvoice(params: {
    invoice: CustomerInvoice;
    createdBy: string;
  }): Promise<{ success: boolean; jeDocNumber: string }> {
    const inv = params.invoice;
    requirePermission(
      { module: 'FI', activity: 'post' },
      { amount: inv.totalAmount }
    );
    const rule = await this.getRule('AR_INV');
    const { fiscalYear, period } = await FinanceService.validatePeriodOpen(inv.postingDate || inv.invoiceDate);

    const netAmount = Math.round(inv.netAmount * 100) / 100;
    const vatAmount = Math.round(inv.vatAmount * 100) / 100;
    const totalAmount = Math.round(inv.totalAmount * 100) / 100;

    const lines = [
      {
        lineNumber: 1,
        postingKey: rule.postingKeyDebit,
        accountNumber: rule.debitAccountNumber,
        accountName: `${rule.debitAccountName} - [${inv.customerCode}]`,
        debit: totalAmount,
        credit: 0,
        lineText: `استحقاق فاتورة مبيعات عميل ${inv.customerName} - ${inv.docNumber}`,
      },
      {
        lineNumber: 2,
        postingKey: rule.postingKeyCredit,
        accountNumber: rule.creditAccountNumber,
        accountName: rule.creditAccountName,
        debit: 0,
        credit: netAmount,
        lineText: `إيراد مبيعات طاقة ومنتجات بترولية`,
      },
    ];

    if (vatAmount > 0) {
      lines.push({
        lineNumber: 3,
        postingKey: '50',
        accountNumber: '202010',
        accountName: 'ضريبة القيمة المضافة المستحقة (مخرجات مستحقة لهيئة الزكاة)',
        debit: 0,
        credit: vatAmount,
        lineText: `ضريبة مخرجات مبيعات 15%`,
      });
    }

    return await this.executeIdempotentPosting({
      sourceType: 'CUSTOMER_INVOICE',
      sourceId: inv.id,
      additionalTxTables: [db.customerInvoices as unknown as Table<unknown, string>],
      createEntry: async () => {
        const docNumber = await NumberRangeService.getNextNumber('JE', fiscalYear);
        const now = new Date().toISOString();
        return {
          id: `je-${docNumber}`,
          docNumber,
          status: 'posted',
          companyCode: '1000',
          fiscalYear,
          period,
          postingDate: inv.postingDate || inv.invoiceDate,
          documentDate: inv.invoiceDate,
          documentType: 'DR',
          headerText: `فاتورة مبيعات عميل - ${inv.docNumber} (${inv.customerName})`,
          reference: inv.docNumber,
          totalDebit: totalAmount,
          totalCredit: totalAmount,
          lines,
          createdBy: params.createdBy,
          createdAt: now,
          updatedBy: params.createdBy,
          updatedAt: now,
          version: 1,
          isDeleted: false,
        };
      },
      onPersist: async (je) => {
        await db.customerInvoices.update(inv.id, {
          jeDocNumber: je.docNumber,
          updatedAt: new Date().toISOString(),
        });
      },
    });
  }

  /**
   * Posts Customer Receipt (F-28 - DZ):
   */
  static async postCustomerReceipt(params: {
    receipt: CustomerReceipt;
    createdBy: string;
  }): Promise<{ success: boolean; jeDocNumber: string }> {
    const rec = params.receipt;
    requirePermission(
      { module: 'FI', activity: 'post' },
      { amount: rec.amount }
    );
    const rule = await this.getRule('AR_PAY');
    const { fiscalYear, period } = await FinanceService.validatePeriodOpen(rec.receiptDate);

    return await this.executeIdempotentPosting({
      sourceType: 'CUSTOMER_RECEIPT',
      sourceId: rec.id,
      additionalTxTables: [db.customerReceipts as unknown as Table<unknown, string>],
      createEntry: async () => {
        const docNumber = await NumberRangeService.getNextNumber('JE', fiscalYear);
        const now = new Date().toISOString();
        return {
          id: `je-${docNumber}`,
          docNumber,
          status: 'posted',
          companyCode: '1000',
          fiscalYear,
          period,
          postingDate: rec.receiptDate,
          documentDate: rec.receiptDate,
          documentType: 'DZ',
          headerText: `سند قبض وتحصيل عميل - ${rec.docNumber} (${rec.customerName})`,
          reference: rec.docNumber,
          totalDebit: rec.amount,
          totalCredit: rec.amount,
          lines: [
            {
              lineNumber: 1,
              postingKey: rule.postingKeyDebit,
              accountNumber: rule.debitAccountNumber,
              accountName: rule.debitAccountName,
              debit: rec.amount,
              credit: 0,
              lineText: `إيداع بنكي متحصلات عميل ${rec.customerName} - حساب ${rec.bankAccount}`,
            },
            {
              lineNumber: 2,
              postingKey: rule.postingKeyCredit,
              accountNumber: rule.creditAccountNumber,
              accountName: `${rule.creditAccountName} - [${rec.customerCode}]`,
              debit: 0,
              credit: rec.amount,
              lineText: `تسوية وتخفيض رصيد ذمة العميل ${rec.customerName}`,
            },
          ],
          createdBy: params.createdBy,
          createdAt: now,
          updatedBy: params.createdBy,
          updatedAt: now,
          version: 1,
          isDeleted: false,
        };
      },
      onPersist: async (je) => {
        await db.customerReceipts.update(rec.id, {
          jeDocNumber: je.docNumber,
          updatedAt: new Date().toISOString(),
        });
      },
    });
  }

  /**
   * Fleet Integration: Idempotent Trip Cost GL Posting
   */
  static async postTripCost(params: {
    tripDocNumber: string;
    vehiclePlate: string;
    amount: number;
    postingDate: string;
    createdBy: string;
  }): Promise<{ success: boolean; jeDocNumber: string }> {
    if (params.amount <= 0) return { success: true, jeDocNumber: '' };

    requirePermission(
      { module: 'FI', activity: 'post' },
      { amount: params.amount }
    );
    const rule = await this.getRule('FUEL');
    const { fiscalYear, period } = await FinanceService.validatePeriodOpen(params.postingDate);

    return await this.executeIdempotentPosting({
      sourceType: 'FLEET_TRIP',
      sourceId: params.tripDocNumber,
      createEntry: async () => {
        const docNumber = await NumberRangeService.getNextNumber('JE', fiscalYear);
        const now = new Date().toISOString();
        return {
          id: `je-${docNumber}`,
          docNumber,
          status: 'posted',
          companyCode: '1000',
          fiscalYear,
          period,
          postingDate: params.postingDate,
          documentDate: params.postingDate,
          documentType: 'SA',
          headerText: `تكاليف تشغيل رحلة الشاحنة [${params.vehiclePlate}] - رحلة ${params.tripDocNumber}`,
          reference: params.tripDocNumber,
          totalDebit: params.amount,
          totalCredit: params.amount,
          lines: [
            {
              lineNumber: 1,
              postingKey: rule.postingKeyDebit,
              accountNumber: rule.debitAccountNumber,
              accountName: rule.debitAccountName,
              debit: params.amount,
              credit: 0,
              lineText: `مصروف تشغيل وقود وبدلات رحلة ${params.tripDocNumber}`,
            },
            {
              lineNumber: 2,
              postingKey: rule.postingKeyCredit,
              accountNumber: rule.creditAccountNumber,
              accountName: rule.creditAccountName,
              debit: 0,
              credit: params.amount,
              lineText: `إثبات مستحقات / بنك عن رحلة ${params.tripDocNumber}`,
            },
          ],
          createdBy: params.createdBy,
          createdAt: now,
          updatedBy: params.createdBy,
          updatedAt: now,
          version: 1,
          isDeleted: false,
        };
      },
    });
  }

  /**
   * Fleet Integration: Idempotent Fuel Log GL Posting
   */
  static async postFuelCost(params: {
    fuelLogId: string;
    vehiclePlate: string;
    amount: number;
    date: string;
    stationName: string;
    createdBy: string;
  }): Promise<{ success: boolean; jeDocNumber: string }> {
    if (params.amount <= 0) return { success: true, jeDocNumber: '' };

    requirePermission(
      { module: 'FI', activity: 'post' },
      { amount: params.amount }
    );
    const rule = await this.getRule('FUEL');
    const { fiscalYear, period } = await FinanceService.validatePeriodOpen(params.date);

    return await this.executeIdempotentPosting({
      sourceType: 'FLEET_FUEL',
      sourceId: params.fuelLogId,
      createEntry: async () => {
        const docNumber = await NumberRangeService.getNextNumber('JE', fiscalYear);
        const now = new Date().toISOString();
        return {
          id: `je-${docNumber}`,
          docNumber,
          status: 'posted',
          companyCode: '1000',
          fiscalYear,
          period,
          postingDate: params.date,
          documentDate: params.date,
          documentType: 'SA',
          headerText: `تموين وقود مركبة [${params.vehiclePlate}] - محطة ${params.stationName}`,
          reference: params.fuelLogId,
          totalDebit: params.amount,
          totalCredit: params.amount,
          lines: [
            {
              lineNumber: 1,
              postingKey: rule.postingKeyDebit,
              accountNumber: rule.debitAccountNumber,
              accountName: rule.debitAccountName,
              debit: params.amount,
              credit: 0,
              lineText: `مصروف وقود شاحنة ${params.vehiclePlate}`,
            },
            {
              lineNumber: 2,
              postingKey: rule.postingKeyCredit,
              accountNumber: rule.creditAccountNumber,
              accountName: rule.creditAccountName,
              debit: 0,
              credit: params.amount,
              lineText: `سداد تموين وقود - ${params.stationName}`,
            },
          ],
          createdBy: params.createdBy,
          createdAt: now,
          updatedBy: params.createdBy,
          updatedAt: now,
          version: 1,
          isDeleted: false,
        };
      },
    });
  }

  /**
   * Fleet Integration: Idempotent Maintenance Cost GL Posting
   */
  static async postMaintenanceCost(params: {
    orderDocNumber: string;
    vehiclePlate: string;
    amount: number;
    completionDate: string;
    createdBy: string;
  }): Promise<{ success: boolean; jeDocNumber: string }> {
    if (params.amount <= 0) return { success: true, jeDocNumber: '' };

    requirePermission(
      { module: 'FI', activity: 'post' },
      { amount: params.amount }
    );
    const rule = await this.getRule('MAINT');
    const { fiscalYear, period } = await FinanceService.validatePeriodOpen(params.completionDate);

    return await this.executeIdempotentPosting({
      sourceType: 'FLEET_MAINT',
      sourceId: params.orderDocNumber,
      createEntry: async () => {
        const docNumber = await NumberRangeService.getNextNumber('JE', fiscalYear);
        const now = new Date().toISOString();
        return {
          id: `je-${docNumber}`,
          docNumber,
          status: 'posted',
          companyCode: '1000',
          fiscalYear,
          period,
          postingDate: params.completionDate,
          documentDate: params.completionDate,
          documentType: 'SA',
          headerText: `تكاليف صيانة الشاحنة [${params.vehiclePlate}] - أمر ${params.orderDocNumber}`,
          reference: params.orderDocNumber,
          totalDebit: params.amount,
          totalCredit: params.amount,
          lines: [
            {
              lineNumber: 1,
              postingKey: rule.postingKeyDebit,
              accountNumber: rule.debitAccountNumber,
              accountName: rule.debitAccountName,
              debit: params.amount,
              credit: 0,
              lineText: `مصروف عمالة وقطع صيانة أمر ${params.orderDocNumber}`,
            },
            {
              lineNumber: 2,
              postingKey: rule.postingKeyCredit,
              accountNumber: rule.creditAccountNumber,
              accountName: rule.creditAccountName,
              debit: 0,
              credit: params.amount,
              lineText: `إثبات مستحقات صيانة أمر ${params.orderDocNumber}`,
            },
          ],
          createdBy: params.createdBy,
          createdAt: now,
          updatedBy: params.createdBy,
          updatedAt: now,
          version: 1,
          isDeleted: false,
        };
      },
    });
  }
}
