import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../core/db';
import { TolerancePolicyService } from '../core/services/TolerancePolicyService';
import { ThreeWayMatchService } from '../modules/finance/services/ThreeWayMatchService';
import type { VendorInvoice, PurchaseOrder, GoodsReceipt } from '../types/models';

describe('TolerancePolicyService & 3-Way Match Tolerances', () => {
  beforeEach(async () => {
    await db.settings.clear();
    await db.purchaseOrders.clear();
    await db.goodsReceipts.clear();
    await db.vendorInvoices.clear();
  });

  it('reads global fallback settings when no company-specific row exists', async () => {
    await TolerancePolicyService.set({
      pricePercent: 4.5,
      quantityPercent: 7.0,
      amountAbsolute: 50.0,
    });

    const policy = await TolerancePolicyService.get('1000');
    expect(policy.pricePercent).toBe(4.5);
    expect(policy.quantityPercent).toBe(7.0);
    expect(policy.amountAbsolute).toBe(50.0);
  });

  it('prefers company-specific tolerance settings over global fallback', async () => {
    // Global fallback
    await TolerancePolicyService.set({
      pricePercent: 3.0,
      quantityPercent: 5.0,
      amountAbsolute: 0.0,
    });

    // Company-specific for 2000
    await TolerancePolicyService.set(
      {
        pricePercent: 1.5,
        quantityPercent: 2.0,
        amountAbsolute: 10.0,
      },
      '2000'
    );

    const globalPolicy = await TolerancePolicyService.get('1000');
    expect(globalPolicy.pricePercent).toBe(3.0);
    expect(globalPolicy.quantityPercent).toBe(5.0);

    const compPolicy = await TolerancePolicyService.get('2000');
    expect(compPolicy.pricePercent).toBe(1.5);
    expect(compPolicy.quantityPercent).toBe(2.0);
    expect(compPolicy.amountAbsolute).toBe(10.0);
  });

  it('validates percentage 0..100 and non-negative amounts', async () => {
    expect(() =>
      TolerancePolicyService.validate({
        pricePercent: -1,
        quantityPercent: 5,
        amountAbsolute: 0,
      })
    ).toThrow();

    expect(() =>
      TolerancePolicyService.validate({
        pricePercent: 101,
        quantityPercent: 5,
        amountAbsolute: 0,
      })
    ).toThrow();

    expect(() =>
      TolerancePolicyService.validate({
        pricePercent: 5,
        quantityPercent: -0.1,
        amountAbsolute: 0,
      })
    ).toThrow();

    expect(() =>
      TolerancePolicyService.validate({
        pricePercent: 5,
        quantityPercent: 105,
        amountAbsolute: 0,
      })
    ).toThrow();

    expect(() =>
      TolerancePolicyService.validate({
        pricePercent: 5,
        quantityPercent: 5,
        amountAbsolute: -10,
      })
    ).toThrow();

    expect(() =>
      TolerancePolicyService.validate({
        pricePercent: 0,
        quantityPercent: 100,
        amountAbsolute: 0,
      })
    ).not.toThrow();
  });

  it('evaluates invoice matching according to configured company tolerance policy', async () => {
    // Configure strict tolerances for company 1000: 2% price, 2% quantity, 0 SAR absolute
    await TolerancePolicyService.set(
      {
        pricePercent: 2.0,
        quantityPercent: 2.0,
        amountAbsolute: 0,
      },
      '1000'
    );

    const po: PurchaseOrder = {
      id: 'po-test-1',
      docNumber: 'PO-2026-0001',
      version: 1,
      status: 'approved',
      vendorCode: 'V-100',
      vendorName: 'Saudi Equipment',
      companyCode: '1000',
      plantCode: '1100',
      orderDate: '2026-01-01',
      deliveryDate: '2026-01-10',
      totalAmount: 10000,
      currency: 'SAR',
      paymentTerms: 'Net 30',
      items: [
        {
          lineItem: 1,
          materialCode: 'M-1',
          materialName: 'Valves',
          quantity: 100,
          receivedQuantity: 100,
          unit: 'EA',
          unitPrice: 100,
          totalPrice: 10000,
          storageLocation: 'SL-1',
        },
      ],
      createdAt: '2026-01-01T00:00:00Z',
      createdBy: 'usr-buyer',
      updatedAt: '2026-01-01T00:00:00Z',
      updatedBy: 'usr-buyer',
      isDeleted: false,
    };
    await db.purchaseOrders.put(po);

    const gr: GoodsReceipt = {
      id: 'gr-test-1',
      docNumber: 'GR-2026-0001',
      version: 1,
      status: 'posted',
      poNumber: 'PO-2026-0001',
      vendorCode: 'V-100',
      plantCode: '1100',
      deliveryNoteNumber: 'DN-001',
      movementType: '101',
      postingDate: '2026-01-05',
      items: [
        {
          lineItem: 1,
          materialCode: 'M-1',
          materialName: 'Valves',
          quantity: 100,
          unit: 'EA',
          storageLocation: 'SL-1',
        },
      ],
      createdAt: '2026-01-05T00:00:00Z',
      createdBy: 'usr-wh',
      updatedAt: '2026-01-05T00:00:00Z',
      updatedBy: 'usr-wh',
      isDeleted: false,
    };
    await db.goodsReceipts.put(gr);

    // Invoice with 2.5% price increase (10,250 vs 10,000) -> should be BLOCKED because policy is 2.0%
    const invoiceOverPrice: VendorInvoice = {
      id: 'inv-test-1',
      docNumber: 'INV-2026-0001',
      version: 1,
      status: 'posted',
      vendorCode: 'V-100',
      poNumber: 'PO-2026-0001',
      vendorInvoiceNumber: 'VINV-001',
      invoiceDate: '2026-01-06',
      postingDate: '2026-01-06',
      dueDate: '2026-02-06',
      totalAmount: 10250,
      vatAmount: 0,
      netAmount: 10250,
      paymentStatus: 'Unpaid',
      items: [
        {
          lineItem: 1,
          description: 'Valves',
          quantity: 100,
          amount: 10250,
          vatRate: 0,
          vatAmount: 0,
          totalWithVat: 10250,
        },
      ],
      createdAt: '2026-01-06T00:00:00Z',
      createdBy: 'usr-ap',
      updatedAt: '2026-01-06T00:00:00Z',
      updatedBy: 'usr-ap',
      isDeleted: false,
    };

    const resOver = await ThreeWayMatchService.evaluateInvoice(invoiceOverPrice);
    expect(resOver.isBlocked).toBe(true);
    expect(resOver.reasons).toContain('PriceVariance');

    // Invoice with 1.5% price increase (10,150 vs 10,000) -> should MATCH within 2.0% policy
    const invoiceWithin: VendorInvoice = {
      ...invoiceOverPrice,
      id: 'inv-test-2',
      totalAmount: 10150,
      netAmount: 10150,
      items: [{ ...invoiceOverPrice.items[0], amount: 10150, totalWithVat: 10150 }],
    };

    const resWithin = await ThreeWayMatchService.evaluateInvoice(invoiceWithin);
    expect(resWithin.isBlocked).toBe(false);
    expect(resWithin.isMatched).toBe(true);
  });
});
