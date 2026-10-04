import { db } from '../../../core/db';
import { FinanceService } from './FinanceService';
import { NumberRangeService } from '../../../core/services/NumberRangeService';
import { AuditService } from '../../../core/services/AuditService';
import type {
  CostCenter,
  Budget,
  InternalOrder,
  CostAllocationCycle,
  CostAllocationSegment,
  JournalEntry,
  JournalEntryLine,
} from '../../../types/models';

export interface CostCenterVarianceItem {
  costCenterCode: string;
  costCenterName: string;
  category: string;
  budgetAllocated: number;
  commitments: number;
  actualCost: number;
  varianceAmount: number; // budget - actual
  variancePercent: number;
  status: 'favorable' | 'warning' | 'critical';
}

export class ControllingService {
  /**
   * Generates Cost Center Actual vs Budget variance report.
   */
  static async getActualVsBudgetReport(fiscalYear: string = '2026'): Promise<{
    items: CostCenterVarianceItem[];
    totalBudget: number;
    totalCommitments: number;
    totalActual: number;
    totalVariance: number;
  }> {
    const costCenters = await db.costCenters.filter((cc) => !cc.isDeleted).toArray();
    const budgets = await db.budgets.where({ fiscalYear }).filter((b) => !b.isDeleted).toArray();

    const budgetMap = new Map(budgets.map((b) => [b.costCenter, b]));

    // Aggregate actual costs from posted journal entries with costCenter
    const journalEntries = await db.journalEntries
      .where({ fiscalYear })
      .filter((je) => !je.isDeleted && !je.isParked && !je.isReversed)
      .toArray();

    const actualMap = new Map<string, number>();
    for (const je of journalEntries) {
      for (const line of je.lines) {
        if (line.costCenter) {
          // Debit increases expense for cost center; credit reduces it
          const netCost = (line.debit || 0) - (line.credit || 0);
          const current = actualMap.get(line.costCenter) || 0;
          actualMap.set(line.costCenter, current + netCost);
        }
      }
    }

    let totalBudget = 0;
    let totalCommitments = 0;
    let totalActual = 0;

    const items: CostCenterVarianceItem[] = costCenters.map((cc) => {
      const b = budgetMap.get(cc.code);
      const allocated = b?.allocatedAmount || 0;
      const commitments = b?.committedAmount || 0;
      // Use journal actual if available, fallback to budget recorded actual
      const actual = Math.max(0, actualMap.get(cc.code) ?? (b?.actualAmount || 0));

      const varianceAmount = allocated - actual;
      const variancePercent = allocated > 0 ? Math.round(((actual - allocated) / allocated) * 1000) / 10 : 0;

      totalBudget += allocated;
      totalCommitments += commitments;
      totalActual += actual;

      let status: 'favorable' | 'warning' | 'critical' = 'favorable';
      if (actual > allocated) {
        status = 'critical';
      } else if (actual + commitments > allocated * 0.85) {
        status = 'warning';
      }

      return {
        costCenterCode: cc.code,
        costCenterName: cc.name,
        category: cc.companyCode === '1000' ? 'طاقة وعمليات' : 'إداري عام',
        budgetAllocated: allocated,
        commitments,
        actualCost: actual,
        varianceAmount,
        variancePercent,
        status,
      };
    });

    const totalVariance = totalBudget - totalActual;

    return {
      items: items.sort((a, b) => b.budgetAllocated - a.budgetAllocated),
      totalBudget,
      totalCommitments,
      totalActual,
      totalVariance,
    };
  }

  /**
   * Retrieves all individual Journal Entry line items for a cost center (KSB1 - Drill-down).
   */
  static async getCostCenterLineItems(
    costCenterCode: string,
    fiscalYear: string = '2026'
  ): Promise<{
    lines: (JournalEntryLine & {
      docNumber: string;
      postingDate: string;
      documentType: string;
      headerText: string;
    })[];
    totalDebit: number;
    totalCredit: number;
    netExpense: number;
  }> {
    const journalEntries = await db.journalEntries
      .where({ fiscalYear })
      .filter((je) => !je.isDeleted && !je.isParked && !je.isReversed)
      .toArray();

    const matchedLines: (JournalEntryLine & {
      docNumber: string;
      postingDate: string;
      documentType: string;
      headerText: string;
    })[] = [];

    let totalDebit = 0;
    let totalCredit = 0;

    for (const je of journalEntries) {
      for (const line of je.lines) {
        if (line.costCenter === costCenterCode) {
          totalDebit += line.debit;
          totalCredit += line.credit;
          matchedLines.push({
            ...line,
            docNumber: je.docNumber,
            postingDate: je.postingDate,
            documentType: je.documentType,
            headerText: je.headerText,
          });
        }
      }
    }

    matchedLines.sort((a, b) => b.postingDate.localeCompare(a.postingDate));

    return {
      lines: matchedLines,
      totalDebit,
      totalCredit,
      netExpense: totalDebit - totalCredit,
    };
  }

