import { db } from '../../../core/db';
import { AutomaticPostingEngine } from './AutomaticPostingEngine';
import { NumberRangeService } from '../../../core/services/NumberRangeService';
import { AuditService } from '../../../core/services/AuditService';
import { requirePermission } from '../../../core/security/SessionContext';
import { DependencyGuard } from '../../../core/security/DependencyGuard';
import { ConcurrencyError } from '../../../core/errors';
import type { VendorInvoice, Payment, Vendor } from '../../../types/models';

export interface AgingBucket {
  current: number; // 0-30 days
  days30To60: number; // 31-60 days
  days60To90: number; // 61-90 days
  over90: number; // >90 days
  total: number;
}

export interface VendorAgingItem {
  vendorCode: string;
  vendorName: string;
  buckets: AgingBucket;
  openInvoiceCount: number;
}

export interface PaymentProposalItem {
  invoiceId: string;
  invoiceDocNumber: string;
  vendorInvoiceNumber: string;
  vendorCode: string;
  vendorName: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  cashDiscountAmount: number;
  netPaymentAmount: number;
  paymentTerms: string;
  isBlocked: boolean;
  selected: boolean;
}

export class AccountsPayableService {
  /**
   * Retrieves vendor ledger statement (كشف حساب المورد).
   */
  static async getVendorLedger(
    vendorCode: string,
    fromDate?: string,
    toDate?: string
  ): Promise<{
    vendor: Vendor | undefined;
    transactions: {
      date: string;
      docNumber: string;
      docType: string;
      description: string;
      debit: number; // Payments
      credit: number; // Invoices
      balance: number; // Running balance
      referenceDocNumber?: string;
    }[];
    totalDebit: number;
    totalCredit: number;
    closingBalance: number;
  }> {
    const vendor = await db.vendors.where('vendorCode').equals(vendorCode).first();

    const invoices = await db.vendorInvoices
      .where('vendorCode')
      .equals(vendorCode)
      .filter((inv) => !inv.isDeleted)
      .toArray();

    const payments = await db.payments
      .where('vendorCode')
      .equals(vendorCode)
      .filter((p) => !p.isDeleted)
      .toArray();

    type RawTx = {
      date: string;
      docNumber: string;
      docType: string;
      description: string;
      debit: number;
      credit: number;
      referenceDocNumber?: string;
    };

    const rawList: RawTx[] = [];

    for (const inv of invoices) {
      if (fromDate && inv.invoiceDate < fromDate) continue;
      if (toDate && inv.invoiceDate > toDate) continue;

      rawList.push({
        date: inv.invoiceDate,
        docNumber: inv.docNumber,
        docType: 'RE',
        description: `فاتورة مشتريات رقم ${inv.vendorInvoiceNumber}`,
        debit: 0,
        credit: inv.totalAmount,
        referenceDocNumber: inv.jeDocNumber,
      });
    }

    for (const pay of payments) {
      if (fromDate && pay.paymentDate < fromDate) continue;
      if (toDate && pay.paymentDate > toDate) continue;

      rawList.push({
        date: pay.paymentDate,
        docNumber: pay.docNumber,
        docType: 'KZ',
        description: `سند صرف وسداد بنكي (${pay.referenceNumber})`,
        debit: pay.amount,
        credit: 0,
        referenceDocNumber: pay.jeDocNumber,
      });
    }

    // Sort chronologically
    rawList.sort((a, b) => a.date.localeCompare(b.date));

    let runningBalance = 0;
    let totalDebit = 0;
    let totalCredit = 0;

    const transactions = rawList.map((tx) => {
      runningBalance += tx.credit - tx.debit;
      totalDebit += tx.debit;
      totalCredit += tx.credit;
      return {
        ...tx,
        balance: runningBalance,
      };
    });

    return {
      vendor,
      transactions,
      totalDebit,
      totalCredit,
      closingBalance: runningBalance,
    };
  }

