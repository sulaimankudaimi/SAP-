import { db } from '../../../core/db';
import {
  assetRepository,
  assetTransferRepository,
  assetValuationRepository,
  journalRepository,
} from '../../../core/repositories';
import { NumberRangeService } from '../../../core/services/NumberRangeService';
import { AuditService } from '../../../core/services/AuditService';
import { requirePermission } from '../../../core/security/SessionContext';
import type {
  Asset,
  AssetClass,
  AssetStatus,
  AssetTransfer,
  AssetValuation,
  DepreciationMethod,
  JournalEntry,
} from '../../../types/models';

export interface CreateAssetInput {
  name: string;
  description?: string;
  category: AssetClass;
  serialNumber?: string;
  barcode?: string;
  plantCode: string;
  costCenter: string;
  location?: string;
  custodian: string;
  custodianEmployeeId?: string;
  acquisitionDate: string;
  acquisitionCost: number;
  acquisitionSource?: 'PO' | 'GR' | 'Invoice' | 'Manual' | 'AuCSettlement';
  sourceDocNumber?: string;
  usefulLifeMonths: number;
  depreciationMethod: DepreciationMethod;
  decliningBalanceRate?: number;
  salvageValue?: number;
  status?: AssetStatus;
  imageUri?: string;
  commissioningDate?: string;
  depreciationStartDate?: string;
}

export interface AssetTransferInput {
  assetId: string;
  toPlant: string;
  toCostCenter: string;
  toLocation?: string;
  toCustodian: string;
  transferDate?: string;
  reason: string;
}

export interface AssetDisposalInput {
  disposalType: 'Scrap' | 'Sale';
  disposalDate: string;
  proceeds: number;
  reason: string;
}

export interface AssetValuationInput {
  inspectionDate: string;
  inspectorName: string;
  inspectorId?: string;
  conditionScore: number;
  conditionGrade: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical';
  physicalConditionNotes: string;
  estimatedMarketValue?: number;
  recommendedAction: 'Continue' | 'Maintenance' | 'Overhaul' | 'Disposal';
  attachments?: { name: string; size: string; type: string }[];
}

