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
   * Posts Goods Receipt (MIGO - 101):
   * Debit: Inventory Account (e.g. 120010)
   * Credit: GR-IR Clearing Account (e.g. 201020)
   * Document Type: 'WE' (Goods Receipt)
   * Releases budget commitment or converts to actual.
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

    const docNumber = await NumberRangeService.getNextNumber('JE', fiscalYear);
    const now = new Date().toISOString();

    const journalEntry: JournalEntry = {
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

    await db.transaction('rw', [db.journalEntries, db.auditLogs], async () => {
      await db.journalEntries.add(journalEntry);
      await AuditService.log({
        userId: params.createdBy,
        action: 'CREATE',
        entity: 'JournalEntry',
        entityId: journalEntry.id,
        after: journalEntry as unknown as Record<string, unknown>,
      });
    });

    return { success: true, jeDocNumber: docNumber };
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

    const docNumber = await NumberRangeService.getNextNumber('JE', fiscalYear);
    const now = new Date().toISOString();

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

    const journalEntry: JournalEntry = {
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

    await db.transaction('rw', [db.journalEntries, db.vendorInvoices, db.auditLogs], async () => {
      await db.journalEntries.add(journalEntry);
      await db.vendorInvoices.update(inv.id, {
        jeDocNumber: docNumber,
        updatedAt: now,
      });
      await AuditService.log({
        userId: params.createdBy,
        action: 'CREATE',
        entity: 'JournalEntry',
        entityId: journalEntry.id,
        after: journalEntry as unknown as Record<string, unknown>,
      });
    });

    return { success: true, jeDocNumber: docNumber };
  }

  /**
   * Posts Goods Issue to Cost Center (MIGO - 201):
   * Debit: Consumption Expense (501010 or 603010)
   * Credit: Inventory Account (120010)
   * Updates Cost Center actual budget consumption.
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

    const docNumber = await NumberRangeService.getNextNumber('JE', fiscalYear);
    const now = new Date().toISOString();

    const journalEntry: JournalEntry = {
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

    await db.transaction('rw', [db.journalEntries, db.budgets, db.auditLogs], async () => {
      await db.journalEntries.add(journalEntry);

      // Update actuals in cost center budget if exists
      const budget = await db.budgets
        .where({ costCenter: params.costCenter, fiscalYear })
        .first();

      if (budget) {
        budget.actualAmount += params.amount;
        budget.availableAmount = budget.allocatedAmount - budget.committedAmount - budget.actualAmount;
        await db.budgets.put(budget);
      }

      await AuditService.log({
        userId: params.createdBy,
        action: 'CREATE',
        entity: 'JournalEntry',
        entityId: journalEntry.id,
        after: journalEntry as unknown as Record<string, unknown>,
      });
    });

    return { success: true, jeDocNumber: docNumber };
  }

  /**
   * Posts Vendor Payment (F-53 / F110):
   * Debit: Vendor Payable (201010)
   * Credit: Bank (101010)
   * Credit: Cash Discount if taken
   * Document Type: 'KZ'
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

    const docNumber = await NumberRangeService.getNextNumber('JE', fiscalYear);
    const now = new Date().toISOString();

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

    const journalEntry: JournalEntry = {
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

    await db.transaction('rw', [db.journalEntries, db.payments, db.auditLogs], async () => {
      await db.journalEntries.add(journalEntry);
      await db.payments.update(pay.id, {
        jeDocNumber: docNumber,
        updatedAt: now,
      });
      await AuditService.log({
        userId: params.createdBy,
        action: 'CREATE',
        entity: 'JournalEntry',
        entityId: journalEntry.id,
        after: journalEntry as unknown as Record<string, unknown>,
      });
    });

    return { success: true, jeDocNumber: docNumber };
  }

  /**
   * Posts Customer Invoice (FB70 - DR):
   * Debit: Accounts Receivable (110010)
   * Credit: Revenue (401010)
   * Credit: Output VAT (202010)
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

    const docNumber = await NumberRangeService.getNextNumber('JE', fiscalYear);
    const now = new Date().toISOString();

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

    const journalEntry: JournalEntry = {
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

    await db.transaction('rw', [db.journalEntries, db.customerInvoices, db.auditLogs], async () => {
      await db.journalEntries.add(journalEntry);
      await db.customerInvoices.update(inv.id, {
        jeDocNumber: docNumber,
        updatedAt: now,
      });
      await AuditService.log({
        userId: params.createdBy,
        action: 'CREATE',
        entity: 'JournalEntry',
        entityId: journalEntry.id,
        after: journalEntry as unknown as Record<string, unknown>,
      });
    });

    return { success: true, jeDocNumber: docNumber };
  }

  /**
   * Posts Customer Receipt (F-28 - DZ):
   * Debit: Bank (101010)
   * Credit: Accounts Receivable (110010)
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

    const docNumber = await NumberRangeService.getNextNumber('JE', fiscalYear);
    const now = new Date().toISOString();

    const journalEntry: JournalEntry = {
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

    await db.transaction('rw', [db.journalEntries, db.customerReceipts, db.auditLogs], async () => {
      await db.journalEntries.add(journalEntry);
      await db.customerReceipts.update(rec.id, {
        jeDocNumber: docNumber,
        updatedAt: now,
      });
      await AuditService.log({
        userId: params.createdBy,
        action: 'CREATE',
        entity: 'JournalEntry',
        entityId: journalEntry.id,
        after: journalEntry as unknown as Record<string, unknown>,
      });
    });

    return { success: true, jeDocNumber: docNumber };
  }
}
