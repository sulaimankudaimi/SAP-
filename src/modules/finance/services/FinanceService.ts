import Dexie from 'dexie';
import { db } from '../../../core/db';
import {
  journalRepository,
  fiscalPeriodRepository,
  numberRangeRepository,
} from '../../../core/repositories';
import { NumberRangeService } from '../../../core/services/NumberRangeService';
import { AuditService } from '../../../core/services/AuditService';
import { requirePermission } from '../../../core/security/SessionContext';
import type {
  JournalEntry,
  JournalEntryLine,
  FiscalPeriod,
  SAPDocumentType,
} from '../../../types/models';

export interface CreateJournalEntryInput {
  companyCode: string;
  fiscalYear: string;
  period: number;
  postingDate: string;
  documentDate: string;
  documentType: SAPDocumentType;
  headerText: string;
  reference?: string;
  lines: Omit<JournalEntryLine, 'lineNumber'>[];
  isParked?: boolean;
  attachments?: { name: string; size: string; type: string }[];
  createdBy: string;
}

export class FinanceService {
  /**
   * Validates if the posting period is open for the given date.
   * Throws an error if period is closed to prevent backdated postings.
   */
  static async validatePeriodOpen(postingDate: string): Promise<{ fiscalYear: string; period: number }> {
    const d = new Date(postingDate);
    const fiscalYear = d.getFullYear().toString();
    const period = d.getMonth() + 1; // 1 - 12

    // Check fiscal period in database
    const periodRecord = await db.fiscalPeriods
      .where({ fiscalYear, period })
      .first();

    if (periodRecord && periodRecord.status === 'Closed') {
      throw new Error(`الفترة المالية ${period}/${fiscalYear} مقفلة. لا يمكن الترحيل بأثر رجعي في فترة مغلقة.`);
    }

    return { fiscalYear, period };
  }

  /**
   * Initializes standard 12 fiscal periods for a given year if not existing.
   */
  static async initFiscalPeriods(fiscalYear: string = '2026', currentUserId: string = 'usr-admin-1'): Promise<void> {
    const existing = await db.fiscalPeriods.where({ fiscalYear }).count();
    if (existing >= 12) return;

    const periods: FiscalPeriod[] = [];
    for (let p = 1; p <= 12; p++) {
      const start = new Date(parseInt(fiscalYear), p - 1, 1).toISOString().split('T')[0];
      const end = new Date(parseInt(fiscalYear), p, 0).toISOString().split('T')[0];
      // Periods 1-9 open by default, 10-12 open, can be closed for testing
      periods.push({
        id: `fp-${fiscalYear}-${String(p).padStart(2, '0')}`,
        fiscalYear,
        period: p,
        startDate: start,
        endDate: end,
        status: p < 1 ? 'Closed' : 'Open', // all currently open
      });
    }

    await db.transaction('rw', db.fiscalPeriods, async () => {
      for (const p of periods) {
        const found = await db.fiscalPeriods.get(p.id);
        if (!found) {
          await db.fiscalPeriods.add(p);
        }
      }
    });
  }

  /**
   * Closes or opens a fiscal period with audit logging.
   */
  static async setPeriodStatus(
    fiscalYear: string,
    period: number,
    status: 'Open' | 'Closed',
    userId: string
  ): Promise<void> {
    requirePermission({ module: 'FI', activity: 'change' });
    const periodRecord = await db.fiscalPeriods
      .where({ fiscalYear, period })
      .first();

    if (!periodRecord) {
      throw new Error(`الفترة المالية ${period}/${fiscalYear} غير موجودة.`);
    }

    const before = { ...periodRecord };
    periodRecord.status = status;
    if (status === 'Closed') {
      periodRecord.closedAt = new Date().toISOString();
      periodRecord.closedBy = userId;
    } else {
      periodRecord.closedAt = undefined;
      periodRecord.closedBy = undefined;
    }

    await db.fiscalPeriods.put(periodRecord);

    await AuditService.log({
      userId,
      action: 'STATUS_CHANGE',
      entity: 'FiscalPeriod',
      entityId: periodRecord.id,
      before: before as unknown as Record<string, unknown>,
      after: periodRecord as unknown as Record<string, unknown>,
    });
  }

