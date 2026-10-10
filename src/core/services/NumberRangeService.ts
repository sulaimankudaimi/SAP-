import { db } from '../db';
import type { NumberRange } from '../../types/models';

export class NumberRangeService {
  /**
   * Generates the next sequential document number atomically inside a Dexie transaction.
   * Format: PREFIX-YEAR-000001 (e.g., PO-2026-000001)
   */
  static async getNextNumber(docType: string, fiscalYear: string = '2026'): Promise<string> {
    const rangeId = `${docType.toUpperCase()}-${fiscalYear}`;

    const executeIncrement = async (): Promise<string> => {
      let range = await db.numberRanges.get(rangeId);

      if (!range) {
        range = {
          id: rangeId,
          docType: docType.toUpperCase(),
          fiscalYear,
          prefix: docType.toUpperCase(),
          currentNumber: 1,
          fromNumber: 1,
          toNumber: 999999,
          updatedAt: new Date().toISOString(),
          isDeleted: false,
        };
        await db.numberRanges.add(range);
        return `${range.prefix}-${fiscalYear}-${String(1).padStart(6, '0')}`;
      }

      const nextNum = range.currentNumber + 1;
      await db.numberRanges.update(rangeId, {
        currentNumber: nextNum,
        updatedAt: new Date().toISOString(),
      });

      return `${range.prefix}-${fiscalYear}-${String(nextNum).padStart(6, '0')}`;
    };

    // If an ambient transaction that includes numberRanges is already active, join it directly
    if (db.isOpen() && db.numberRanges) {
      const activeTx = (db as unknown as { _currentTransaction?: { storeNames?: string[] } })._currentTransaction;
      if (activeTx?.storeNames?.includes('numberRanges')) {
        return await executeIncrement();
      }
    }

    // Otherwise, execute inside a coordinated transaction on numberRanges
    return await db.transaction('rw', db.numberRanges, async () => {
      return await executeIncrement();
    });
  }

  /**
   * Seeds default SAP number ranges for all document types.
   */
  static async initDefaults(fiscalYear: string = '2026'): Promise<void> {
    const defaultDocTypes = [
      'PR',     // Purchase Requisition
      'RFQ',    // Request for Quotation
      'PO',     // Purchase Order
      'CTR',    // Contract
      'GR',     // Goods Receipt (MIGO)
      'GI',     // Goods Issue
      'PI',     // Physical Inventory
      'TRIP',   // Logistics Fuel Trip
      'MO',     // Maintenance Order
      'AA',     // Fixed Asset Master (AS01)
      'AST',    // Asset Transfer
      'DEP',    // Depreciation Run
      'INSP',   // Technical Asset Valuation
      'JE',     // Journal Entry
      'INV',    // Vendor Invoice
      'PAY',    // Payment Order
      'ARINV',  // Customer Invoice
      'ARPAY',  // Customer Payment
      'ALLOC',  // Cost Allocation Cycle
      'ORD',    // Internal Order
      'APR',    // Approval Request
    ];

    await db.transaction('rw', db.numberRanges, async () => {
      for (const docType of defaultDocTypes) {
        const id = `${docType}-${fiscalYear}`;
        const exists = await db.numberRanges.get(id);
        if (!exists) {
          const entry: NumberRange = {
            id,
            docType,
            fiscalYear,
            prefix: docType,
            currentNumber: 0,
            fromNumber: 1,
            toNumber: 999999,
            updatedAt: new Date().toISOString(),
            isDeleted: false,
          };
          await db.numberRanges.add(entry);
        }
      }
    });
  }
}
