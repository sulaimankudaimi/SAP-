import { db } from '../../../core/db';
import { assetRepository, depreciationRepository, journalRepository } from '../../../core/repositories';
import { NumberRangeService } from '../../../core/services/NumberRangeService';
import { AuditService } from '../../../core/services/AuditService';
import type {
  Asset,
  DepreciationRun,
  DepreciationRunItem,
  DepreciationMethod,
  JournalEntry,
} from '../../../types/models';

export interface DepreciationCalculationResult {
  depreciationAmount: number;
  newBookValue: number;
  newAccumulatedDepreciation: number;
  methodUsed: DepreciationMethod;
}

export interface FiveYearForecastPoint {
  year: number;
  periodLabel: string;
  bookValue: number;
  accumulatedDepreciation: number;
  annualDepreciation: number;
}

export class DepreciationEngine {
  /**
   * Calculates periodic depreciation for a single asset.
   * Supports Straight-Line (القسط الثابت) and Declining Balance (القسط المتناقص).
   * Strictly respects salvageValue (قيمة الخردة) as the lower bound of book value.
   */
  static calculatePeriodicDepreciation(
    asset: Pick<
      Asset,
      | 'acquisitionCost'
      | 'salvageValue'
      | 'usefulLifeMonths'
      | 'accumulatedDepreciation'
      | 'netBookValue'
      | 'depreciationMethod'
      | 'decliningBalanceRate'
    >,
    periodType: 'Monthly' | 'Yearly' = 'Monthly'
  ): DepreciationCalculationResult {
    const cost = Math.max(0, asset.acquisitionCost);
    const salvage = Math.max(0, asset.salvageValue);
    const usefulLifeMonths = Math.max(1, asset.usefulLifeMonths);
    const currentAccDep = Math.max(0, asset.accumulatedDepreciation);
    const currentBookValue = Math.max(0, cost - currentAccDep);

    // If current book value is already at or below salvage value, no further depreciation occurs
    if (currentBookValue <= salvage) {
      return {
        depreciationAmount: 0,
        newBookValue: currentBookValue,
        newAccumulatedDepreciation: currentAccDep,
        methodUsed: asset.depreciationMethod,
      };
    }

    const maxAllowableDepreciation = Math.max(0, currentBookValue - salvage);
    let calculatedAmount = 0;

    if (asset.depreciationMethod === 'StraightLine') {
      // Straight-Line formula: (Cost - Salvage) / UsefulLife
      const depreciableBase = Math.max(0, cost - salvage);
      const monthlyRate = depreciableBase / usefulLifeMonths;
      calculatedAmount = periodType === 'Yearly' ? monthlyRate * 12 : monthlyRate;
    } else {
      // Declining Balance formula: NetBookValue * Rate
      // Standard double declining: Rate = 2 / (usefulLifeYears)
      const usefulLifeYears = usefulLifeMonths / 12;
      const annualRate =
        asset.decliningBalanceRate && asset.decliningBalanceRate > 0
          ? asset.decliningBalanceRate
          : 2 / usefulLifeYears;

      const periodicRate = periodType === 'Yearly' ? annualRate : annualRate / 12;
      calculatedAmount = currentBookValue * periodicRate;

      // SAP Standard Switchover Check:
      // If straight-line over remaining life produces higher depreciation, switch to finish cleanly
      const remainingDepreciable = Math.max(0, currentBookValue - salvage);
      const remainingMonths = Math.max(1, usefulLifeMonths - Math.round((currentAccDep / (cost - salvage || 1)) * usefulLifeMonths));
      const remainingStraightLineMonthly = remainingDepreciable / remainingMonths;
      const straightLineBenchmark = periodType === 'Yearly' ? remainingStraightLineMonthly * 12 : remainingStraightLineMonthly;

      if (straightLineBenchmark > calculatedAmount && currentBookValue > salvage) {
        calculatedAmount = straightLineBenchmark;
      }
    }

    // Clamp to not exceed salvage boundary
    const actualDepreciation = Math.min(calculatedAmount, maxAllowableDepreciation);
    const roundedDepreciation = Math.round(actualDepreciation * 100) / 100;
    const finalNewAccDep = Math.round((currentAccDep + roundedDepreciation) * 100) / 100;
    const finalNewBookValue = Math.round(Math.max(salvage, cost - finalNewAccDep) * 100) / 100;

    return {
      depreciationAmount: roundedDepreciation,
      newBookValue: finalNewBookValue,
      newAccumulatedDepreciation: finalNewAccDep,
      methodUsed: asset.depreciationMethod,
    };
  }