  /**
   * Executes a Cost Allocation (Assessment Cycle - KSU5).
   * Transfers costs from a sender cost center to receiver cost centers
   * via an automatic, balanced Journal Entry.
   */
  static async executeAllocationCycle(params: {
    cycleCode: string;
    name: string;
    fiscalYear: string;
    period: number;
    senderCostCenter: string;
    totalAmount: number;
    segments: CostAllocationSegment[];
    createdBy: string;
  }): Promise<CostAllocationCycle> {
    const { fiscalYear, period } = await FinanceService.validatePeriodOpen(
      `${params.fiscalYear}-${String(params.period).padStart(2, '0')}-01`
    );

    const docNumber = await NumberRangeService.getNextNumber('ALLOC', fiscalYear);
    const jeDocNumber = await NumberRangeService.getNextNumber('JE', fiscalYear);
    const now = new Date().toISOString();
    const postingDate = `${params.fiscalYear}-${String(params.period).padStart(2, '0')}-28`;

    // 1. Build balanced Journal Entry
    // Receivers get DEBIT (Cost Center = receiver)
    // Sender gets CREDIT (Cost Center = sender)
    const lines: JournalEntryLine[] = [];
    let lineIdx = 1;

    for (const seg of params.segments) {
      lines.push({
        lineNumber: lineIdx++,
        postingKey: '40',
        accountNumber: '600099',
        accountName: 'توزيع أعباء وتكاليف مشتركة محملة',
        debit: seg.allocatedAmount,
        credit: 0,
        costCenter: seg.receiverCostCenter,
        lineText: `توزيع تكاليف دورة ${params.cycleCode} (${seg.percentage}%)`,
      });
    }

    lines.push({
      lineNumber: lineIdx,
      postingKey: '50',
      accountNumber: '600099',
      accountName: 'توزيع أعباء وتكاليف مشتركة محملة (مرسل)',
      debit: 0,
      credit: params.totalAmount,
      costCenter: params.senderCostCenter,
      lineText: `إخلاء وتحميل تكاليف مشتركة لمركز ${params.senderCostCenter}`,
    });

    const je: JournalEntry = {
      id: `je-${jeDocNumber}`,
      docNumber: jeDocNumber,
      status: 'posted',
      companyCode: '1000',
      fiscalYear,
      period,
      postingDate,
      documentDate: postingDate,
      documentType: 'SA',
      headerText: `دورة توزيع تكاليف دورية KSU5 - ${params.name} (${params.cycleCode})`,
      reference: docNumber,
      totalDebit: params.totalAmount,
      totalCredit: params.totalAmount,
      lines,
      createdBy: params.createdBy,
      createdAt: now,
      updatedBy: params.createdBy,
      updatedAt: now,
      version: 1,
      isDeleted: false,
    };

    const cycleRecord: CostAllocationCycle = {
      id: `alloc-${docNumber}`,
      docNumber,
      status: 'completed',
      cycleCode: params.cycleCode,
      name: params.name,
      fiscalYear,
      period,
      senderCostCenter: params.senderCostCenter,
      totalAllocatedAmount: params.totalAmount,
      segments: params.segments,
      jeDocNumber,
      createdBy: params.createdBy,
      createdAt: now,
      updatedBy: params.createdBy,
      updatedAt: now,
      version: 1,
      isDeleted: false,
    };

    await db.transaction('rw', [db.journalEntries, db.costAllocationCycles, db.auditLogs], async () => {
      await db.journalEntries.add(je);
      await db.costAllocationCycles.add(cycleRecord);
      await AuditService.log({
        userId: params.createdBy,
        action: 'CREATE',
        entity: 'CostAllocationCycle',
        entityId: cycleRecord.id,
        after: cycleRecord as unknown as Record<string, unknown>,
      });
    });

    return cycleRecord;
  }
}
