import { db } from '../../../core/db';
import { AuditService } from '../../../core/services/AuditService';
import { requirePermission } from '../../../core/security/SessionContext';
import { TolerancePolicyService } from '../../../core/services/TolerancePolicyService';
import type { VendorInvoice, BlockingReason, PurchaseOrder, GoodsReceipt } from '../../../types/models';

export interface MatchResult {
  isMatched: boolean;
  isBlocked: boolean;
  reasons: BlockingReason[];
  details: {
    poFound: boolean;
    grFound: boolean;
    poTotal: number;
    grQuantityTotal: number;
    invoiceQuantityTotal: number;
    priceVarianceAmount: number;
    priceVariancePercent: number;
  };
}

export class ThreeWayMatchService {
  /**
   * Performs 3-Way Match between Vendor Invoice, Purchase Order, and Goods Receipt(s).
   * Reads configured tolerance policy for the company code (or global fallback).
   */
  static async evaluateInvoice(invoice: VendorInvoice): Promise<MatchResult> {
    const reasons: BlockingReason[] = [];

    let po: PurchaseOrder | undefined;
    if (invoice.poNumber) {
      po = await db.purchaseOrders.where('docNumber').equals(invoice.poNumber).first();
    }

    if (!po) {
      // If invoice references a PO that doesn't exist, flag discrepancy
      if (invoice.poNumber) {
        reasons.push('TermsDiscrepancy');
      }
      return {
        isMatched: false,
        isBlocked: true,
        reasons,
        details: {
          poFound: false,
          grFound: false,
          poTotal: 0,
          grQuantityTotal: 0,
          invoiceQuantityTotal: 0,
          priceVarianceAmount: 0,
          priceVariancePercent: 0,
        },
      };
    }

    const companyCode = po.companyCode;
    const tolerances = await TolerancePolicyService.get(companyCode);

    // Find linked Goods Receipts
    let grs: GoodsReceipt[] = [];
    if (invoice.poNumber) {
      grs = await db.goodsReceipts
        .where('poNumber')
        .equals(invoice.poNumber)
        .filter((g) => !g.isDeleted)
        .toArray();
    }

    if (grs.length === 0) {
      reasons.push('MissingGoodsReceipt');
    }

    // Aggregate quantities from GRs vs Invoices
    const grTotalQty = grs.reduce((acc, g) => {
      const gQty = g.items?.reduce((iq, it) => iq + (it.quantity || 0), 0) || 0;
      return acc + gQty;
    }, 0);

    const invTotalQty = invoice.items.reduce((acc, it) => acc + (it.quantity || 1), 0);
    const poTotalAmount = po.totalAmount || 0;

    // Check quantity discrepancy against configured policy
    if (grs.length > 0 && invTotalQty > 0) {
      const qtyDiff = invTotalQty - grTotalQty;
      const qtyDiffPct = grTotalQty > 0 ? (qtyDiff / grTotalQty) * 100 : 100;
      if (qtyDiffPct > tolerances.quantityPercent) {
        reasons.push('QuantityMismatch');
      }
    }

    // Check price/amount variance against configured policy
    const priceDiff = invoice.totalAmount - poTotalAmount;
    const priceDiffPct = poTotalAmount > 0 ? (priceDiff / poTotalAmount) * 100 : 0;
    if (priceDiffPct > tolerances.pricePercent && priceDiff > tolerances.amountAbsolute) {
      reasons.push('PriceVariance');
    }

    const isBlocked = reasons.length > 0;

    return {
      isMatched: !isBlocked,
      isBlocked,
      reasons,
      details: {
        poFound: true,
        grFound: grs.length > 0,
        poTotal: poTotalAmount,
        grQuantityTotal: grTotalQty,
        invoiceQuantityTotal: invTotalQty,
        priceVarianceAmount: priceDiff,
        priceVariancePercent: priceDiffPct,
      },
    };
  }

  /**
   * Retrieves blocked invoices worklist (MRBR).
   */
  static async getBlockedInvoices(): Promise<VendorInvoice[]> {
    return db.vendorInvoices
      .filter((inv) => !inv.isDeleted && !!inv.isPaymentBlocked)
      .toArray();
  }

  /**
   * Releases a blocked invoice (MRBR Release Workflow).
   * Unblocks payment and records audit trail.
   */
  static async releaseBlockedInvoice(
    invoiceId: string,
    reason: string,
    releasedByUserId: string
  ): Promise<VendorInvoice> {
    requirePermission({ module: 'FI', activity: 'approve' });
    const invoice = await db.vendorInvoices.get(invoiceId);
    if (!invoice) throw new Error('فاتورة المورد غير موجودة.');
    if (!invoice.isPaymentBlocked) throw new Error('الفاتورة غير محجوبة بالفعل.');

    const before = { ...invoice };
    const now = new Date().toISOString();

    const updated: VendorInvoice = {
      ...invoice,
      isPaymentBlocked: false,
      releasedBy: releasedByUserId,
      releasedAt: now,
      releaseReason: reason,
      updatedBy: releasedByUserId,
      updatedAt: now,
      version: invoice.version + 1,
    };

    await db.transaction('rw', [db.vendorInvoices, db.auditLogs], async () => {
      await db.vendorInvoices.put(updated);
      await AuditService.log({
        userId: releasedByUserId,
        action: 'STATUS_CHANGE',
        entity: 'VendorInvoice',
        entityId: invoice.id,
        before: before as unknown as Record<string, unknown>,
        after: updated as unknown as Record<string, unknown>,
      });
    });

    return updated;
  }
}
