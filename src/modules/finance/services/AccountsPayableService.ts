import { db } from '../../../core/db';
import { AutomaticPostingEngine } from './AutomaticPostingEngine';
import { NumberRangeService } from '../../../core/services/NumberRangeService';
import { AuditService } from '../../../core/services/AuditService';
import { requirePermission } from '../../../core/security/SessionContext';
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
      const payDocNumber = await NumberRangeService.getNextNumber('PAY', fiscalYear);
      const now = new Date().toISOString();

      const payment: Payment = {
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

      // 1. Post to GL
      const postResult = await AutomaticPostingEngine.postVendorPayment({
        payment,
        discountTaken: item.cashDiscountAmount,
        createdBy: params.createdBy,
      });

      payment.jeDocNumber = postResult.jeDocNumber;

      // 2. Save Payment and update Invoice in DB
      await db.transaction('rw', [db.payments, db.vendorInvoices, db.auditLogs], async () => {
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
}