  /**
   * Creates and posts a manual Journal Entry (FB50 / F-02).
   * Strictly enforces balanced lines: totalDebit === totalCredit.
   * If isParked is true, saves as parked draft (FBV1).
   */
  static async createJournalEntry(input: CreateJournalEntryInput): Promise<JournalEntry> {
    if (!input.lines || input.lines.length < 2) {
      throw new Error('يجب أن يحتوي القيد المحاسبي على طرفين على الأقل (مدين ودائن).');
    }

    const firstCostCenter = input.lines.find((l) => l.costCenter)?.costCenter;
    requirePermission(
      { module: 'FI', activity: input.isParked ? 'create' : 'post' },
      { costCenter: firstCostCenter }
    );

    // Validate period if posting (parked docs can be drafted)
    if (!input.isParked) {
      await this.validatePeriodOpen(input.postingDate);
    }

    // Format lines with line numbers & calculate totals
    let totalDebit = 0;
    let totalCredit = 0;

    const formattedLines: JournalEntryLine[] = input.lines.map((line, idx) => {
      const debit = Math.round((Number(line.debit) || 0) * 100) / 100;
      const credit = Math.round((Number(line.credit) || 0) * 100) / 100;
      totalDebit += debit;
      totalCredit += credit;

      return {
        lineNumber: idx + 1,
        postingKey: line.postingKey || (debit > 0 ? '40' : '50'),
        accountNumber: line.accountNumber,
        accountName: line.accountName,
        debit,
        credit,
        costCenter: line.costCenter,
        internalOrder: line.internalOrder,
        lineText: line.lineText,
      };
    });

    totalDebit = Math.round(totalDebit * 100) / 100;
    totalCredit = Math.round(totalCredit * 100) / 100;

    // Strict balance check for posted entries
    if (!input.isParked) {
      const diff = Math.abs(totalDebit - totalCredit);
      if (diff > 0.01) {
        throw new Error(`القيد غير متوازن: إجمالي المدين (${totalDebit.toLocaleString('en-US')} ر.س) لا يساوي إجمالي الدائن (${totalCredit.toLocaleString('en-US')} ر.س). الفارق: ${diff.toFixed(2)} ر.س`);
      }
    }

    const txTables = [
      db.journalEntries,
      db.numberRanges,
      db.auditLogs,
    ];

    let journalEntry!: JournalEntry;

    const executeCreate = async () => {
      const docNumber = await NumberRangeService.getNextNumber('JE', input.fiscalYear);
      const now = new Date().toISOString();

      journalEntry = {
        id: `je-${docNumber}`,
        docNumber,
        status: input.isParked ? 'draft' : 'posted',
        companyCode: input.companyCode || '1000',
        fiscalYear: input.fiscalYear,
        period: input.period,
        postingDate: input.postingDate,
        documentDate: input.documentDate,
        documentType: input.documentType,
        headerText: input.headerText,
        reference: input.reference,
        totalDebit,
        totalCredit,
        lines: formattedLines,
        isParked: !!input.isParked,
        parkedBy: input.isParked ? input.createdBy : undefined,
        attachments: input.attachments || [],
        createdBy: input.createdBy,
        createdAt: now,
        updatedBy: input.createdBy,
        updatedAt: now,
        version: 1,
        isDeleted: false,
      };

      await db.journalEntries.add(journalEntry);
      await AuditService.log({
        userId: input.createdBy,
        action: 'CREATE',
        entity: 'JournalEntry',
        entityId: journalEntry.id,
        after: journalEntry as unknown as Record<string, unknown>,
      });
    };

    const currentTx = Dexie.currentTransaction || (db as unknown as { _currentTransaction?: { storeNames?: string[] } })._currentTransaction;
    const ambientStores = currentTx?.storeNames || [];
    const isAmbientCovering = Boolean(currentTx && ['journalEntries', 'numberRanges', 'auditLogs'].every((n) => ambientStores.includes(n)));

    if (isAmbientCovering) {
      await executeCreate();
    } else {
      await db.transaction('rw', txTables, executeCreate);
    }

    return journalEntry;
  }

  /**
   * Posts a previously parked document (FBV0).
   */
  static async postParkedDocument(id: string, userId: string): Promise<JournalEntry> {
    requirePermission({ module: 'FI', activity: 'post' });
    const entry = await db.journalEntries.get(id);
    if (!entry) throw new Error('مستند القيد المحفوظ غير موجود.');
    if (!entry.isParked) throw new Error('المستند مرحل بالفعل.');

    // Validate period
    await this.validatePeriodOpen(entry.postingDate);

    // Validate balance
    const diff = Math.abs(entry.totalDebit - entry.totalCredit);
    if (diff > 0.01) {
      throw new Error(`لا يمكن ترحيل المستند: القيد غير متوازن بفارق ${diff.toFixed(2)} ر.س`);
    }

    const before = { ...entry };
    entry.isParked = false;
    entry.status = 'posted';
    entry.updatedBy = userId;
    entry.updatedAt = new Date().toISOString();
    entry.version += 1;

    await db.transaction('rw', [db.journalEntries, db.auditLogs], async () => {
      await db.journalEntries.put(entry);
      await AuditService.log({
        userId,
        action: 'UPDATE',
        entity: 'JournalEntry',
        entityId: entry.id,
        before: before as unknown as Record<string, unknown>,
        after: entry as unknown as Record<string, unknown>,
      });
    });

    return entry;
  }

