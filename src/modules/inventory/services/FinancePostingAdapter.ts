import { DiagnosticLogger } from '../../../core/services/DiagnosticLogger';
import type { MaterialDocument, IFinancePostingService } from '../../../types/models';
import { AutomaticPostingEngine } from '../../finance/services/AutomaticPostingEngine';
import { SessionContext } from '../../../core/security/SessionContext';

/**
 * FinancePostingAdapter: Implementation of IFinancePostingService.
 * Seamlessly hooks inventory movements directly into the SAP General Ledger (FI-GL).
 */
export class FinancePostingAdapter implements IFinancePostingService {
  async postInventoryMovement(doc: MaterialDocument): Promise<{ success: boolean; jeDocNumber: string }> {
    const totalAmount = doc.items.reduce((acc, it) => acc + (it.totalAmount || 0), 0);
    if (totalAmount <= 0) {
      return { success: true, jeDocNumber: '' };
    }

    const actingUserId = SessionContext.getActor()?.userId || doc.createdBy;
    if (!actingUserId) {
      throw new Error('خطأ ترحيل محاسبي: لم يتم العثور على هوية المستخدم المنفذ لترحيل حركة المخزون.');
    }

    try {
      if (doc.movementType.startsWith('1') || doc.movementType === '501') {
        // Goods Receipt (MIGO 101) -> Dr. Inventory / Cr. GR-IR Clearing
        const res = await AutomaticPostingEngine.postGoodsReceipt({
          grDocNumber: doc.docNumber,
          poNumber: doc.poNumber,
          plantCode: doc.plantCode,
          amount: totalAmount,
          postingDate: doc.postingDate,
          createdBy: actingUserId,
          costCenter: doc.items[0]?.costCenter,
        });
        return res;
      } else if (doc.movementType.startsWith('2') || doc.movementType === '201') {
        // Goods Issue to Cost Center -> Dr. Consumption / Cr. Inventory
        const costCenter = doc.items[0]?.costCenter;
        if (!costCenter) {
          throw new Error('خطأ ترحيل محاسبي: مركز التكلفة إلزامي لصرف المواد إلى مركز تكلفة (MIGO 201).');
        }

        const res = await AutomaticPostingEngine.postGoodsIssue({
          giDocNumber: doc.docNumber,
          costCenter,
          amount: totalAmount,
          postingDate: doc.postingDate,
          createdBy: actingUserId,
        });
        return res;
      } else {
        // Physical inventory adjustments / transfers
        const res = await AutomaticPostingEngine.postGoodsReceipt({
          grDocNumber: doc.docNumber,
          plantCode: doc.plantCode,
          amount: totalAmount,
          postingDate: doc.postingDate,
          createdBy: actingUserId,
          costCenter: doc.items[0]?.costCenter,
        });
        return res;
      }
    } catch (e) {
      DiagnosticLogger.error('FinancePostingAdapter', '[FinancePostingAdapter] Error posting to General Ledger:', e);
      return { success: false, jeDocNumber: '' };
    }
  }
}

export const financePostingService = new FinancePostingAdapter();
