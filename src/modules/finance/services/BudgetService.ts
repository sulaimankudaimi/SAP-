import { db } from '../../../core/db';
import { AuditService } from '../../../core/services/AuditService';
import { requirePermission } from '../../../core/security/SessionContext';
import type { Budget, CostCenter } from '../../../types/models';

export interface BudgetAvailabilityCheckResult {
  isAvailable: boolean;
  costCenter: string;
  costCenterName?: string;
  fiscalYear: string;
  allocatedAmount: number;
  committedAmount: number;
  actualAmount: number;
  availableAmount: number;
  requestedAmount: number;
  remainingAfterRequest: number;
  utilizationPercentage: number;
  warning?: string;
}

export class BudgetService {
  /**
   * Checks budget availability for a cost center.
   * Commitment tracking: Available = Allocated - Committed - Actual.
   */
  static async checkAvailability(
    costCenter: string,
    requestedAmount: number,
    fiscalYear: string = '2026'
  ): Promise<BudgetAvailabilityCheckResult> {
    const budget = await db.budgets
      .where({ costCenter, fiscalYear })
      .first();

    const cc = await db.costCenters.where('code').equals(costCenter).first();
    const costCenterName = cc?.name || costCenter;

    if (!budget) {
      // If no budget record is found, report zero allocated
      return {
        isAvailable: false,
        costCenter,
        costCenterName,
        fiscalYear,
        allocatedAmount: 0,
        committedAmount: 0,
        actualAmount: 0,
        availableAmount: 0,
        requestedAmount,
        remainingAfterRequest: -requestedAmount,
        utilizationPercentage: 100,
        warning: `لا توجد ميزانية معتمدة لمركز التكلفة (${costCenter}) للعام المالي ${fiscalYear}.`,
      };
    }

    const available = budget.allocatedAmount - budget.committedAmount - budget.actualAmount;
    const remainingAfter = available - requestedAmount;
    const isAvailable = remainingAfter >= 0;

    const totalConsumed = budget.committedAmount + budget.actualAmount;
    const utilizationPct = budget.allocatedAmount > 0
      ? Math.round((totalConsumed / budget.allocatedAmount) * 1000) / 10
      : 100;

    let warning: string | undefined;
    if (!isAvailable) {
      warning = `المبلغ المطلوب (${requestedAmount.toLocaleString('en-US')} ر.س) يتجاوز الميزانية المتبقية المتاحة (${available.toLocaleString('en-US')} ر.س). الفارق: ${Math.abs(remainingAfter).toLocaleString('en-US')} ر.س`;
    } else if (utilizationPct > 85) {
      warning = `تنبيه: نسبة استهلاك الميزانية بلغت ${utilizationPct}% وتقترب من الحد المسموح.`;
    }

    return {
      isAvailable,
      costCenter,
      costCenterName,
      fiscalYear,
      allocatedAmount: budget.allocatedAmount,
      committedAmount: budget.committedAmount,
      actualAmount: budget.actualAmount,
      availableAmount: available,
      requestedAmount,
      remainingAfterRequest: remainingAfter,
      utilizationPercentage: utilizationPct,
      warning,
    };
  }

  /**
   * Adds a commitment (e.g. approved PR or PO) to the budget.
   */
  static async addCommitment(
    costCenter: string,
    amount: number,
    fiscalYear: string = '2026',
    userId: string = 'usr-admin-1'
  ): Promise<void> {
    requirePermission({ module: 'CO', activity: 'change' }, { costCenter, amount });
    const budget = await db.budgets.where({ costCenter, fiscalYear }).first();
    if (!budget) return;

    budget.committedAmount += amount;
    budget.availableAmount = budget.allocatedAmount - budget.committedAmount - budget.actualAmount;

    await db.budgets.put(budget);
    await AuditService.log({
      userId,
      action: 'UPDATE',
      entity: 'Budget',
      entityId: budget.id,
      after: budget as unknown as Record<string, unknown>,
    });
  }

  /**
   * Releases a commitment (e.g. upon PO cancellation or GR posting).
   */
  static async releaseCommitment(
    costCenter: string,
    amount: number,
    fiscalYear: string = '2026',
    userId: string = 'usr-admin-1'
  ): Promise<void> {
    requirePermission({ module: 'CO', activity: 'change' }, { costCenter, amount });
    const budget = await db.budgets.where({ costCenter, fiscalYear }).first();
    if (!budget) return;

    budget.committedAmount = Math.max(0, budget.committedAmount - amount);
    budget.availableAmount = budget.allocatedAmount - budget.committedAmount - budget.actualAmount;

    await db.budgets.put(budget);
  }

  /**
   * Creates or updates a cost center annual budget.
   */
  static async saveBudget(
    costCenter: string,
    fiscalYear: string,
    allocatedAmount: number,
    userId: string
  ): Promise<Budget> {
    requirePermission({ module: 'CO', activity: 'change' }, { costCenter, amount: allocatedAmount });
    const existing = await db.budgets.where({ costCenter, fiscalYear }).first();
    const cc = await db.costCenters.where('code').equals(costCenter).first();

    const id = existing?.id || `bgt-${costCenter}-${fiscalYear}`;
    const committed = existing?.committedAmount || 0;
    const actual = existing?.actualAmount || 0;
    const available = allocatedAmount - committed - actual;

    const budget: Budget = {
      id,
      costCenter,
      costCenterName: cc?.name,
      fiscalYear,
      allocatedAmount,
      committedAmount: committed,
      actualAmount: actual,
      availableAmount: available,
      isDeleted: false,
    };

    await db.transaction('rw', [db.budgets, db.auditLogs], async () => {
      await db.budgets.put(budget);
      await AuditService.log({
        userId,
        action: existing ? 'UPDATE' : 'CREATE',
        entity: 'Budget',
        entityId: budget.id,
        before: existing ? (existing as unknown as Record<string, unknown>) : null,
        after: budget as unknown as Record<string, unknown>,
      });
    });

    return budget;
  }
}
