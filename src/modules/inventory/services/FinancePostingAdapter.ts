import type { MaterialDocument, IFinancePostingService } from '../../../types/models';
import { db } from '../../../core/db';

/**
 * FinancePostingAdapter: Implementation of IFinancePostingService.
 * Serves as the Phase 8 accounting integration hook.
 * Generates an accounting document number (e.g., JE-2026-XXXXXX)
 * and prepares Journal Entry payload for SAP General Ledger.
 */
export class FinancePostingAdapter implements IFinancePostingService {
  async postInventoryMovement(doc: MaterialDocument): Promise<{ success: boolean; jeDocNumber: string }> {
    // Generate simulated Journal Entry Document Number
    const jeDocNumber = `JE-2026-MM${doc.docNumber.replace(/[^0-9]/g, '').slice(-6) || '000001'}`;

    // Calculate total movement monetary value
    const totalDebit = doc.items.reduce((acc, it) => acc + (it.totalAmount || 0), 0);

    // Save lightweight journal entry reference if desired or log entry
    try {
      const existing = await db.journalEntries.get(`je-${doc.docNumber}`);
      if (!existing && totalDebit > 0) {
        await db.journalEntries.add({
          id: `je-${doc.docNumber}`,
          docNumber: jeDocNumber,
          status: 'posted',
          companyCode: '1000',
          fiscalYear: '2026',
          period: new Date(doc.postingDate).getMonth() + 1,
          postingDate: doc.postingDate,
          documentDate: doc.documentDate,
          documentType: 'SA', // G/L account document
          headerText: `ترحيل مخزني تلقائي - مستند ${doc.docNumber} (${doc.movementType})`,
          totalDebit,
          totalCredit: totalDebit,
          lines: [
            {
              lineNumber: 1,
              accountNumber: doc.movementType.startsWith('1') || doc.movementType === '501' || doc.movementType === '701' ? '120010' : '501010',
              accountName: 'مخزون المواد والمنتجات البترولية',
              debit: doc.movementType.startsWith('1') || doc.movementType === '501' || doc.movementType === '701' ? totalDebit : 0,
              credit: doc.movementType.startsWith('1') || doc.movementType === '501' || doc.movementType === '701' ? 0 : totalDebit,
              costCenter: doc.items[0]?.costCenter,
            },
            {
              lineNumber: 2,
              accountNumber: doc.movementType === '101' ? '201010' : '501020',
              accountName: doc.movementType === '101' ? 'الذمم الدائنة التجارية (موردي المواد)' : 'حساب تسوية المخزون والتكلفة',
              debit: doc.movementType.startsWith('1') || doc.movementType === '501' || doc.movementType === '701' ? 0 : totalDebit,
              credit: doc.movementType.startsWith('1') || doc.movementType === '501' || doc.movementType === '701' ? totalDebit : 0,
              costCenter: doc.items[0]?.costCenter,
            },
          ],
          createdBy: doc.createdBy,
          createdAt: new Date().toISOString(),
          updatedBy: doc.createdBy,
          updatedAt: new Date().toISOString(),
          version: 1,
          isDeleted: false,
        });
      }
    } catch (e) {
      console.warn('[FinancePostingAdapter] Auto-posting journal entry simulated:', e);
    }

    return {
      success: true,
      jeDocNumber,
    };
  }
}

export const financePostingService = new FinancePostingAdapter();
