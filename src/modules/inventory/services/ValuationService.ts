/**
 * ValuationService: Implements SAP-Standard Moving Average Price (MAP / V-Price)
 * and Standard Price valuation logic according to IAS 2 / SAP S/4HANA MM.
 */

export interface ValuationState {
  currentStock: number;
  currentMap: number;
  totalValuation: number;
}

export interface MapCalculationResult {
  previousStock: number;
  previousMap: number;
  newStock: number;
  newMap: number;
  totalValuation: number;
  valuationChange: number;
}

export interface ValuationTestCaseResult {
  step: string;
  action: 'RECEIPT' | 'ISSUE';
  quantity: number;
  unitPrice: number;
  expectedMap: number;
  actualMap: number;
  expectedStock: number;
  actualStock: number;
  passed: boolean;
}

export class ValuationService {
  /**
   * Calculates new Moving Average Price upon goods receipt (e.g., 101, 501, 701)
   * Formula: New MAP = ((Current Stock * Current MAP) + (Received Qty * Purchase Price)) / (Current Stock + Received Qty)
   */
  static calculateMapOnReceipt(
    currentStock: number,
    currentMap: number,
    receivedQty: number,
    purchasePrice: number
  ): MapCalculationResult {
    const safeStock = Math.max(0, currentStock);
    const safePrice = Math.max(0, currentMap);
    const safeRecvQty = Math.max(0, receivedQty);
    const safePurchPrice = Math.max(0, purchasePrice);

    const prevValuation = safeStock * safePrice;
    const incomingValuation = safeRecvQty * safePurchPrice;
    const newStock = safeStock + safeRecvQty;

    let newMap = safePrice;
    if (newStock > 0) {
      newMap = (prevValuation + incomingValuation) / newStock;
    } else {
      newMap = safePurchPrice > 0 ? safePurchPrice : safePrice;
    }

    // Round to 4 decimal places for accounting accuracy
    newMap = Math.round(newMap * 10000) / 10000;
    const totalValuation = Math.round(newStock * newMap * 100) / 100;

    return {
      previousStock: safeStock,
      previousMap: safePrice,
      newStock,
      newMap,
      totalValuation,
      valuationChange: incomingValuation,
    };
  }

  /**
   * Calculates valuation upon goods issue (e.g., 201, 261, 311, 551, 702)
   * Goods issue is valued at the CURRENT Moving Average Price.
   * The MAP does NOT change on issue.
   */
  static calculateValuationOnIssue(
    currentStock: number,
    currentMap: number,
    issueQty: number
  ): MapCalculationResult {
    const safeStock = currentStock;
    const safeMap = currentMap;
    const safeIssueQty = Math.max(0, issueQty);

    const newStock = safeStock - safeIssueQty;
    const issueValuation = safeIssueQty * safeMap;
    const totalValuation = Math.max(0, Math.round(newStock * safeMap * 100) / 100);

    return {
      previousStock: safeStock,
      previousMap: safeMap,
      newStock,
      newMap: safeMap, // MAP stays unchanged during goods issue
      totalValuation,
      valuationChange: -issueValuation,
    };
  }