  /**
   * Generates 5-Year forecast projections for an asset (Book Value vs Accumulated Depreciation).
   * Matches the visual reference chart.
   */
  static generateFiveYearForecast(asset: Asset): FiveYearForecastPoint[] {
    const points: FiveYearForecastPoint[] = [];
    let runningBookValue = asset.netBookValue;
    let runningAccDep = asset.accumulatedDepreciation;
    const baseYear = new Date().getFullYear();

    // Initial point (Year 0 / Current state)
    points.push({
      year: baseYear,
      periodLabel: `${baseYear} (الحالي)`,
      bookValue: Math.round(runningBookValue),
      accumulatedDepreciation: Math.round(runningAccDep),
      annualDepreciation: 0,
    });

    // 5 forward years
    for (let yr = 1; yr <= 5; yr++) {
      const yearNumber = baseYear + yr;
      const result = this.calculatePeriodicDepreciation(
        {
          acquisitionCost: asset.acquisitionCost,
          salvageValue: asset.salvageValue,
          usefulLifeMonths: asset.usefulLifeMonths,
          accumulatedDepreciation: runningAccDep,
          netBookValue: runningBookValue,
          depreciationMethod: asset.depreciationMethod,
          decliningBalanceRate: asset.decliningBalanceRate,
        },
        'Yearly'
      );

      runningBookValue = result.newBookValue;
      runningAccDep = result.newAccumulatedDepreciation;

      points.push({
        year: yearNumber,
        periodLabel: `سنة ${yearNumber}`,
        bookValue: Math.round(runningBookValue),
        accumulatedDepreciation: Math.round(runningAccDep),
        annualDepreciation: Math.round(result.depreciationAmount),
      });
    }

    return points;
  }

  /**
   * Previews or simulates a depreciation run for a given company code, fiscal year, and period.
   * Filters all active assets eligible for depreciation.
   */
  static async previewDepreciationRun(options: {
    companyCode: string;
    fiscalYear: string;
    period: number;
    plantCode?: string;
  }): Promise<{
    items: DepreciationRunItem[];
    totalDepreciation: number;
    assetCount: number;
  }> {
    const allAssets = await assetRepository.list();
    const eligibleAssets = allAssets.filter((a: Asset) => {
      if (a.isDeleted) return false;
      if (a.status !== 'Active' && a.status !== 'InDepreciation') return false;
      if (options.plantCode && a.plantCode !== options.plantCode) return false;
      return a.netBookValue > a.salvageValue;
    });

    const items: DepreciationRunItem[] = [];
    let totalDepreciation = 0;

    for (const asset of eligibleAssets) {
      const res = this.calculatePeriodicDepreciation(asset, 'Monthly');
      if (res.depreciationAmount > 0) {
        items.push({
          assetId: asset.id,
          assetNumber: asset.assetNumber,
          assetName: asset.name,
          category: asset.category,
          costCenter: asset.costCenter,
          glAccount: '503010', // Depreciation Expense account
          depreciationAccount: '150090', // Accumulated Depreciation account
          previousBookValue: asset.netBookValue,
          depreciationAmount: res.depreciationAmount,
          newBookValue: res.newBookValue,
          method: asset.depreciationMethod,
        });
        totalDepreciation += res.depreciationAmount;
      }
    }

    return {
      items,
      totalDepreciation: Math.round(totalDepreciation * 100) / 100,
      assetCount: items.length,
    };
  }