export class AssetService {
  /**
   * Retrieves all assets with flexible search and filtering.
   */
  static async getAssets(filter?: {
    category?: string;
    status?: string;
    plantCode?: string;
    costCenter?: string;
    search?: string;
  }): Promise<Asset[]> {
    const list = await assetRepository.list();
    return list.filter((asset: Asset) => {
      if (asset.isDeleted) return false;
      if (filter?.category && asset.category !== filter.category) return false;
      if (filter?.status && asset.status !== filter.status) return false;
      if (filter?.plantCode && asset.plantCode !== filter.plantCode) return false;
      if (filter?.costCenter && asset.costCenter !== filter.costCenter) return false;
      if (filter?.search) {
        const q = filter.search.toLowerCase().trim();
        const matchesNum = asset.assetNumber.toLowerCase().includes(q);
        const matchesName = asset.name.toLowerCase().includes(q);
        const matchesBarcode = asset.barcode?.toLowerCase().includes(q);
        const matchesSerial = asset.serialNumber?.toLowerCase().includes(q);
        const matchesCustodian = asset.custodian?.toLowerCase().includes(q);
        if (!matchesNum && !matchesName && !matchesBarcode && !matchesSerial && !matchesCustodian) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Finds an asset by its ID, Asset Number (AA-XXXX), or Barcode.
   * Enables scan-to-open feature.
   */
  static async getAssetByIdOrCode(query: string): Promise<Asset | null> {
    if (!query) return null;
    const cleanQuery = query.trim().toUpperCase();

    // 1. Direct ID lookup
    const byId = await assetRepository.getById(query);
    if (byId && !byId.isDeleted) return byId;

    // 2. Lookup by asset number or barcode
    const all = await assetRepository.list();
    const found = all.find(
      (a: Asset) =>
        !a.isDeleted &&
        (a.assetNumber.toUpperCase() === cleanQuery ||
          a.barcode?.toUpperCase() === cleanQuery ||
          a.serialNumber?.toUpperCase() === cleanQuery)
    );

    return found || null;
  }

  /**
   * Registers a new asset master record (SAP AS01 equivalent).
   * Generates AA-style asset number, Code128 barcode, and creates capitalization GL entry.
   */
  static async createAsset(
    input: CreateAssetInput,
    user: { id: string; fullName: string }
  ): Promise<{ asset: Asset; je?: JournalEntry }> {
    requirePermission(
      { module: 'AM', activity: 'create' },
      { plant: input.plantCode, costCenter: input.costCenter, amount: input.acquisitionCost }
    );
    const fiscalYear = input.acquisitionDate
      ? input.acquisitionDate.split('-')[0]
      : new Date().getFullYear().toString();

    // Generate AA-style number: e.g. AA-2026-000045
    const assetNumber = await NumberRangeService.getNextNumber('AA', fiscalYear);
    const barcode = input.barcode?.trim() || `BC-${assetNumber.replace(/[^A-Za-z0-9]/g, '')}`;
    const now = new Date().toISOString();
    const salvageValue = Math.max(0, input.salvageValue ?? input.acquisitionCost * 0.05);
    const initialBookValue = Math.max(0, input.acquisitionCost);

    const assetId = `ast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const initialStatus: AssetStatus =
      input.status || (input.category === 'AuC' ? 'UnderConstruction' : 'Active');

    let jeDocNumber: string | undefined;
    let je: JournalEntry | undefined;

    // Generate balanced capitalization Journal Entry if capitalized
    if (input.acquisitionCost > 0 && initialStatus !== 'UnderConstruction') {
      jeDocNumber = await NumberRangeService.getNextNumber('JE', fiscalYear);
      je = {
        id: `je-cap-${assetNumber}`,
        docNumber: jeDocNumber,
        status: 'posted',
        companyCode: '1000',
        fiscalYear,
        period: parseInt(input.acquisitionDate.split('-')[1] || '1', 10),
        postingDate: input.acquisitionDate,
        documentDate: input.acquisitionDate,
        documentType: 'SA',
        headerText: `رسملة واقتناء أصل ثابت - ${input.name} (${assetNumber})`,
        totalDebit: input.acquisitionCost,
        totalCredit: input.acquisitionCost,
        lines: [
          {
            lineNumber: 1,
            accountNumber: '150010', // Fixed Asset Balance Account
            accountName: 'الأصول الثابتة والمعدات الرأسمالية',
            debit: input.acquisitionCost,
            credit: 0,
            costCenter: input.costCenter,
            lineText: `إضافة أصل ${assetNumber}`,
          },
          {
            lineNumber: 2,
            accountNumber:
              input.acquisitionSource === 'PO' || input.acquisitionSource === 'GR'
                ? '120090' // GR/IR Clearing Account
                : '201010', // Vendor Payable Account
            accountName:
              input.acquisitionSource === 'PO' || input.acquisitionSource === 'GR'
                ? 'حساب مقاصة مشتريات الأصول (GR/IR)'
                : 'الذمم الدائنة - تسوية الأصول الرأسمالية',
            debit: 0,
            credit: input.acquisitionCost,
            lineText: `مقاصة اقتناء ${assetNumber}`,
          },
        ],
        createdBy: user.id,
        createdAt: now,
        updatedBy: user.id,
        updatedAt: now,
        version: 1,
        isDeleted: false,
      };
    }

    const asset: Asset = {
      id: assetId,
      assetNumber,
      name: input.name,
      description: input.description,
      category: input.category,
      serialNumber: input.serialNumber,
      barcode,
      plantCode: input.plantCode,
      costCenter: input.costCenter,
      location: input.location || 'المستودع الرئيسي',
      custodian: input.custodian,
      custodianEmployeeId: input.custodianEmployeeId,
      acquisitionDate: input.acquisitionDate,
      acquisitionCost: input.acquisitionCost,
      acquisitionSource: input.acquisitionSource || 'Manual',
      sourceDocNumber: input.sourceDocNumber,
      usefulLifeMonths: input.usefulLifeMonths || 60,
      depreciationMethod: input.depreciationMethod || 'StraightLine',
      decliningBalanceRate: input.decliningBalanceRate,
      salvageValue,
      accumulatedDepreciation: 0,
      netBookValue: initialBookValue,
      status: initialStatus,
      imageUri: input.imageUri,
      commissioningDate: input.commissioningDate || input.acquisitionDate,
      depreciationStartDate: input.depreciationStartDate || input.acquisitionDate,
      capitalizationJeDocNumber: jeDocNumber,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };

    await db.transaction('rw', [db.assets, db.journalEntries, db.auditLogs], async () => {
      await db.assets.add(asset);
      if (je) {
        await db.journalEntries.add(je);
      }
    });

    await AuditService.log({
      userId: user.id,
      userName: user.fullName,
      action: 'CREATE',
      entity: 'Asset',
      entityId: asset.assetNumber,
      after: { assetNumber: asset.assetNumber, name: asset.name, acquisitionCost: asset.acquisitionCost },
    });

    return { asset, je };
  }

  /**
   * Settle an Asset under Construction (AuC Settlement - SAP AIAB / AIBU).
   * Transfers capitalized costs from construction in progress to completed active asset.
   */
  static async settleAuC(options: {
    aucAssetId: string;
    targetAssetInput: CreateAssetInput;
    user: { id: string; fullName: string };
  }): Promise<{ aucAsset: Asset; finalAsset: Asset; je: JournalEntry }> {
    const auc = await assetRepository.getById(options.aucAssetId);
    if (!auc || auc.isDeleted) {
      throw new Error('مشروع الأصل قيد التنفيذ (AuC) غير موجود.');
    }

    if (auc.status !== 'UnderConstruction' && auc.category !== 'AuC') {
      throw new Error('الأصل المحدد ليس أصلاً قيد التنفيذ ليتم تسويته.');
    }

    requirePermission(
      { module: 'AM', activity: 'post' },
      { plant: auc.plantCode, costCenter: auc.costCenter, amount: auc.acquisitionCost }
    );

    const settlementAmount = auc.acquisitionCost;
    const now = new Date().toISOString();
    const fiscalYear = options.targetAssetInput.acquisitionDate.split('-')[0] || '2026';
    const jeDocNumber = await NumberRangeService.getNextNumber('JE', fiscalYear);

    // 1. Create target completed asset
    const { asset: finalAsset } = await this.createAsset(
      {
        ...options.targetAssetInput,
        acquisitionCost: settlementAmount,
        acquisitionSource: 'AuCSettlement',
        sourceDocNumber: auc.assetNumber,
        status: 'Active',
      },
      options.user
    );

    // 2. Balanced Journal Entry: Debit Completed Asset (150010), Credit AuC (150900)
    const je: JournalEntry = {
      id: `je-auc-${auc.assetNumber}`,
      docNumber: jeDocNumber,
      status: 'posted',
      companyCode: '1000',
      fiscalYear,
      period: parseInt(options.targetAssetInput.acquisitionDate.split('-')[1] || '1', 10),
      postingDate: options.targetAssetInput.acquisitionDate,
      documentDate: options.targetAssetInput.acquisitionDate,
      documentType: 'SA',
      headerText: `تسوية مشروعات قيد التنفيذ AuC من ${auc.assetNumber} إلى ${finalAsset.assetNumber}`,
      totalDebit: settlementAmount,
      totalCredit: settlementAmount,
      lines: [
        {
          lineNumber: 1,
          accountNumber: '150010',
          accountName: 'الأصول الثابتة المكتملة',
          debit: settlementAmount,
          credit: 0,
          costCenter: finalAsset.costCenter,
          lineText: `تسوية الأصل المكتمل ${finalAsset.assetNumber}`,
        },
        {
          lineNumber: 2,
          accountNumber: '150900',
          accountName: 'مشروعات وأصول قيد التنفيذ (AuC)',
          debit: 0,
          credit: settlementAmount,
          costCenter: auc.costCenter,
          lineText: `إقفال وتسوية AuC ${auc.assetNumber}`,
        },
      ],
      createdBy: options.user.id,
      createdAt: now,
      updatedBy: options.user.id,
      updatedAt: now,
      version: 1,
      isDeleted: false,
    };

    // 3. Mark AuC as completed
    await db.transaction('rw', [db.assets, db.journalEntries, db.auditLogs], async () => {
      await db.journalEntries.add(je);
      await db.assets.update(auc.id, {
        status: 'Disposed',
        description: `تمت تسوية المشروع بالكامل ونقله إلى الأصل الرأسمالي ${finalAsset.assetNumber}`,
        updatedAt: now,
      });
    });

    await AuditService.log({
      userId: options.user.id,
      userName: options.user.fullName,
      action: 'STATUS_CHANGE',
      entity: 'Asset',
      entityId: auc.assetNumber,
      before: { status: 'UnderConstruction' },
      after: { status: 'Disposed', settledTo: finalAsset.assetNumber, settlementAmount },
    });

    const updatedAuc = (await assetRepository.getById(auc.id))!;
    return { aucAsset: updatedAuc, finalAsset, je };
  }

  /**
   * Requests an asset transfer between plants, cost centers, or custodians (SAP ABT1N).
   */
  static async createTransfer(
    input: AssetTransferInput,
    user: { id: string; fullName: string }
  ): Promise<AssetTransfer> {
    const asset = await assetRepository.getById(input.assetId);
    if (!asset || asset.isDeleted) {
      throw new Error('الأصل المطلوب نقله غير موجود.');
    }

    if (asset.status === 'Disposed') {
      throw new Error('لا يمكن نقل أصل مستبعد أو مُكهَّن.');
    }

    requirePermission(
      { module: 'AM', activity: 'create' },
      { plant: asset.plantCode, costCenter: asset.costCenter }
    );

    const fiscalYear = new Date().getFullYear().toString();
    const docNumber = await NumberRangeService.getNextNumber('AST', fiscalYear);
    const now = new Date().toISOString();
    const transferDate = input.transferDate || now.split('T')[0];

    const transfer: AssetTransfer = {
      id: `ast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      docNumber,
      status: 'pending',
      assetId: asset.id,
      assetNumber: asset.assetNumber,
      assetName: asset.name,
      fromPlant: asset.plantCode,
      toPlant: input.toPlant,
      fromCostCenter: asset.costCenter,
      toCostCenter: input.toCostCenter,
      fromLocation: asset.location,
      toLocation: input.toLocation || asset.location,
      fromCustodian: asset.custodian,
      toCustodian: input.toCustodian,
      transferDate,
      reason: input.reason,
      acknowledgedByCustodian: false,
      createdBy: user.id,
      createdAt: now,
      updatedBy: user.id,
      updatedAt: now,
      version: 1,
      isDeleted: false,
    };

    await db.transaction('rw', [db.assets, db.assetTransfers, db.auditLogs], async () => {
      await db.assetTransfers.add(transfer);
      await db.assets.update(asset.id, {
        status: 'InTransfer',
        updatedAt: now,
      });
    });

    await AuditService.log({
      userId: user.id,
      userName: user.fullName,
      action: 'CREATE',
      entity: 'AssetTransfer',
      entityId: transfer.docNumber,
      after: { docNumber: transfer.docNumber, assetNumber: asset.assetNumber, toCustodian: input.toCustodian },
    });

    return transfer;
  }

  /**
   * Approves and executes an asset transfer.
   * Updates asset's physical location, cost center, plant, and custodian.
   */
  static async approveTransfer(
    transferId: string,
    user: { id: string; fullName: string }
  ): Promise<{ transfer: AssetTransfer; asset: Asset }> {
    const transfer = await assetTransferRepository.getById(transferId);
    if (!transfer || transfer.isDeleted) {
      throw new Error('طلب النقل غير موجود.');
    }

    requirePermission(
      { module: 'AM', activity: 'approve' },
      { plant: transfer.toPlant, costCenter: transfer.toCostCenter }
    );

    const asset = await assetRepository.getById(transfer.assetId);
    if (!asset || asset.isDeleted) {
      throw new Error('الأصل المرتبط بطلب النقل غير موجود.');
    }

    const now = new Date().toISOString();

    await db.transaction('rw', [db.assets, db.assetTransfers, db.auditLogs], async () => {
      // 1. Update transfer record
      await db.assetTransfers.update(transfer.id, {
        status: 'approved',
        updatedBy: user.id,
        updatedAt: now,
      });

      // 2. Update asset master record with new custodian and location
      await db.assets.update(asset.id, {
        plantCode: transfer.toPlant,
        costCenter: transfer.toCostCenter,
        location: transfer.toLocation,
        custodian: transfer.toCustodian,
        status: 'Active',
        updatedAt: now,
      });
    });

    await AuditService.log({
      userId: user.id,
      userName: user.fullName,
      action: 'STATUS_CHANGE',
      entity: 'AssetTransfer',
      entityId: transfer.docNumber,
      before: { status: 'pending' },
      after: { status: 'approved', toCustodian: transfer.toCustodian },
    });

    const updatedTransfer = (await assetTransferRepository.getById(transfer.id))!;
    const updatedAsset = (await assetRepository.getById(asset.id))!;
    return { transfer: updatedTransfer, asset: updatedAsset };
  }

  /**
   * Acknowledges receipt of custody by the new custodian.
   */
  static async acknowledgeCustody(
    transferId: string,
    user: { id: string; fullName: string }
  ): Promise<AssetTransfer> {
    requirePermission({ module: 'AM', activity: 'change' });
    const transfer = await assetTransferRepository.getById(transferId);
    if (!transfer || transfer.isDeleted) {
      throw new Error('طلب النقل غير موجود.');
    }

    const now = new Date().toISOString();
    await db.assetTransfers.update(transfer.id, {
      acknowledgedByCustodian: true,
      acknowledgedAt: now,
      updatedBy: user.id,
      updatedAt: now,
    });

    await AuditService.log({
      userId: user.id,
      userName: user.fullName,
      action: 'UPDATE',
      entity: 'AssetTransfer',
      entityId: transfer.docNumber,
      after: { acknowledgedByCustodian: true, acknowledgedAt: now },
    });

    return (await assetTransferRepository.getById(transfer.id))!;
  }

  /**
   * Retires/disposes an asset via Scrap or Sale (SAP ABAVN / ABAON).
   * Strictly computes Gain or Loss and posts a perfectly balanced Journal Entry to GL.
   */
  static async disposeAsset(
    assetId: string,
    input: AssetDisposalInput,
    user: { id: string; fullName: string }
  ): Promise<{ asset: Asset; je: JournalEntry; gainLoss: number }> {
    const asset = await assetRepository.getById(assetId);
    if (!asset || asset.isDeleted) {
      throw new Error('الأصل المطلوب تخريده أو بيعه غير موجود.');
    }

    if (asset.status === 'Disposed') {
      throw new Error('هذا الأصل مُكهَّن ومستبعد مسبقاً.');
    }

    requirePermission(
      { module: 'AM', activity: 'post' },
      { plant: asset.plantCode, costCenter: asset.costCenter, amount: input.proceeds }
    );

    const cost = asset.acquisitionCost;
    const accDep = asset.accumulatedDepreciation;
    const netBookValue = Math.max(0, cost - accDep);
    const proceeds = input.disposalType === 'Sale' ? Math.max(0, input.proceeds) : 0;
    const gainLoss = Math.round((proceeds - netBookValue) * 100) / 100;

    const fiscalYear = input.disposalDate.split('-')[0] || new Date().getFullYear().toString();
    const period = parseInt(input.disposalDate.split('-')[1] || '1', 10);
    const jeDocNumber = await NumberRangeService.getNextNumber('JE', fiscalYear);
    const now = new Date().toISOString();

    // Build Balanced Journal Entry lines
    const lines = [];
    let lineNumber = 1;

    if (input.disposalType === 'Scrap') {
      // SCRAP: Debit Loss (netBookValue), Debit AccDep (accDep), Credit Fixed Assets (cost)
      if (netBookValue > 0) {
        lines.push({
          lineNumber: lineNumber++,
          accountNumber: '504010',
          accountName: 'خسائر استبعاد وتخريد الأصول الثابتة',
          debit: netBookValue,
          credit: 0,
          costCenter: asset.costCenter,
          lineText: `خسائر تخريد الأصل ${asset.assetNumber}`,
        });
      }
      if (accDep > 0) {
        lines.push({
          lineNumber: lineNumber++,
          accountNumber: '150090',
          accountName: 'مجمع إهلاك الأصول الثابتة (إقفال)',
          debit: accDep,
          credit: 0,
          lineText: `إقفال مجمع إهلاك ${asset.assetNumber}`,
        });
      }
      lines.push({
        lineNumber: lineNumber++,
        accountNumber: '150010',
        accountName: 'الأصول الثابتة والمعدات (استبعاد)',
        debit: 0,
        credit: cost,
        lineText: `استبعاد القيمة التاريخية للأصل ${asset.assetNumber}`,
      });
    } else {
      // SALE:
      // Debit Cash/Receivable for proceeds
      if (proceeds > 0) {
        lines.push({
          lineNumber: lineNumber++,
          accountNumber: '110010',
          accountName: 'الصندوق / البنك / المقبوضات النقدية',
          debit: proceeds,
          credit: 0,
          lineText: `متحصلات بيع الأصل ${asset.assetNumber}`,
        });
      }
      // Debit Accumulated Depreciation
      if (accDep > 0) {
        lines.push({
          lineNumber: lineNumber++,
          accountNumber: '150090',
          accountName: 'مجمع إهلاك الأصول الثابتة (إقفال)',
          debit: accDep,
          credit: 0,
          lineText: `إقفال مجمع إهلاك ${asset.assetNumber}`,
        });
      }

      if (gainLoss > 0) {
        // Gain on Sale: Credit Asset Cost, Credit Gain
        lines.push({
          lineNumber: lineNumber++,
          accountNumber: '150010',
          accountName: 'الأصول الثابتة والمعدات (استبعاد)',
          debit: 0,
          credit: cost,
          lineText: `استبعاد الأصل ${asset.assetNumber}`,
        });
        lines.push({
          lineNumber: lineNumber++,
          accountNumber: '409010',
          accountName: 'أرباح بيع واستبعاد أصول ثابتة',
          debit: 0,
          credit: gainLoss,
          lineText: `ربح بيع الأصل ${asset.assetNumber}`,
        });
      } else if (gainLoss < 0) {
        // Loss on Sale: Debit Loss, Credit Asset Cost
        const lossAmount = Math.abs(gainLoss);
        lines.push({
          lineNumber: lineNumber++,
          accountNumber: '504010',
          accountName: 'خسائر بيع واستبعاد أصول ثابتة',
          debit: lossAmount,
          credit: 0,
          costCenter: asset.costCenter,
          lineText: `خسارة بيع الأصل ${asset.assetNumber}`,
        });
        lines.push({
          lineNumber: lineNumber++,
          accountNumber: '150010',
          accountName: 'الأصول الثابتة والمعدات (استبعاد)',
          debit: 0,
          credit: cost,
          lineText: `استبعاد الأصل ${asset.assetNumber}`,
        });
      } else {
        // Proceeds == netBookValue exactly
        lines.push({
          lineNumber: lineNumber++,
          accountNumber: '150010',
          accountName: 'الأصول الثابتة والمعدات (استبعاد)',
          debit: 0,
          credit: cost,
          lineText: `استبعاد الأصل ${asset.assetNumber}`,
        });
      }
    }

    const totalDebit = lines.reduce((acc, l) => acc + l.debit, 0);
    const totalCredit = lines.reduce((acc, l) => acc + l.credit, 0);

    const je: JournalEntry = {
      id: `je-disp-${asset.assetNumber}`,
      docNumber: jeDocNumber,
      status: 'posted',
      companyCode: '1000',
      fiscalYear,
      period,
      postingDate: input.disposalDate,
      documentDate: input.disposalDate,
      documentType: 'SA',
      headerText: `${input.disposalType === 'Scrap' ? 'تخريد واستبعاد' : 'بيع واستبعاد'} الأصل ${asset.assetNumber} - صافي الأثر: ${gainLoss} ريال`,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      lines,
      createdBy: user.id,
      createdAt: now,
      updatedBy: user.id,
      updatedAt: now,
      version: 1,
      isDeleted: false,
    };

    await db.transaction('rw', [db.assets, db.journalEntries, db.auditLogs], async () => {
      await db.journalEntries.add(je);
      await db.assets.update(asset.id, {
        status: 'Disposed',
        disposalDate: input.disposalDate,
        disposalType: input.disposalType,
        disposalProceeds: proceeds,
        disposalGainLoss: gainLoss,
        disposalReason: input.reason,
        disposalJeDocNumber: jeDocNumber,
        netBookValue: 0,
        updatedAt: now,
      });
    });

    await AuditService.log({
      userId: user.id,
      userName: user.fullName,
      action: 'STATUS_CHANGE',
      entity: 'Asset',
      entityId: asset.assetNumber,
      before: { status: asset.status },
      after: { status: 'Disposed', disposalType: input.disposalType, proceeds, gainLoss },
    });

    const updatedAsset = (await assetRepository.getById(asset.id))!;
    return { asset: updatedAsset, je, gainLoss };
  }

  /**
   * Records a technical inspection / condition valuation for an asset.
   */
  static async addTechnicalValuation(
    assetId: string,
    input: AssetValuationInput,
    user: { id: string; fullName: string }
  ): Promise<AssetValuation> {
    requirePermission({ module: 'AM', activity: 'change' });
    const asset = await assetRepository.getById(assetId);
    if (!asset || asset.isDeleted) {
      throw new Error('الأصل المطلوب تسجيل الفحص الفني له غير موجود.');
    }

    const fiscalYear = input.inspectionDate.split('-')[0] || new Date().getFullYear().toString();
    const docNumber = await NumberRangeService.getNextNumber('INSP', fiscalYear);
    const now = new Date().toISOString();

    const valuation: AssetValuation = {
      id: `val-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      docNumber,
      assetId: asset.id,
      assetNumber: asset.assetNumber,
      inspectionDate: input.inspectionDate,
      inspectorName: input.inspectorName,
      inspectorId: input.inspectorId,
      conditionScore: Math.min(100, Math.max(1, input.conditionScore)),
      conditionGrade: input.conditionGrade,
      physicalConditionNotes: input.physicalConditionNotes,
      estimatedMarketValue: input.estimatedMarketValue,
      recommendedAction: input.recommendedAction,
      attachments: input.attachments || [],
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    };

    await db.transaction('rw', [db.assetValuations, db.auditLogs], async () => {
      await db.assetValuations.add(valuation);
    });

    await AuditService.log({
      userId: user.id,
      userName: user.fullName,
      action: 'CREATE',
      entity: 'AssetValuation',
      entityId: valuation.docNumber,
      after: { docNumber: valuation.docNumber, assetNumber: asset.assetNumber, conditionScore: input.conditionScore },
    });

    return valuation;
  }

  /**
   * Retrieves custody and transfer logs for an asset.
   */
  static async getAssetTransfers(assetNumber?: string): Promise<AssetTransfer[]> {
    const all = await assetTransferRepository.list();
    return all.filter((t: AssetTransfer) => {
      if (t.isDeleted) return false;
      if (assetNumber && t.assetNumber !== assetNumber) return false;
      return true;
    });
  }

  /**
   * Retrieves technical valuations for an asset.
   */
  static async getAssetValuations(assetNumber?: string): Promise<AssetValuation[]> {
    const all = await assetValuationRepository.list();
    return all.filter((v: AssetValuation) => {
      if (v.isDeleted) return false;
      if (assetNumber && v.assetNumber !== assetNumber) return false;
      return true;
    });
  }

  /**
   * Compiles executive dashboard KPIs and metrics.
   */
  static async getDashboardKPIs(): Promise<{
    totalAssetsCount: number;
    totalAcquisitionCost: number;
    totalNetBookValue: number;
    totalAccumulatedDepreciation: number;
    inDepreciationCount: number;
    inTransferCount: number;
    barcodeTrackableCount: number;
    aucCount: number;
    categoryBreakdown: { category: AssetClass; name: string; count: number; totalValue: number }[];
    statusCounts: Record<AssetStatus, number>;
  }> {
    const all = await assetRepository.list();
    const assets = all.filter((a: Asset) => !a.isDeleted);

    let totalAcquisitionCost = 0;
    let totalNetBookValue = 0;
    let totalAccumulatedDepreciation = 0;
    let inDepreciationCount = 0;
    let inTransferCount = 0;
    let barcodeTrackableCount = 0;
    let aucCount = 0;

    const statusCounts: Record<AssetStatus, number> = {
      UnderConstruction: 0,
      Active: 0,
      InTransfer: 0,
      InDepreciation: 0,
      Disposed: 0,
    };

    const categoryMap = new Map<AssetClass, { count: number; totalValue: number }>();

    for (const a of assets) {
      if (a.status !== 'Disposed') {
        totalAcquisitionCost += a.acquisitionCost;
        totalNetBookValue += a.netBookValue;
        totalAccumulatedDepreciation += a.accumulatedDepreciation;
      }

      if (a.status === 'InDepreciation') inDepreciationCount++;
      if (a.status === 'InTransfer') inTransferCount++;
      if (a.barcode && a.barcode.length > 0) barcodeTrackableCount++;
      if (a.category === 'AuC' || a.status === 'UnderConstruction') aucCount++;

      if (statusCounts[a.status as AssetStatus] !== undefined) {
        statusCounts[a.status as AssetStatus] += 1;
      }

      const catEntry = categoryMap.get(a.category) || { count: 0, totalValue: 0 };
      catEntry.count += 1;
      catEntry.totalValue += a.netBookValue;
      categoryMap.set(a.category, catEntry);
    }

    const categoryArabicNames: Record<AssetClass, string> = {
      StorageTanks: 'خزانات الوقود والمستودعات',
      Machinery: 'الآلات والمضخات الهيدروليكية',
      Vehicles: 'شاحنات النقل والصهاريج',
      Buildings: 'المباني والمنشآت اللوجستية',
      Pipelines: 'خطوط الأنابيب وشبكات الضخ',
      IT: 'أجهزة وأنظمة تقنية المعلومات',
      AuC: 'مشروعات قيد التنفيذ (AuC)',
    };

    const categoryBreakdown = Array.from(categoryMap.entries()).map(([cat, data]) => ({
      category: cat,
      name: categoryArabicNames[cat] || cat,
      count: data.count,
      totalValue: Math.round(data.totalValue),
    }));

    return {
      totalAssetsCount: assets.length,
      totalAcquisitionCost: Math.round(totalAcquisitionCost),
      totalNetBookValue: Math.round(totalNetBookValue),
      totalAccumulatedDepreciation: Math.round(totalAccumulatedDepreciation),
      inDepreciationCount,
      inTransferCount,
      barcodeTrackableCount,
      aucCount,
      categoryBreakdown,
      statusCounts,
    };
  }
}