  /**
   * Generates AP Aging Report (أعمار ديون الموردين).
   */
  static async getAgingReport(): Promise<{
    overall: AgingBucket;
    vendorItems: VendorAgingItem[];
  }> {
    const invoices = await db.vendorInvoices
      .filter((inv) => !inv.isDeleted && inv.paymentStatus !== 'Paid')
      .toArray();

    const vendors = await db.vendors.filter((v) => !v.isDeleted).toArray();
    const vendorMap = new Map(vendors.map((v) => [v.vendorCode, v.name]));

    const now = new Date();

    const overall: AgingBucket = {
      current: 0,
      days30To60: 0,
      days60To90: 0,
      over90: 0,
      total: 0,
    };

    const vendorBuckets = new Map<string, { bucket: AgingBucket; count: number }>();

    for (const inv of invoices) {
      const dueDate = new Date(inv.dueDate);
      const diffTime = now.getTime() - dueDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const amount = inv.totalAmount;

      if (!vendorBuckets.has(inv.vendorCode)) {
        vendorBuckets.set(inv.vendorCode, {
          bucket: { current: 0, days30To60: 0, days60To90: 0, over90: 0, total: 0 },
          count: 0,
        });
      }

      const vb = vendorBuckets.get(inv.vendorCode)!;
      vb.count += 1;
      vb.bucket.total += amount;
      overall.total += amount;

      if (diffDays <= 30) {
        vb.bucket.current += amount;
        overall.current += amount;
      } else if (diffDays <= 60) {
        vb.bucket.days30To60 += amount;
        overall.days30To60 += amount;
      } else if (diffDays <= 90) {
        vb.bucket.days60To90 += amount;
        overall.days60To90 += amount;
      } else {
        vb.bucket.over90 += amount;
        overall.over90 += amount;
      }
    }

    const vendorItems: VendorAgingItem[] = [];
    for (const [code, { bucket, count }] of vendorBuckets.entries()) {
      vendorItems.push({
        vendorCode: code,
        vendorName: vendorMap.get(code) || code,
        buckets: bucket,
        openInvoiceCount: count,
      });
    }

    // Sort by largest debt first
    vendorItems.sort((a, b) => b.buckets.total - a.buckets.total);

    return { overall, vendorItems };
  }

  /**
   * Generates Payment Proposal Run (F110 - اقتراح أوامر الدفع للموردين).
   */
  static async generatePaymentProposal(params: {
    cutoffDate: string;
    vendorCode?: string;
  }): Promise<PaymentProposalItem[]> {
    let query = db.vendorInvoices.filter(
      (inv) => !inv.isDeleted && inv.paymentStatus !== 'Paid' && inv.dueDate <= params.cutoffDate
    );

    if (params.vendorCode) {
      const vc = params.vendorCode;
      query = query.filter((inv) => inv.vendorCode === vc);
    }

    const invoices = await query.toArray();
    const vendors = await db.vendors.toArray();
    const vendorMap = new Map(vendors.map((v) => [v.vendorCode, v.name]));

    const todayStr = new Date().toISOString().split('T')[0];

    const proposal: PaymentProposalItem[] = invoices.map((inv) => {
      let discountAmount = 0;
      if (inv.cashDiscountPercentage && inv.cashDiscountDays) {
        const invD = new Date(inv.invoiceDate);
        const discountDeadline = new Date(invD.getTime() + inv.cashDiscountDays * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];

        if (todayStr <= discountDeadline) {
          discountAmount = Math.round((inv.totalAmount * (inv.cashDiscountPercentage / 100)) * 100) / 100;
        }
      }

      const netPayment = Math.round((inv.totalAmount - discountAmount) * 100) / 100;
      const isBlocked = !!inv.isPaymentBlocked;

      return {
        invoiceId: inv.id,
        invoiceDocNumber: inv.docNumber,
        vendorInvoiceNumber: inv.vendorInvoiceNumber,
        vendorCode: inv.vendorCode,
        vendorName: vendorMap.get(inv.vendorCode) || inv.vendorName || inv.vendorCode,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        totalAmount: inv.totalAmount,
        cashDiscountAmount: discountAmount,
        netPaymentAmount: netPayment,
        paymentTerms: inv.paymentTerms || 'Net 30',
        isBlocked,
        selected: !isBlocked, // Selected by default if not blocked
      };
    });

    return proposal.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }

  /**
   * Creates and posts a vendor invoice (فاتورة مورد - FB60 / MIRO) atomically to AP and GL.
   */
  static async createInvoice(
    invoiceData: {
      vendorCode: string;
      vendorName?: string;
      poNumber?: string;
      grNumber?: string;
      vendorInvoiceNumber: string;
      invoiceDate: string;
      postingDate?: string;
      dueDate: string;
      totalAmount: number;
      vatAmount: number;
      netAmount: number;
      paymentTerms?: string;
      cashDiscountPercentage?: number;
      cashDiscountDays?: number;
      items: import('../../../types/models').VendorInvoiceItem[];
      companyCode?: string;
      currency?: string;
    },
    createdBy: string = 'admin'
  ): Promise<VendorInvoice> {
    requirePermission({ module: 'FI', activity: 'post' }, { amount: invoiceData.totalAmount });
    const postingDate = invoiceData.postingDate || invoiceData.invoiceDate;
    const fiscalYear = invoiceData.invoiceDate.split('-')[0] || '2026';

    const txTables = [
      db.vendorInvoices,
      db.journalEntries,
      db.postingRegistry,
      db.numberRanges,
      db.auditLogs,
      db.accountDeterminations,
      db.fiscalPeriods,
    ];

    let createdInvoice!: VendorInvoice;

    await db.transaction('rw', txTables, async () => {
      const docNumber = await NumberRangeService.getNextNumber('INV', fiscalYear);
      const now = new Date().toISOString();

      createdInvoice = {
        ...invoiceData,
        id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        docNumber,
        status: 'approved',
        companyCode: invoiceData.companyCode || '1000',
        postingDate,
        paymentStatus: 'Unpaid',
        jeDocNumber: '',
        createdBy,
        createdAt: now,
        updatedBy: createdBy,
        updatedAt: now,
        version: 1,
        isDeleted: false,
      };

      await db.vendorInvoices.add(createdInvoice);

      const postResult = await AutomaticPostingEngine.postVendorInvoice({
        invoice: createdInvoice,
        createdBy,
      });

      createdInvoice.jeDocNumber = postResult.jeDocNumber;
      await db.vendorInvoices.update(createdInvoice.id, {
        jeDocNumber: postResult.jeDocNumber,
      });

      await AuditService.log({
        userId: createdBy,
        action: 'CREATE',
        entity: 'VendorInvoice',
        entityId: createdInvoice.id,
        after: createdInvoice as unknown as Record<string, unknown>,
      });
    });

    return createdInvoice;
  }

  /**
   * Executes Payment Proposal Run (F110 / F-53):
   * Creates Payment document, posts balanced Journal Entry, updates invoice status to Paid.
   */
  static async executePaymentProposal(params: {
    items: PaymentProposalItem[];
    bankAccount: string;
    paymentDate: string;
    createdBy: string;
  }): Promise<{ successfulPayments: Payment[]; totalPaid: number; totalDiscounts: number }> {
    requirePermission({ module: 'FI', activity: 'post' });
    const selected = params.items.filter((item) => item.selected && !item.isBlocked);
    if (selected.length === 0) {
      throw new Error('لم يتم تحديد أي فواتير معتمدة للصرف والدفع.');
    }

    const successfulPayments: Payment[] = [];
    let totalPaid = 0;
    let totalDiscounts = 0;

    const fiscalYear = new Date(params.paymentDate).getFullYear().toString();

    for (const item of selected) {
      const txTables = [
        db.payments,
        db.vendorInvoices,
        db.journalEntries,
        db.postingRegistry,
        db.numberRanges,
        db.auditLogs,
        db.accountDeterminations,
        db.fiscalPeriods,
      ];

      let payment!: Payment;

      await db.transaction('rw', txTables, async () => {
        const payDocNumber = await NumberRangeService.getNextNumber('PAY', fiscalYear);
        const now = new Date().toISOString();

        payment = {
          id: `pay-${payDocNumber}`,
          docNumber: payDocNumber,
          status: 'approved',
          invoiceId: item.invoiceId,
          invoiceDocNumber: item.invoiceDocNumber,
          vendorCode: item.vendorCode,
          vendorName: item.vendorName,
          amount: item.totalAmount,
          discountTaken: item.cashDiscountAmount,
          netPaidAmount: item.netPaymentAmount,
          paymentDate: params.paymentDate,
          bankAccount: params.bankAccount,
          referenceNumber: `TRX-${Date.now()}-${payDocNumber.slice(-4)}`,
          paymentMethod: 'BankTransfer',
          createdBy: params.createdBy,
          createdAt: now,
          updatedBy: params.createdBy,
          updatedAt: now,
          version: 1,
          isDeleted: false,
        };

        // 1. Post to GL inside the same transaction
        const postResult = await AutomaticPostingEngine.postVendorPayment({
          payment,
          discountTaken: item.cashDiscountAmount,
          createdBy: params.createdBy,
        });

        payment.jeDocNumber = postResult.jeDocNumber;

        // 2. Save Payment and update Invoice in DB
        await db.payments.add(payment);
        await db.vendorInvoices.update(item.invoiceId, {
          paymentStatus: 'Paid',
          updatedAt: now,
        });

        await AuditService.log({
          userId: params.createdBy,
          action: 'CREATE',
          entity: 'Payment',
          entityId: payment.id,
          after: payment as unknown as Record<string, unknown>,
        });
      });

      successfulPayments.push(payment);
      totalPaid += item.netPaymentAmount;
      totalDiscounts += item.cashDiscountAmount;
    }

    return { successfulPayments, totalPaid, totalDiscounts };
  }