  /**
   * Unit test suite verifying MAP correctness against canonical textbook SAP scenarios:
   * 1. Initial stock: 100 pcs @ 10.00 SAR -> Total: 1,000 SAR (MAP = 10.00)
   * 2. Goods Receipt: 50 pcs @ 16.00 SAR -> Total: (100*10 + 50*16) / 150 = 1,800 / 150 = 12.00 SAR (MAP = 12.00)
   * 3. Goods Issue: 30 pcs -> Remaining: 120 pcs @ 12.00 SAR (MAP remains 12.00)
   * 4. Goods Receipt: 80 pcs @ 14.25 SAR -> Total: (120*12 + 80*14.25) / 200 = (1440 + 1140) / 200 = 2,580 / 200 = 12.90 SAR
   * 5. Issue of 200 pcs -> Stock: 0, MAP remains 12.90
   * 6. Receipt into zero stock: 10 pcs @ 25.00 SAR -> Stock: 10, MAP = 25.00
   */
  static runUnitTests(): { allPassed: boolean; results: ValuationTestCaseResult[] } {
    const results: ValuationTestCaseResult[] = [];

    // Step 1: Initial state
    let stock = 100;
    let map = 10.0;

    // Step 2: Receipt of 50 pcs @ 16.00
    const res1 = this.calculateMapOnReceipt(stock, map, 50, 16.0);
    const pass1 = Math.abs(res1.newMap - 12.0) < 0.001 && res1.newStock === 150;
    results.push({
      step: '1. استلام مشتريات (101): 50 قطعة بسعر 16.00 ر.س مع رصيد سابق 100 بسعر 10.00',
      action: 'RECEIPT',
      quantity: 50,
      unitPrice: 16.0,
      expectedMap: 12.0,
      actualMap: res1.newMap,
      expectedStock: 150,
      actualStock: res1.newStock,
      passed: pass1,
    });
    stock = res1.newStock;
    map = res1.newMap;

    // Step 3: Issue of 30 pcs (MAP must stay 12.0)
    const res2 = this.calculateValuationOnIssue(stock, map, 30);
    const pass2 = Math.abs(res2.newMap - 12.0) < 0.001 && res2.newStock === 120;
    results.push({
      step: '2. صرف مخزني (201): صرف 30 قطعة لمركز تكلفة - بقاء السعر المتحرك 12.00 ر.س',
      action: 'ISSUE',
      quantity: 30,
      unitPrice: 12.0,
      expectedMap: 12.0,
      actualMap: res2.newMap,
      expectedStock: 120,
      actualStock: res2.newStock,
      passed: pass2,
    });
    stock = res2.newStock;
    map = res2.newMap;

    // Step 4: Receipt of 80 pcs @ 14.25
    // (120 * 12.00 + 80 * 14.25) / 200 = (1440 + 1140) / 200 = 2580 / 200 = 12.90
    const res3 = this.calculateMapOnReceipt(stock, map, 80, 14.25);
    const pass3 = Math.abs(res3.newMap - 12.9) < 0.001 && res3.newStock === 200;
    results.push({
      step: '3. استلام دفعة إضافية (101): 80 قطعة بسعر 14.25 ر.س -> المتوسط الجديد 12.90 ر.س',
      action: 'RECEIPT',
      quantity: 80,
      unitPrice: 14.25,
      expectedMap: 12.9,
      actualMap: res3.newMap,
      expectedStock: 200,
      actualStock: res3.newStock,
      passed: pass3,
    });
    stock = res3.newStock;
    map = res3.newMap;

    // Step 5: Full issue to zero
    const res4 = this.calculateValuationOnIssue(stock, map, 200);
    const pass4 = res4.newStock === 0 && Math.abs(res4.newMap - 12.9) < 0.001;
    results.push({
      step: '4. صرف كامل الرصيد (201): صرف 200 قطعة حتى نفاد المخزون',
      action: 'ISSUE',
      quantity: 200,
      unitPrice: 12.9,
      expectedMap: 12.9,
      actualMap: res4.newMap,
      expectedStock: 0,
      actualStock: res4.newStock,
      passed: pass4,
    });
    stock = res4.newStock;
    map = res4.newMap;

    // Step 6: Receipt into empty stock
    const res5 = this.calculateMapOnReceipt(stock, map, 10, 25.0);
    const pass5 = res5.newStock === 10 && Math.abs(res5.newMap - 25.0) < 0.001;
    results.push({
      step: '5. استلام في مخزون صفري: 10 قطع بسعر 25.00 ر.س -> المتوسط الجديد يصبح 25.00 ر.س',
      action: 'RECEIPT',
      quantity: 10,
      unitPrice: 25.0,
      expectedMap: 25.0,
      actualMap: res5.newMap,
      expectedStock: 10,
      actualStock: res5.newStock,
      passed: pass5,
    });

    const allPassed = results.every((r) => r.passed);
    return { allPassed, results };
  }
}