  /**
   * Reverses a posted journal entry (FB08 - Storno).
   * Accounting documents are strictly immutable; corrections are only made by reversal.
   */
  static async reverseJournalEntry(
    docNumber: string,
    reason: string,
    userId: string,
    reversalDate?: string
  ): Promise<JournalEntry> {
    requirePermission({ module: 'FI', activity: 'reverse' });
    const original = await db.journalEntries.where('docNumber').equals(docNumber).first();
    if (!original) throw new Error(`المستند المحاسبي ${docNumber} غير موجود.`);
    if (original.isReversed) throw new Error(`المستند ${docNumber} تم عكسه وإلغاؤه مسبقاً بموجب ${original.reversalDocNumber}.`);
    if (original.isParked) throw new Error('لا يمكن عكس مستند محفوظ كمسودة، يمكنك حذفه أو تعديله مباشرة.');

    const postingDate = reversalDate || new Date().toISOString().split('T')[0];
    const { fiscalYear, period } = await this.validatePeriodOpen(postingDate);

    const txTables = [
      db.journalEntries,
      db.postingRegistry,
      db.numberRanges,
      db.auditLogs,
      db.fiscalPeriods,
    ];

    let reversalDoc!: JournalEntry;

    const executeReverse = async () => {
      // Generate reversal document number inside transaction
      const revDocNumber = await NumberRangeService.getNextNumber('JE', fiscalYear);

      // Invert lines (debits become credits, credits become debits)
      const reversedLines: JournalEntryLine[] = original.lines.map((line) => ({
        lineNumber: line.lineNumber,
        postingKey: line.debit > 0 ? '50' : '40', // Invert posting keys
        accountNumber: line.accountNumber,
        accountName: line.accountName,
        debit: line.credit, // Invert
        credit: line.debit, // Invert
        costCenter: line.costCenter,
        internalOrder: line.internalOrder,
        lineText: `عكس قيد: ${line.lineText || ''}`,
      }));

      const now = new Date().toISOString();

      reversalDoc = {
        id: `je-${revDocNumber}`,
        docNumber: revDocNumber,
        status: 'posted',
        companyCode: original.companyCode,
        fiscalYear,
        period,
        postingDate,
        documentDate: postingDate,
        documentType: 'AB', // Storno / Reversal
        headerText: `عكس القيد ${original.docNumber} - السبب: ${reason}`,
        reference: original.docNumber,
        totalDebit: original.totalCredit,
        totalCredit: original.totalDebit,
        lines: reversedLines,
        createdBy: userId,
        createdAt: now,
        updatedBy: userId,
        updatedAt: now,
        version: 1,
        isDeleted: false,
      };

      // Update original document to flag as reversed
      const updatedOriginal: JournalEntry = {
        ...original,
        isReversed: true,
        reversalDocNumber: revDocNumber,
        reversalReason: reason,
        reversedAt: now,
        updatedBy: userId,
        updatedAt: now,
        version: original.version + 1,
      };

      await db.journalEntries.add(reversalDoc);
      await db.journalEntries.put(updatedOriginal);

      // If registered in postingRegistry, sync reversed status
      const reg = await db.postingRegistry.where('journalDocNumber').equals(original.docNumber).first();
      if (reg) {
        await db.postingRegistry.update(reg.id, {
          isReversed: true,
          reversedAt: now,
          reversalDocNumber: revDocNumber,
        });
      }

      await AuditService.log({
        userId,
        action: 'STATUS_CHANGE',
        entity: 'JournalEntry',
        entityId: original.id,
        before: original as unknown as Record<string, unknown>,
        after: updatedOriginal as unknown as Record<string, unknown>,
      });

      await AuditService.log({
        userId,
        action: 'CREATE',
        entity: 'JournalEntry',
        entityId: reversalDoc.id,
        after: reversalDoc as unknown as Record<string, unknown>,
      });
    };

    const currentTx = Dexie.currentTransaction || (db as unknown as { _currentTransaction?: { storeNames?: string[] } })._currentTransaction;
    const ambientStores = currentTx?.storeNames || [];
    const isAmbientCovering = Boolean(currentTx && ['journalEntries', 'postingRegistry', 'numberRanges', 'auditLogs', 'fiscalPeriods'].every((n) => ambientStores.includes(n)));

    if (isAmbientCovering) {
      await executeReverse();
    } else {
      await db.transaction('rw', txTables, executeReverse);
    }

    return reversalDoc;
  }