  /**
   * Cancels/reverses a posted vendor invoice (إلغاء وعكس فاتورة مورد).
   * Checks dependencies via DependencyGuard, reverses the GL posting, and marks the invoice cancelled.
   */
  static async cancelInvoice(
    invoiceId: string,
    reason: string,
    userId: string = 'admin',
    expectedVersion?: number
  ): Promise<{ invoice: VendorInvoice; reversalDocNumber: string }> {
    requirePermission({ module: 'FI', activity: 'reverse' });
    if (!reason || reason.trim().length === 0) {
      throw new Error('سبب الإلغاء والعكس إلزامي.');
    }

    const invoice = await db.vendorInvoices.get(invoiceId);
    if (!invoice || invoice.isDeleted) {
      throw new Error('فاتورة المورد غير موجودة.');
    }

    if (expectedVersion !== undefined) {
      const storedVer = typeof invoice.version === 'number' ? invoice.version : 1;
      if (storedVer !== expectedVersion) {
        throw new ConcurrencyError('تم تعديل هذا السجل بواسطة مستخدم آخر. أعد التحميل ثم حاول مجدداً.');
      }
    }

    if (invoice.status === 'cancelled' || invoice.paymentStatus === 'Cancelled') {
      throw new Error('تم إلغاء/عكس هذه الفاتورة مسبقاً.');
    }

    // Check downstream dependencies (e.g. active payments)
    await DependencyGuard.checkCancel('vendorInvoices', invoice.id);

    let reversalDocNumber = '';

    const txTables = [
      db.vendorInvoices,
      db.journalEntries,
      db.postingRegistry,
      db.numberRanges,
      db.auditLogs,
      db.fiscalPeriods,
    ];

    await db.transaction('rw', txTables, async () => {
      // 1. Reverse GL posting if journal entry was created
      if (invoice.jeDocNumber) {
        const revResult = await AutomaticPostingEngine.reversePosting({
          sourceType: 'VENDOR_INVOICE',
          sourceId: invoice.id,
          reason,
          userId,
        });
        reversalDocNumber = revResult.reversalDocNumber;
      }

      // 2. Update invoice status to cancelled
      const now = new Date().toISOString();
      const updated: VendorInvoice = {
        ...invoice,
        status: 'cancelled',
        paymentStatus: 'Cancelled' as unknown as 'Unpaid',
        releaseReason: `ملغاة: ${reason}`,
        updatedBy: userId,
        updatedAt: now,
        version: invoice.version + 1,
      };

      await db.vendorInvoices.put(updated);

      await AuditService.log({
        userId,
        action: 'STATUS_CHANGE',
        entity: 'VendorInvoice',
        entityId: invoice.id,
        before: invoice as unknown as Record<string, unknown>,
        after: updated as unknown as Record<string, unknown>,
      });
    });

    const finalInvoice = (await db.vendorInvoices.get(invoice.id))!;
    return { invoice: finalInvoice, reversalDocNumber };
  }
}