  /**
   * Executes and posts the depreciation run (SAP AFAB equivalent).
   * 1. Creates DepreciationRun document
   * 2. Updates each asset's accumulatedDepreciation, netBookValue, and status
   * 3. Creates a balanced Journal Entry (Debit: Depreciation Expense, Credit: Accumulated Depreciation)
   * 4. Logs audit trail
   */
  static async postDepreciationRun(options: {
    companyCode: string;
    fiscalYear: string;
    period: number;
    plantCode?: string;
    user: { id: string; fullName: string };
  }): Promise<{ run: DepreciationRun; je: JournalEntry }> {
    const preview = await this.previewDepreciationRun({
      companyCode: options.companyCode,
      fiscalYear: options.fiscalYear,
      period: options.period,
      plantCode: options.plantCode,
    });

    if (preview.items.length === 0 || preview.totalDepreciation <= 0) {
      throw new Error('لا توجد أصول مستحقة للإهلاك خلال هذه الفترة المالية.');
    }

    // Generate Document Numbers
    const docNumber = await NumberRangeService.getNextNumber('DEP', options.fiscalYear);
    const jeDocNumber = await NumberRangeService.getNextNumber('JE', options.fiscalYear);
    const now = new Date().toISOString();
    const postingDate = new Date().toISOString().split('T')[0];

    // 1. Create Balanced Journal Entry (SAP AFAB GL Document)
    const je: JournalEntry = {
      id: `je-${docNumber}`,
      docNumber: jeDocNumber,
      status: 'posted',
      companyCode: options.companyCode,
      fiscalYear: options.fiscalYear,
      period: options.period,
      postingDate,
      documentDate: postingDate,
      documentType: 'SA', // G/L account document
      headerText: `إهلاك الأصول الثابتة - دورة ${options.period}/${options.fiscalYear} (مستند ${docNumber})`,
      totalDebit: preview.totalDepreciation,
      totalCredit: preview.totalDepreciation,
      lines: [
        {
          lineNumber: 1,
          accountNumber: '503010',
          accountName: 'مصروف إهلاك الأصول الثابتة والمعدات',
          debit: preview.totalDepreciation,
          credit: 0,
          costCenter: preview.items[0]?.costCenter || 'CC-1001',
          lineText: `إهلاك شهري - دورة ${options.period}/${options.fiscalYear}`,
        },
        {
          lineNumber: 2,
          accountNumber: '150090',
          accountName: 'مجمع إهلاك الأصول الثابتة',
          debit: 0,
          credit: preview.totalDepreciation,
          lineText: `مجمع إهلاك الأصول - دورة ${options.period}/${options.fiscalYear}`,
        },
      ],
      createdBy: options.user.id,
      createdAt: now,
      updatedBy: options.user.id,
      updatedAt: now,
      version: 1,
      isDeleted: false,
    };

    // 2. Create Depreciation Run record
    const run: DepreciationRun = {
      id: `dep-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      docNumber,
      status: 'approved',
      companyCode: options.companyCode,
      fiscalYear: options.fiscalYear,
      period: options.period,
      runDate: now,
      runType: 'Monthly',
      isSimulation: false,
      totalDepreciationAmount: preview.totalDepreciation,
      assetCount: preview.assetCount,
      postedToGL: true,
      journalEntryDocNumber: jeDocNumber,
      items: preview.items,
      createdBy: options.user.id,
      createdAt: now,
      updatedBy: options.user.id,
      updatedAt: now,
      version: 1,
      isDeleted: false,
    };

    // Execute atomic-like persistence and asset updates
    await db.transaction('rw', [db.assets, db.depreciationRuns, db.journalEntries, db.auditLogs], async () => {
      // Save JE and DepreciationRun
      await db.journalEntries.add(je);
      await db.depreciationRuns.add(run);

      // Update assets
      for (const item of preview.items) {
        const existing = await db.assets.get(item.assetId);
        if (existing) {
          const updatedAccDep = Math.round((existing.accumulatedDepreciation + item.depreciationAmount) * 100) / 100;
          const updatedBookVal = Math.round(Math.max(existing.salvageValue, existing.acquisitionCost - updatedAccDep) * 100) / 100;
          const updatedStatus = updatedBookVal <= existing.salvageValue ? 'InDepreciation' : 'Active';

          await db.assets.update(item.assetId, {
            accumulatedDepreciation: updatedAccDep,
            netBookValue: updatedBookVal,
            status: updatedStatus,
            updatedAt: now,
          });
        }
      }
    });

    await AuditService.log({
      userId: options.user.id,
      userName: options.user.fullName,
      action: 'UPDATE',
      entity: 'DepreciationRun',
      entityId: run.docNumber,
      after: {
        docNumber: run.docNumber,
        period: options.period,
        fiscalYear: options.fiscalYear,
        totalDepreciation: preview.totalDepreciation,
        assetCount: preview.assetCount,
        jeDocNumber,
      },
    });

    return { run, je };
  }

  /**
   * Reverses the last posted depreciation run (Storno / عكس دورة الإهلاك).
   * Restores assets book values and creates a balancing reversal journal entry.
   */
  static async reverseDepreciationRun(options: {
    runId: string;
    reason: string;
    user: { id: string; fullName: string };
  }): Promise<{ reversedRun: DepreciationRun; stornoJe: JournalEntry }> {
    const run = await depreciationRepository.getById(options.runId);
    if (!run) {
      throw new Error(`دورة الإهلاك المحددة (${options.runId}) غير موجودة.`);
    }

    if (run.reversalDocNumber || run.status === 'rejected') {
      throw new Error('تم إلغاء أو عكس دورة الإهلاك هذه مسبقاً.');
    }

    const stornoDocNumber = await NumberRangeService.getNextNumber('JE', run.fiscalYear);
    const now = new Date().toISOString();
    const postingDate = now.split('T')[0];

    // Balanced Storno Journal Entry (Opposite debits/credits)
    const stornoJe: JournalEntry = {
      id: `je-storno-${run.docNumber}`,
      docNumber: stornoDocNumber,
      status: 'posted',
      companyCode: run.companyCode,
      fiscalYear: run.fiscalYear,
      period: run.period,
      postingDate,
      documentDate: postingDate,
      documentType: 'AB', // Accounting reversal document
      headerText: `عكس قيد إهلاك دورة ${run.period}/${run.fiscalYear} - مستند ${run.docNumber} (سبب: ${options.reason})`,
      totalDebit: run.totalDepreciationAmount,
      totalCredit: run.totalDepreciationAmount,
      lines: [
        {
          lineNumber: 1,
          accountNumber: '150090',
          accountName: 'مجمع إهلاك الأصول الثابتة (عكس)',
          debit: run.totalDepreciationAmount,
          credit: 0,
          lineText: `عكس مجمع إهلاك دورة ${run.docNumber}`,
        },
        {
          lineNumber: 2,
          accountNumber: '503010',
          accountName: 'مصروف إهلاك الأصول الثابتة والمعدات (عكس)',
          debit: 0,
          credit: run.totalDepreciationAmount,
          costCenter: run.items[0]?.costCenter || 'CC-1001',
          lineText: `عكس مصروف إهلاك دورة ${run.docNumber}`,
        },
      ],
      createdBy: options.user.id,
      createdAt: now,
      updatedBy: options.user.id,
      updatedAt: now,
      version: 1,
      isDeleted: false,
    };

    await db.transaction('rw', [db.assets, db.depreciationRuns, db.journalEntries, db.auditLogs], async () => {
      // Save storno JE
      await db.journalEntries.add(stornoJe);

      // Revert asset book values
      for (const item of run.items) {
        const asset = await db.assets.get(item.assetId);
        if (asset) {
          const rolledBackAccDep = Math.max(0, Math.round((asset.accumulatedDepreciation - item.depreciationAmount) * 100) / 100);
          const rolledBackBookVal = Math.round((asset.acquisitionCost - rolledBackAccDep) * 100) / 100;
          await db.assets.update(item.assetId, {
            accumulatedDepreciation: rolledBackAccDep,
            netBookValue: rolledBackBookVal,
            status: 'Active',
            updatedAt: now,
          });
        }
      }

      // Mark run as reversed
      await db.depreciationRuns.update(run.id, {
        reversalDocNumber: stornoDocNumber,
        status: 'rejected', // marks as reversed
        updatedAt: now,
      });
    });

    await AuditService.log({
      userId: options.user.id,
      userName: options.user.fullName,
      action: 'STATUS_CHANGE',
      entity: 'DepreciationRun',
      entityId: run.docNumber,
      before: { status: 'approved' },
      after: { status: 'rejected', stornoDocNumber, reason: options.reason },
    });

    const updatedRun = (await depreciationRepository.getById(run.id))!;
    return { reversedRun: updatedRun, stornoJe };
  }
}