  /**
   * Retrieves journal entries with filtering and search.
   */
  static async getJournalEntries(filters?: {
    fiscalYear?: string;
    period?: number;
    documentType?: string;
    isParked?: boolean;
    searchTerm?: string;
  }): Promise<JournalEntry[]> {
    let query = db.journalEntries.filter((je) => !je.isDeleted);

    if (filters?.fiscalYear) {
      const fy = filters.fiscalYear;
      query = query.filter((je) => je.fiscalYear === fy);
    }
    if (filters?.period) {
      const p = filters.period;
      query = query.filter((je) => je.period === p);
    }
    if (filters?.documentType) {
      const dt = filters.documentType;
      query = query.filter((je) => je.documentType === dt);
    }
    if (filters?.isParked !== undefined) {
      const parked = filters.isParked;
      query = query.filter((je) => !!je.isParked === parked);
    }
    if (filters?.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      query = query.filter(
        (je) =>
          je.docNumber.toLowerCase().includes(term) ||
          je.headerText.toLowerCase().includes(term) ||
          Boolean(je.reference && je.reference.toLowerCase().includes(term))
      );
    }

    const items = await query.toArray();
    // Sort descending by posting date / creation
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Seeds realistic SAP FI/CO dataset if journal entries are not yet populated.
   */
  static async seedFinanceIfEmpty(): Promise<void> {
    await this.initFiscalPeriods('2026');

    // Import AutomaticPostingEngine dynamically or assume initialized
    const jeCount = await db.journalEntries.count();
    if (jeCount >= 5) return;

    const now = new Date().toISOString();
    const jes: JournalEntry[] = [];

    // 1. Opening Balance Journal Entry (Strictly Zero-Sum Balanced: 13,300,000 SAR)
    jes.push({
      id: 'je-2026-000001',
      docNumber: 'JE-2026-000001',
      status: 'posted',
      companyCode: '1000',
      fiscalYear: '2026',
      period: 1,
      postingDate: '2026-01-01',
      documentDate: '2026-01-01',
      documentType: 'SA',
      headerText: 'قيد افتتاح الأرصدة الافتتاحية للميزانية العمومية للعام المالي 2026',
      reference: 'OPEN-2026',
      totalDebit: 13300000,
      totalCredit: 13300000,
      lines: [
        { lineNumber: 1, postingKey: '40', accountNumber: '101010', accountName: 'النقدية بالبنوك المحلية (الراجحي / الأهلي)', debit: 4500000, credit: 0, lineText: 'رصيد الحسابات الجارية البنكية' },
        { lineNumber: 2, postingKey: '40', accountNumber: '101020', accountName: 'صندوق العهد النقدية المؤقتة', debit: 150000, credit: 0, lineText: 'صندوق العهدة النقدية' },
        { lineNumber: 3, postingKey: '40', accountNumber: '110010', accountName: 'الذمم المدينة التجارية (عملاء الطاقة)', debit: 850000, credit: 0, lineText: 'مديونيات عملاء محطات الطاقة' },
        { lineNumber: 4, postingKey: '40', accountNumber: '120010', accountName: 'مخزون وقود الديزل (Euro 5)', debit: 1200000, credit: 0, lineText: 'مخزون ديزل استراتيجي 500,000 لتر' },
        { lineNumber: 5, postingKey: '40', accountNumber: '120020', accountName: 'مخزون البنزين 95 أوكتان', debit: 600000, credit: 0, lineText: 'مخزون بنزين ممتاز' },
        { lineNumber: 6, postingKey: '40', accountNumber: '150010', accountName: 'أصول ثابتة - خزانات ومحطات الضخ', debit: 3200000, credit: 0, lineText: 'خزانات ومضخات ومحطات' },
        { lineNumber: 7, postingKey: '40', accountNumber: '150020', accountName: 'أصول ثابتة - أسطول الشاحنات والصهاريج', debit: 2800000, credit: 0, lineText: 'شاحنات نقل الوقود أكرتوس' },
        { lineNumber: 8, postingKey: '50', accountNumber: '150090', accountName: 'مجمع استهلاك الأصول الثابتة', debit: 0, credit: 950000, lineText: 'مجمع استهلاك تاريخي' },
        { lineNumber: 9, postingKey: '50', accountNumber: '201010', accountName: 'الذمم الدائنة التجارية (موردي الوقود والمعدات)', debit: 0, credit: 1150000, lineText: 'أرصدة مستحقة لموردي أرامكو' },
        { lineNumber: 10, postingKey: '50', accountNumber: '202010', accountName: 'ضريبة القيمة المضافة المستحقة (ZATCA)', debit: 0, credit: 150000, lineText: 'مستحقات ضريبية مرحلة' },
        { lineNumber: 11, postingKey: '50', accountNumber: '301010', accountName: 'رأس المال المدفوع', debit: 0, credit: 8000000, lineText: 'رأس مال الشركة المصرح به والمدفوع' },
        { lineNumber: 12, postingKey: '50', accountNumber: '303010', accountName: 'الأرباح المبقاة', debit: 0, credit: 3050000, lineText: 'أرباح مدورة من الأعوام السابقة' },
      ],
      createdBy: 'usr-admin-1',
      createdAt: now,
      updatedBy: 'usr-admin-1',
      updatedAt: now,
      version: 1,
      isDeleted: false,
    });

    // 2. Goods Receipt Entry (WE: Dr Inventory / Cr GR-IR: 420,000 SAR)
    jes.push({
      id: 'je-2026-000002',
      docNumber: 'JE-2026-000002',
      status: 'posted',
      companyCode: '1000',
      fiscalYear: '2026',
      period: 8,
      postingDate: '2026-08-15',
      documentDate: '2026-08-15',
      documentType: 'WE',
      headerText: 'استلام بضائع مخزني ضد أمر الشراء PO-2026-000001 (شحنة ديزل كبرى)',
      reference: 'GR-2026-000001',
      totalDebit: 420000,
      totalCredit: 420000,
      lines: [
        { lineNumber: 1, postingKey: '40', accountNumber: '120010', accountName: 'مخزون وقود الديزل (Euro 5)', debit: 420000, credit: 0, lineText: 'استلام وقود ديزل بالمستودع الرئيسي' },
        { lineNumber: 2, postingKey: '50', accountNumber: '201020', accountName: 'حساب وسيط البضاعة الواردة والفواتير غير المستلمة (GR/IR)', debit: 0, credit: 420000, lineText: 'مقاصة وسيط GR/IR لشحنة أغسطس' },
      ],
      createdBy: 'usr-admin-1',
      createdAt: now,
      updatedBy: 'usr-admin-1',
      updatedAt: now,
      version: 1,
      isDeleted: false,
    });

    // 3. Vendor Invoice Receipt (RE: Dr GR-IR 420,000 / Dr VAT 63,000 / Cr AP 483,000 SAR)
    jes.push({
      id: 'je-2026-000003',
      docNumber: 'JE-2026-000003',
      status: 'posted',
      companyCode: '1000',
      fiscalYear: '2026',
      period: 8,
      postingDate: '2026-08-20',
      documentDate: '2026-08-18',
      documentType: 'RE',
      headerText: 'إثبات فاتورة المورد شركة مصفاة ينبع الوطنية رقم VINV-1001-44',
      reference: 'INV-2026-000001',
      totalDebit: 483000,
      totalCredit: 483000,
      lines: [
        { lineNumber: 1, postingKey: '40', accountNumber: '201020', accountName: 'حساب وسيط البضاعة الواردة والفواتير غير المستلمة (GR/IR)', debit: 420000, credit: 0, lineText: 'إقفال وسيط GR/IR' },
        { lineNumber: 2, postingKey: '40', accountNumber: '202010', accountName: 'ضريبة القيمة المضافة المستحقة (ZATCA)', debit: 63000, credit: 0, lineText: 'ضريبة مدخلات مشتريات 15%' },
        { lineNumber: 3, postingKey: '31', accountNumber: '201010', accountName: 'الذمم الدائنة التجارية (موردي الوقود والمعدات)', debit: 0, credit: 483000, lineText: 'مستحقات مصفاة ينبع' },
      ],
      createdBy: 'usr-admin-1',
      createdAt: now,
      updatedBy: 'usr-admin-1',
      updatedAt: now,
      version: 1,
      isDeleted: false,
    });

    // 4. Vendor Payment with Cash Discount (KZ: Dr AP 483,000 / Cr Bank 473,340 / Cr Discount 9,660 SAR)
    jes.push({
      id: 'je-2026-000004',
      docNumber: 'JE-2026-000004',
      status: 'posted',
      companyCode: '1000',
      fiscalYear: '2026',
      period: 8,
      postingDate: '2026-08-25',
      documentDate: '2026-08-25',
      documentType: 'KZ',
      headerText: 'سداد مستحقات مصفاة ينبع مع خصم تعجيل دفع 2%',
      reference: 'PAY-2026-000001',
      totalDebit: 483000,
      totalCredit: 483000,
      lines: [
        { lineNumber: 1, postingKey: '21', accountNumber: '201010', accountName: 'الذمم الدائنة التجارية (موردي الوقود والمعدات)', debit: 483000, credit: 0, lineText: 'سداد كامل الفاتورة' },
        { lineNumber: 2, postingKey: '50', accountNumber: '101010', accountName: 'النقدية بالبنوك المحلية (الراجحي / الأهلي)', debit: 0, credit: 473340, lineText: 'تحويل بنكي صادر عبر سداد' },
        { lineNumber: 3, postingKey: '50', accountNumber: '403010', accountName: 'إيرادات عقود الصيانة والخدمات الفنية (خصم تعجيل الدفع)', debit: 0, credit: 9660, lineText: 'خصم تعجيل دفع مكتسب 2%' },
      ],
      createdBy: 'usr-admin-1',
      createdAt: now,
      updatedBy: 'usr-admin-1',
      updatedAt: now,
      version: 1,
      isDeleted: false,
    });

    // 5. Fleet Operating & Maintenance Expenses (SA: Dr Fuel 85,000 / Dr Maint 45,000 / Cr Bank 130,000 SAR)
    jes.push({
      id: 'je-2026-000005',
      docNumber: 'JE-2026-000005',
      status: 'posted',
      companyCode: '1000',
      fiscalYear: '2026',
      period: 9,
      postingDate: '2026-09-10',
      documentDate: '2026-09-10',
      documentType: 'SA',
      headerText: 'تحميل تكاليف وقود وصيانة شاحنات الأسطول لمركز التكلفة CC-1002',
      reference: 'TRIP-EXP-09',
      totalDebit: 130000,
      totalCredit: 130000,
      lines: [
        { lineNumber: 1, postingKey: '40', accountNumber: '603010', accountName: 'وقود تشغيل الشاحنات ومعدات النقل', debit: 85000, credit: 0, costCenter: 'CC-1002', lineText: 'استهلاك وقود شاحنات نقل المنطقة الغربية' },
        { lineNumber: 2, postingKey: '40', accountNumber: '602010', accountName: 'مصروفات صيانة وإصلاح أسطول الصهاريج', debit: 45000, credit: 0, costCenter: 'CC-1002', lineText: 'صيانة دورية للمضخات والصهاريج' },
        { lineNumber: 3, postingKey: '50', accountNumber: '101010', accountName: 'النقدية بالبنوك المحلية (الراجحي / الأهلي)', debit: 0, credit: 130000, lineText: 'مدفوعات مصرفية لنفقات العمليات' },
      ],
      createdBy: 'usr-admin-1',
      createdAt: now,
      updatedBy: 'usr-admin-1',
      updatedAt: now,
      version: 1,
      isDeleted: false,
    });

    // 6. Monthly Fixed Assets Depreciation Run (SA: Dr Dep Exp 185,400 / Cr AccDep 185,400 SAR)
    jes.push({
      id: 'je-2026-000006',
      docNumber: 'JE-2026-000006',
      status: 'posted',
      companyCode: '1000',
      fiscalYear: '2026',
      period: 9,
      postingDate: '2026-09-30',
      documentDate: '2026-09-30',
      documentType: 'SA',
      headerText: 'ترحيل قيد استهلاك الأصول الرأسمالية والمعدات لدورة سبتمبر 2026 (AFAB)',
      reference: 'DEP-2026-000001',
      totalDebit: 185400,
      totalCredit: 185400,
      lines: [
        { lineNumber: 1, postingKey: '40', accountNumber: '701010', accountName: 'استهلاك صهاريج وشاحنات الأسطول', debit: 110400, credit: 0, costCenter: 'CC-1001', lineText: 'استهلاك الشاحنات والصهاريج' },
        { lineNumber: 2, postingKey: '40', accountNumber: '701020', accountName: 'استهلاك خزانات الوقود والمضخات', debit: 75000, credit: 0, costCenter: 'CC-1003', lineText: 'استهلاك الخزانات ومحطات الضخ' },
        { lineNumber: 3, postingKey: '50', accountNumber: '150090', accountName: 'مجمع استهلاك الأصول الثابتة', debit: 0, credit: 185400, lineText: 'إضافة لمجمع الاستهلاك التراكمي' },
      ],
      createdBy: 'usr-admin-1',
      createdAt: now,
      updatedBy: 'usr-admin-1',
      updatedAt: now,
      version: 1,
      isDeleted: false,
    });

    // 7. Energy Sales Revenue Invoice (DR: Dr AR 920,000 / Cr Revenue 800,000 / Cr VAT 120,000 SAR)
    jes.push({
      id: 'je-2026-000007',
      docNumber: 'JE-2026-000007',
      status: 'posted',
      companyCode: '1000',
      fiscalYear: '2026',
      period: 9,
      postingDate: '2026-09-18',
      documentDate: '2026-09-18',
      documentType: 'DR',
      headerText: 'إصدار فاتورة مبيعات وقود ديزل لشركة كهرباء المنطقة الوسطى (ARINV-00001)',
      reference: 'ARINV-2026-000001',
      totalDebit: 920000,
      totalCredit: 920000,
      lines: [
        { lineNumber: 1, postingKey: '01', accountNumber: '110010', accountName: 'الذمم المدينة التجارية (عملاء الطاقة)', debit: 920000, credit: 0, lineText: 'استحقاق مبيعات وقود ديزل' },
        { lineNumber: 2, postingKey: '50', accountNumber: '401010', accountName: 'إيرادات مبيعات وقود الديزل الصناعي', debit: 0, credit: 800000, lineText: 'إيرادات مبيعات طاقة' },
        { lineNumber: 3, postingKey: '50', accountNumber: '202010', accountName: 'ضريبة القيمة المضافة المستحقة (ZATCA)', debit: 0, credit: 120000, lineText: 'ضريبة مخرجات مبيعات 15%' },
      ],
      createdBy: 'usr-admin-1',
      createdAt: now,
      updatedBy: 'usr-admin-1',
      updatedAt: now,
      version: 1,
      isDeleted: false,
    });

    // 8. Customer Collection Receipt (DZ: Dr Bank 650,000 / Cr AR 650,000 SAR)
    jes.push({
      id: 'je-2026-000008',
      docNumber: 'JE-2026-000008',
      status: 'posted',
      companyCode: '1000',
      fiscalYear: '2026',
      period: 9,
      postingDate: '2026-09-28',
      documentDate: '2026-09-28',
      documentType: 'DZ',
      headerText: 'تحصيل دفعة بنكية من شركة كهرباء المنطقة الوسطى بموجب تحويل سريع',
      reference: 'ARPAY-2026-000001',
      totalDebit: 650000,
      totalCredit: 650000,
      lines: [
        { lineNumber: 1, postingKey: '40', accountNumber: '101010', accountName: 'النقدية بالبنوك المحلية (الراجحي / الأهلي)', debit: 650000, credit: 0, lineText: 'إيداع بنكي متحصلات عملاء' },
        { lineNumber: 2, postingKey: '15', accountNumber: '110010', accountName: 'الذمم المدينة التجارية (عملاء الطاقة)', debit: 0, credit: 650000, lineText: 'تخفيض ذمة العميل' },
      ],
      createdBy: 'usr-admin-1',
      createdAt: now,
      updatedBy: 'usr-admin-1',
      updatedAt: now,
      version: 1,
      isDeleted: false,
    });

    // 9. Parked Document (FBV1: Draft)
    jes.push({
      id: 'je-2026-000009',
      docNumber: 'JE-2026-000009',
      status: 'draft',
      companyCode: '1000',
      fiscalYear: '2026',
      period: 10,
      postingDate: '2026-10-02',
      documentDate: '2026-10-02',
      documentType: 'SA',
      headerText: 'مسودة قيد تسوية نفقات تسويق وتوسعة المحطات (قيد المراجعة والاعتماد)',
      reference: 'PARK-OCT-01',
      totalDebit: 45000,
      totalCredit: 45000,
      lines: [
        { lineNumber: 1, postingKey: '40', accountNumber: '600001', accountName: 'مصاريف تسويق وترويج', debit: 45000, credit: 0, costCenter: 'CC-1004', lineText: 'حملة تسويقية لمحطات الوقود' },
        { lineNumber: 2, postingKey: '50', accountNumber: '201010', accountName: 'الذمم الدائنة التجارية (موردي الوقود والمعدات)', debit: 0, credit: 45000, lineText: 'مستحقات وكالة الدعاية' },
      ],
      isParked: true,
      parkedBy: 'usr-admin-1',
      createdBy: 'usr-admin-1',
      createdAt: now,
      updatedBy: 'usr-admin-1',
      updatedAt: now,
      version: 1,
      isDeleted: false,
    });

    await db.transaction('rw', [db.journalEntries, db.customerInvoices, db.customerReceipts, db.vendorInvoices], async () => {
      for (const je of jes) {
        await db.journalEntries.put(je);
      }

      // Seed 2 sample Customer Invoices
      await db.customerInvoices.put({
        id: 'cinv-1',
        docNumber: 'ARINV-2026-000001',
        status: 'approved',
        customerCode: 'CUST-001',
        customerName: 'شركة كهرباء المنطقة الوسطى',
        invoiceDate: '2026-09-18',
        postingDate: '2026-09-18',
        dueDate: '2026-10-18',
        totalAmount: 920000,
        vatAmount: 120000,
        netAmount: 800000,
        paymentStatus: 'PartiallyPaid',
        items: [{ lineItem: 1, description: 'توريد وقود ديزل صناعي لمحطة التوليد 500,000L', amount: 800000, vatRate: 0.15, vatAmount: 120000, totalWithVat: 920000 }],
        jeDocNumber: 'JE-2026-000007',
        createdBy: 'usr-admin-1',
        createdAt: now,
        updatedBy: 'usr-admin-1',
        updatedAt: now,
        version: 1,
        isDeleted: false,
      });

      await db.customerInvoices.put({
        id: 'cinv-2',
        docNumber: 'ARINV-2026-000002',
        status: 'approved',
        customerCode: 'CUST-002',
        customerName: 'مؤسسة النقل والتوزيع الوطنية',
        invoiceDate: '2026-09-25',
        postingDate: '2026-09-25',
        dueDate: '2026-10-25',
        totalAmount: 345000,
        vatAmount: 45000,
        netAmount: 300000,
        paymentStatus: 'Unpaid',
        items: [{ lineItem: 1, description: 'خدمات شحن ونقل مواد بترولية', amount: 300000, vatRate: 0.15, vatAmount: 45000, totalWithVat: 345000 }],
        createdBy: 'usr-admin-1',
        createdAt: now,
        updatedBy: 'usr-admin-1',
        updatedAt: now,
        version: 1,
        isDeleted: false,
      });

      // Seed Customer Receipt
      await db.customerReceipts.put({
        id: 'crec-1',
        docNumber: 'ARPAY-2026-000001',
        status: 'approved',
        invoiceId: 'cinv-1',
        invoiceDocNumber: 'ARINV-2026-000001',
        customerCode: 'CUST-001',
        customerName: 'شركة كهرباء المنطقة الوسطى',
        amount: 650000,
        receiptDate: '2026-09-28',
        bankAccount: '101010 - مصرف الراجحي',
        referenceNumber: 'REC-TRX-893011',
        paymentMethod: 'BankTransfer',
        jeDocNumber: 'JE-2026-000008',
        createdBy: 'usr-admin-1',
        createdAt: now,
        updatedBy: 'usr-admin-1',
        updatedAt: now,
        version: 1,
        isDeleted: false,
      });

      // Flag 2-3 vendor invoices as blocked with reasons for MRBR
      const sampleInvs = await db.vendorInvoices.toArray();
      if (sampleInvs.length > 3) {
        sampleInvs[0].isPaymentBlocked = true;
        sampleInvs[0].blockingReasons = ['PriceVariance'];
        sampleInvs[0].paymentTerms = '2/10 Net 30';
        sampleInvs[0].cashDiscountPercentage = 2;
        sampleInvs[0].cashDiscountDays = 10;
        await db.vendorInvoices.put(sampleInvs[0]);

        sampleInvs[1].isPaymentBlocked = true;
        sampleInvs[1].blockingReasons = ['QuantityMismatch', 'MissingGoodsReceipt'];
        await db.vendorInvoices.put(sampleInvs[1]);

        if (sampleInvs[2]) {
          sampleInvs[2].isPaymentBlocked = false;
          sampleInvs[2].paymentTerms = '2/10 Net 30';
          sampleInvs[2].cashDiscountPercentage = 2;
          sampleInvs[2].cashDiscountDays = 15;
          await db.vendorInvoices.put(sampleInvs[2]);
        }
      }
    });
  }
}
