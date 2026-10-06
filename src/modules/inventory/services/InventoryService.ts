import { db } from '../../../core/db';
import { NumberRangeService } from '../../../core/services/NumberRangeService';
import { AuditService } from '../../../core/services/AuditService';
import { ValuationService } from './ValuationService';
import { financePostingService } from './FinancePostingAdapter';
import { requirePermission } from '../../../core/security/SessionContext';
import type {
  MaterialDocument,
  MaterialDocumentItem,
  MovementTypeCode,
  StockBalance,
  StockLedgerEntry,
  PurchaseOrder,
  PhysicalInventoryDoc,
  PhysicalInventoryItem,
  InventoryAlert,
  AuctionRecord,
  ScannerDeviceStatus,
  Material,
  PurchaseRequisition,
} from '../../../types/models';

export interface PostMovementPayload {
  movementType: MovementTypeCode;
  plantCode: string;
  storageLocation: string;
  postingDate?: string;
  documentDate?: string;
  poNumber?: string;
  deliveryNoteNumber?: string;
  headerText?: string;
  items: Array<{
    materialCode: string;
    quantity: number;
    unitPrice?: number;
    unit?: string;
    storageLocation?: string;
    toPlantCode?: string;
    toStorageLocation?: string;
    batchNumber?: string;
    serialNumber?: string;
    qualityInspection?: boolean;
    costCenter?: string;
    orderNumber?: string;
    scrapReason?: string;
  }>;
  userId: string;
  userName?: string;
  attachmentIds?: string[];
}

export interface ReorderEvaluationSummary {
  totalMaterialsEvaluated: number;
  criticalAlertsCount: number;
  lowAlertsCount: number;
  reorderAlertsCount: number;
  newAlertsCreated: number;
  suggestedPrsCount: number;
}

export interface AbcXyzItem {
  materialCode: string;
  materialName: string;
  groupCode: string;
  currentStock: number;
  unitPrice: number;
  totalValuation: number;
  cumulativeValuePercent: number;
  abcClass: 'A' | 'B' | 'C';
  movementCount: number;
  xyzClass: 'X' | 'Y' | 'Z';
  lastMovementDate: string;
  idleDays: number;
  isSlowMoving: boolean;
}

export class InventoryService {
  /**
   * Checks if negative stock is permitted by system settings.
   */
  static async isNegativeStockAllowed(): Promise<boolean> {
    try {
      const setting = await db.settings.get('allow_negative_stock');
      return setting ? setting.value === 'true' : false;
    } catch {
      return false;
    }
  }

  /**
   * Retrieves or creates a StockBalance record for a specific material + plant + storageLocation.
   */
  static async getOrCreateBalance(
    materialCode: string,
    plantCode: string,
    storageLocation: string
  ): Promise<StockBalance> {
    const id = `bal-${materialCode}-${plantCode}-${storageLocation}`;
    let balance = await db.stockBalances.get(id);

    if (!balance) {
      const mat = await db.materials.where('materialCode').equals(materialCode).first();
      balance = {
        id,
        materialCode,
        plantCode,
        storageLocation,
        unrestrictedQty: 0,
        qualityInspectionQty: 0,
        blockedQty: 0,
        unit: mat?.baseUnit || 'PCS',
        totalValuation: 0,
        movingAveragePrice: mat?.standardPrice || 0,
        lastMovementDate: new Date().toISOString(),
        isDeleted: false,
      };
      await db.stockBalances.add(balance);
    }
    return balance;
  }

  /**
   * Recalculates stock balances for a given material/plant/storageLocation directly from stockLedger
   * ensuring stock ledger remains the single source of truth.
   */
  static async deriveBalanceFromLedger(
    materialCode: string,
    plantCode: string,
    storageLocation: string
  ): Promise<StockBalance> {
    const ledgerEntries = await db.stockLedger
      .where('materialCode')
      .equals(materialCode)
      .and((entry) => entry.plantCode === plantCode && entry.storageLocation === storageLocation && !entry.isDeleted)
      .toArray();

    let unrestrictedQty = 0;
    let totalValuation = 0;
    let lastDate = new Date().toISOString();

    for (const entry of ledgerEntries) {
      unrestrictedQty += entry.quantity;
      totalValuation += entry.amount;
      if (entry.postingDate && entry.postingDate > lastDate) {
        lastDate = entry.postingDate;
      }
    }

    const mat = await db.materials.where('materialCode').equals(materialCode).first();
    const map = unrestrictedQty > 0 ? Math.round((totalValuation / unrestrictedQty) * 10000) / 10000 : mat?.standardPrice || 0;

    const balance: StockBalance = {
      id: `bal-${materialCode}-${plantCode}-${storageLocation}`,
      materialCode,
      plantCode,
      storageLocation,
      unrestrictedQty: Math.max(0, unrestrictedQty),
      qualityInspectionQty: 0,
      blockedQty: 0,
      unit: mat?.baseUnit || 'PCS',
      totalValuation: Math.max(0, totalValuation),
      movingAveragePrice: map,
      lastMovementDate: lastDate,
      isDeleted: false,
    };

    await db.stockBalances.put(balance);
    return balance;
  }

  /**
   * Primary transactional entry point to post any SAP inventory movement.
   * Handles:
   * 1. Availability validation (blocks negative stock unless permitted).
   * 2. Material Document generation (MBLNR-2026-XXXXXX).
   * 3. Stock ledger recording.
   * 4. Balance cache atomic update.
   * 5. Moving Average Price recalculation.
   * 6. PO status update (for 101/102).
   * 7. Phase 8 Finance posting hook.
   * 8. Audit log recording.
   */
  static async postMaterialDocument(payload: PostMovementPayload): Promise<MaterialDocument> {
    const totalAmt = payload.items.reduce((acc, it) => acc + (it.quantity * (it.unitPrice || 0)), 0);
    requirePermission(
      { module: 'WM', activity: 'post' },
      { plant: payload.plantCode, costCenter: payload.items[0]?.costCenter, amount: totalAmt }
    );

    const allowNegative = await this.isNegativeStockAllowed();
    const now = new Date().toISOString();
    const postingDate = payload.postingDate || now.split('T')[0];
    const documentDate = payload.documentDate || postingDate;

    // 1. Availability Checks for Outbound Movements (201, 261, 301, 311, 551, 702, 102)
    const isOutbound = ['102', '201', '261', '301', '311', '551', '702'].includes(payload.movementType);
    if (isOutbound && !allowNegative) {
      for (const item of payload.items) {
        const itemSloc = item.storageLocation || payload.storageLocation;
        const currentBal = await this.getOrCreateBalance(item.materialCode, payload.plantCode, itemSloc);
        if (currentBal.unrestrictedQty < item.quantity) {
          throw new Error(
            `لا يمكن إتمام الصرف / التحويل: الرصيد المتاح للصنف [${item.materialCode}] في الموقع [${itemSloc}] هو (${currentBal.unrestrictedQty} ${currentBal.unit})، وهو أقل من الكمية المطلوبة (${item.quantity}).`
          );
        }
      }
    }

    // 2. Generate Material Document Number (SAP MBLNR)
    const docNumber = await NumberRangeService.getNextNumber('MATDOC', '2026');

    // 3. Process items and update stock
    const processedItems: MaterialDocumentItem[] = [];

    await db.transaction(
      'rw',
      [
        db.materialDocuments,
        db.stockLedger,
        db.stockBalances,
        db.materials,
        db.purchaseOrders,
        db.goodsReceipts,
        db.auditLogs,
      ],
      async () => {
        let lineIdx = 10;

        for (const item of payload.items) {
          const itemSloc = item.storageLocation || payload.storageLocation;
          const material = await db.materials.where('materialCode').equals(item.materialCode).first();
          const currentBal = await this.getOrCreateBalance(item.materialCode, payload.plantCode, itemSloc);

          const unit = item.unit || material?.baseUnit || 'PCS';
          let unitPrice = item.unitPrice ?? material?.standardPrice ?? 0;
          let totalAmount = unitPrice * item.quantity;

          // Compute moving average price upon receipt
          if (['101', '501', '701'].includes(payload.movementType)) {
            const mapRes = ValuationService.calculateMapOnReceipt(
              currentBal.unrestrictedQty,
              currentBal.movingAveragePrice || material?.standardPrice || unitPrice,
              item.quantity,
              unitPrice
            );

            // Update material standard/MAP price
            if (material) {
              await db.materials.update(material.id, {
                standardPrice: mapRes.newMap,
              });
            }

            // Update balance
            if (item.qualityInspection) {
              currentBal.qualityInspectionQty += item.quantity;
            } else {
              currentBal.unrestrictedQty += item.quantity;
            }
            currentBal.movingAveragePrice = mapRes.newMap;
            currentBal.totalValuation = currentBal.unrestrictedQty * mapRes.newMap;
            currentBal.lastMovementDate = postingDate;
            await db.stockBalances.put(currentBal);

            // Record to Stock Ledger (Inbound -> positive quantity)
            await db.stockLedger.add({
              id: `sl-${docNumber}-${lineIdx}`,
              materialCode: item.materialCode,
              plantCode: payload.plantCode,
              storageLocation: itemSloc,
              movementType: payload.movementType,
              referenceDocNumber: payload.poNumber || docNumber,
              quantity: item.quantity,
              unit,
              amount: totalAmount,
              unitPrice,
              movingAveragePriceAfter: mapRes.newMap,
              postingDate,
              createdBy: payload.userId,
              notes: payload.headerText,
              isDeleted: false,
            });
          } else if (['102', '201', '261', '551', '702'].includes(payload.movementType)) {
            // Outbound movements
            const currentMap = currentBal.movingAveragePrice || material?.standardPrice || unitPrice;
            const issueVal = ValuationService.calculateValuationOnIssue(
              currentBal.unrestrictedQty,
              currentMap,
              item.quantity
            );

            currentBal.unrestrictedQty = Math.max(0, currentBal.unrestrictedQty - item.quantity);
            currentBal.totalValuation = issueVal.totalValuation;
            currentBal.lastMovementDate = postingDate;
            await db.stockBalances.put(currentBal);

            unitPrice = currentMap;
            totalAmount = item.quantity * currentMap;

            // Record to Stock Ledger (Outbound -> negative quantity)
            await db.stockLedger.add({
              id: `sl-${docNumber}-${lineIdx}`,
              materialCode: item.materialCode,
              plantCode: payload.plantCode,
              storageLocation: itemSloc,
              movementType: payload.movementType,
              referenceDocNumber: item.orderNumber || item.costCenter || docNumber,
              quantity: -item.quantity,
              unit,
              amount: -totalAmount,
              unitPrice,
              movingAveragePriceAfter: currentMap,
              postingDate,
              createdBy: payload.userId,
              notes: item.scrapReason || payload.headerText,
              isDeleted: false,
            });
          } else if (payload.movementType === '311') {
            // Storage Location Transfer (Same Plant)
            const targetSloc = item.toStorageLocation;
            if (!targetSloc) {
              throw new Error('يجب تحديد المستودع الوجهة في حركة النقل (311)');
            }

            // Issue from source
            currentBal.unrestrictedQty = Math.max(0, currentBal.unrestrictedQty - item.quantity);
            currentBal.totalValuation = currentBal.unrestrictedQty * (currentBal.movingAveragePrice || unitPrice);
            currentBal.lastMovementDate = postingDate;
            await db.stockBalances.put(currentBal);

            await db.stockLedger.add({
              id: `sl-${docNumber}-${lineIdx}-out`,
              materialCode: item.materialCode,
              plantCode: payload.plantCode,
              storageLocation: itemSloc,
              movementType: '311',
              referenceDocNumber: docNumber,
              quantity: -item.quantity,
              unit,
              amount: -(item.quantity * unitPrice),
              unitPrice,
              postingDate,
              createdBy: payload.userId,
              notes: `نقل إلى مستودع ${targetSloc}`,
              isDeleted: false,
            });

            // Receipt into destination
            const targetBal = await this.getOrCreateBalance(item.materialCode, payload.plantCode, targetSloc);
            targetBal.unrestrictedQty += item.quantity;
            targetBal.totalValuation += item.quantity * unitPrice;
            targetBal.lastMovementDate = postingDate;
            await db.stockBalances.put(targetBal);

            await db.stockLedger.add({
              id: `sl-${docNumber}-${lineIdx}-in`,
              materialCode: item.materialCode,
              plantCode: payload.plantCode,
              storageLocation: targetSloc,
              movementType: '311',
              referenceDocNumber: docNumber,
              quantity: item.quantity,
              unit,
              amount: item.quantity * unitPrice,
              unitPrice,
              postingDate,
              createdBy: payload.userId,
              notes: `وارد من مستودع ${itemSloc}`,
              isDeleted: false,
            });
          } else if (payload.movementType === '301') {
            // Plant to Plant Transfer
            const targetPlant = item.toPlantCode;
            const targetSloc = item.toStorageLocation || itemSloc;
            if (!targetPlant) {
              throw new Error('يجب تحديد المحطة / المنشأة الوجهة في حركة النقل بين المحطات (301)');
            }

            // Out from source
            currentBal.unrestrictedQty = Math.max(0, currentBal.unrestrictedQty - item.quantity);
            currentBal.totalValuation = currentBal.unrestrictedQty * (currentBal.movingAveragePrice || unitPrice);
            currentBal.lastMovementDate = postingDate;
            await db.stockBalances.put(currentBal);

            await db.stockLedger.add({
              id: `sl-${docNumber}-${lineIdx}-out`,
              materialCode: item.materialCode,
              plantCode: payload.plantCode,
              storageLocation: itemSloc,
              movementType: '301',
              referenceDocNumber: docNumber,
              quantity: -item.quantity,
              unit,
              amount: -(item.quantity * unitPrice),
              unitPrice,
              postingDate,
              createdBy: payload.userId,
              notes: `نقل بين المحطات إلى ${targetPlant}/${targetSloc}`,
              isDeleted: false,
            });

            // In to destination plant
            const targetBal = await this.getOrCreateBalance(item.materialCode, targetPlant, targetSloc);
            targetBal.unrestrictedQty += item.quantity;
            targetBal.totalValuation += item.quantity * unitPrice;
            targetBal.lastMovementDate = postingDate;
            await db.stockBalances.put(targetBal);

            await db.stockLedger.add({
              id: `sl-${docNumber}-${lineIdx}-in`,
              materialCode: item.materialCode,
              plantCode: targetPlant,
              storageLocation: targetSloc,
              movementType: '301',
              referenceDocNumber: docNumber,
              quantity: item.quantity,
              unit,
              amount: item.quantity * unitPrice,
              unitPrice,
              postingDate,
              createdBy: payload.userId,
              notes: `وارد بين المحطات من ${payload.plantCode}/${itemSloc}`,
              isDeleted: false,
            });
          }

          processedItems.push({
            lineItem: lineIdx,
            materialCode: item.materialCode,
            materialName: material?.name || item.materialCode,
            quantity: item.quantity,
            unit,
            unitPrice,
            totalAmount,
            storageLocation: itemSloc,
            toPlantCode: item.toPlantCode,
            toStorageLocation: item.toStorageLocation,
            batchNumber: item.batchNumber,
            serialNumber: item.serialNumber,
            qualityInspection: item.qualityInspection,
            costCenter: item.costCenter,
            orderNumber: item.orderNumber,
            scrapReason: item.scrapReason,
          });

          lineIdx += 10;
        }

        // 4. Update Purchase Order Status & Quantities for 101 / 102
        if (payload.poNumber && (payload.movementType === '101' || payload.movementType === '102')) {
          const po = await db.purchaseOrders.where('docNumber').equals(payload.poNumber).first();
          if (po) {
            let allCompleted = true;
            let partiallyReceived = false;

            const updatedItems = po.items.map((poItem) => {
              const matchedProcessed = processedItems.find((p) => p.materialCode === poItem.materialCode);
              if (matchedProcessed) {
                const delta = payload.movementType === '101' ? matchedProcessed.quantity : -matchedProcessed.quantity;
                const newRecv = Math.max(0, (poItem.receivedQuantity || 0) + delta);
                if (newRecv < poItem.quantity) {
                  allCompleted = false;
                }
                if (newRecv > 0) {
                  partiallyReceived = true;
                }
                return { ...poItem, receivedQuantity: newRecv };
              }
              if ((poItem.receivedQuantity || 0) < poItem.quantity) {
                allCompleted = false;
              }
              if ((poItem.receivedQuantity || 0) > 0) {
                partiallyReceived = true;
              }
              return poItem;
            });

            const newPoStatus = allCompleted ? 'completed' : partiallyReceived ? 'in_progress' : po.status;

            await db.purchaseOrders.update(po.id, {
              items: updatedItems,
              status: newPoStatus,
              updatedAt: now,
            });

            // Also maintain legacy goodsReceipts table for backward compatibility
            if (payload.movementType === '101') {
              const grNumber = await NumberRangeService.getNextNumber('GR', '2026');
              await db.goodsReceipts.add({
                id: `gr-${docNumber}`,
                docNumber: grNumber,
                status: 'completed',
                poNumber: po.docNumber,
                vendorCode: po.vendorCode,
                deliveryNoteNumber: payload.deliveryNoteNumber || `DN-${docNumber}`,
                postingDate,
                plantCode: payload.plantCode,
                movementType: '101',
                items: processedItems.map((p, idx) => ({
                  lineItem: (idx + 1) * 10,
                  materialCode: p.materialCode,
                  materialName: p.materialName,
                  quantity: p.quantity,
                  unit: p.unit,
                  storageLocation: p.storageLocation,
                  batchNumber: p.batchNumber,
                  serialNumber: p.serialNumber,
                  qualityInspection: p.qualityInspection,
                })),
                createdBy: payload.userId,
                createdAt: now,
                updatedBy: payload.userId,
                updatedAt: now,
                version: 1,
                isDeleted: false,
              });
            }
          }
        }
      }
    );

    // 5. Construct and Save Material Document
    const materialDocument: MaterialDocument = {
      id: `matdoc-${docNumber}`,
      docNumber,
      status: 'posted',
      movementType: payload.movementType,
      postingDate,
      documentDate,
      plantCode: payload.plantCode,
      storageLocation: payload.storageLocation,
      poNumber: payload.poNumber,
      deliveryNoteNumber: payload.deliveryNoteNumber,
      headerText: payload.headerText,
      items: processedItems,
      attachmentIds: payload.attachmentIds,
      createdBy: payload.userId,
      createdAt: now,
      updatedBy: payload.userId,
      updatedAt: now,
      version: 1,
      isDeleted: false,
    };

    // Auto-post accounting entry via Finance Posting Hook (Phase 8 integration)
    const financeRes = await financePostingService.postInventoryMovement(materialDocument);
    materialDocument.accountingDocNumber = financeRes.jeDocNumber;

    await db.materialDocuments.add(materialDocument);

    // Write audit log entry
    await AuditService.log({
      userId: payload.userId,
      userName: payload.userName || 'موظف المستودع',
      action: 'CREATE',
      entity: 'MaterialDocument',
      entityId: materialDocument.id,
      after: {
        docNumber: materialDocument.docNumber,
        movementType: materialDocument.movementType,
        totalItems: materialDocument.items.length,
        accountingDocNumber: materialDocument.accountingDocNumber,
      },
    });

    return materialDocument;
  }

  /**
   * Reorder Engine: Scans all materials and evaluates current balances against
   * reorderPoint, safetyStock, minOrderQty.
   * Creates or updates InventoryAlert records and builds suggested PRs.
   */
  static async evaluateReorderEngine(): Promise<ReorderEvaluationSummary> {
    const materials = await db.materials.where('isDeleted').equals(0 as unknown as string).toArray();
    const stockBalances = await db.stockBalances.where('isDeleted').equals(0 as unknown as string).toArray();

    // Aggregate stock per material
    const stockMap = new Map<string, number>();
    for (const b of stockBalances) {
      const cur = stockMap.get(b.materialCode) || 0;
      stockMap.set(b.materialCode, cur + b.unrestrictedQty);
    }

    let criticalCount = 0;
    let lowCount = 0;
    let reorderCount = 0;
    let newAlerts = 0;
    const now = new Date().toISOString();

    for (const mat of materials) {
      const currentStock = stockMap.get(mat.materialCode) || 0;
      const safety = mat.safetyStock || 0;
      const reorder = mat.reorderPoint || 0;

      if (reorder <= 0 && safety <= 0) continue;

      let alertType: 'critical' | 'low' | 'reorder' | null = null;
      if (currentStock <= safety) {
        alertType = 'critical';
        criticalCount++;
      } else if (currentStock <= reorder) {
        alertType = 'low';
        lowCount++;
      }

      if (alertType) {
        reorderCount++;
        const suggestedQty = Math.max(
          mat.minOrderQty || 50,
          reorder * 2 - currentStock
        );

        const existing = await db.inventoryAlerts
          .where('materialCode')
          .equals(mat.materialCode)
          .and((a) => a.status === 'active' && !a.isDeleted)
          .first();

        if (!existing) {
          const alert: InventoryAlert = {
            id: `alt-${mat.materialCode}-${Date.now()}`,
            materialCode: mat.materialCode,
            materialName: mat.name,
            plantCode: '1100',
            alertType,
            currentStock,
            thresholdQty: alertType === 'critical' ? safety : reorder,
            suggestedReorderQty: suggestedQty,
            unit: mat.baseUnit,
            createdAt: now,
            status: 'active',
            isDeleted: false,
          };
          await db.inventoryAlerts.add(alert);
          newAlerts++;
        }
      }
    }

    return {
      totalMaterialsEvaluated: materials.length,
      criticalAlertsCount: criticalCount,
      lowAlertsCount: lowCount,
      reorderAlertsCount: reorderCount,
      newAlertsCreated: newAlerts,
      suggestedPrsCount: reorderCount,
    };
  }

  /**
   * One-click conversion of an alert to an official Purchase Requisition (PR-2026-XXXXXX).
   */
  static async convertAlertToPurchaseRequisition(
    alertId: string,
    userId: string,
    userName: string
  ): Promise<PurchaseRequisition> {
    const alert = await db.inventoryAlerts.get(alertId);
    if (!alert) {
      throw new Error('تنبيه المخزون غير موجود');
    }

    requirePermission({ module: 'MM', activity: 'create' }, { plant: alert.plantCode });

    const material = await db.materials.where('materialCode').equals(alert.materialCode).first();
    const prDocNumber = await NumberRangeService.getNextNumber('PR', '2026');
    const unitPrice = material?.standardPrice || 100;
    const qty = alert.suggestedReorderQty || 50;
    const totalEstimatedAmount = qty * unitPrice;
    const now = new Date().toISOString();

    const pr: PurchaseRequisition = {
      id: `pr-${prDocNumber}`,
      docNumber: prDocNumber,
      status: 'in_review',
      title: `طلب شراء إعادة تموين مخزني - صنف ${alert.materialName}`,
      department: 'إدارة سلاسل الإمداد والمستودعات',
      costCenter: 'CC-1009', // مستودعات الرياض المركزية
      plantCode: alert.plantCode || '1100',
      totalEstimatedAmount,
      currency: 'SAR',
      items: [
        {
          lineItem: 10,
          materialCode: alert.materialCode,
          materialName: alert.materialName,
          quantity: qty,
          unit: alert.unit,
          estimatedPrice: unitPrice,
          totalPrice: totalEstimatedAmount,
          requiredDate: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().split('T')[0],
        },
      ],
      createdBy: userId,
      createdAt: now,
      updatedBy: userId,
      updatedAt: now,
      version: 1,
      isDeleted: false,
    };

    await db.purchaseRequisitions.add(pr);

    // Update alert status
    await db.inventoryAlerts.update(alert.id, {
      status: 'converted_to_pr',
      convertedPrDocNumber: prDocNumber,
    });

    await AuditService.log({
      userId,
      userName,
      action: 'CREATE',
      entity: 'PurchaseRequisition',
      entityId: pr.id,
      after: {
        docNumber: pr.docNumber,
        sourceAlertId: alert.id,
        amount: totalEstimatedAmount,
      },
    });

    return pr;
  }

  /**
   * Performs ABC/XYZ analysis on all active materials:
   * ABC: Pareto value distribution (A=top 80%, B=next 15%, C=bottom 5%).
   * XYZ: Volatility / Movement frequency based on ledger count.
   * Slow-Moving: Items with no movement in N days (default 60 days).
   */
  static async calculateAbcXyzAnalysis(slowMovingDaysThreshold: number = 60): Promise<AbcXyzItem[]> {
    const materials = await db.materials.where('isDeleted').equals(0 as unknown as string).toArray();
    const stockBalances = await db.stockBalances.where('isDeleted').equals(0 as unknown as string).toArray();
    const ledger = await db.stockLedger.where('isDeleted').equals(0 as unknown as string).toArray();

    // Map stocks and ledger movements
    const stockMap = new Map<string, { qty: number; value: number; lastDate: string }>();
    for (const b of stockBalances) {
      const cur = stockMap.get(b.materialCode) || { qty: 0, value: 0, lastDate: '' };
      cur.qty += b.unrestrictedQty;
      cur.value += b.totalValuation;
      if (b.lastMovementDate && b.lastMovementDate > cur.lastDate) {
        cur.lastDate = b.lastMovementDate;
      }
      stockMap.set(b.materialCode, cur);
    }

    const movementCountMap = new Map<string, number>();
    for (const entry of ledger) {
      movementCountMap.set(entry.materialCode, (movementCountMap.get(entry.materialCode) || 0) + 1);
    }

    // Calculate total inventory valuation
    let totalPortfolioValue = 0;
    const itemsRaw: Array<{
      material: Material;
      stock: number;
      value: number;
      unitPrice: number;
      lastDate: string;
      movements: number;
    }> = [];

    for (const mat of materials) {
      const st = stockMap.get(mat.materialCode) || { qty: 0, value: 0, lastDate: '2026-06-01' };
      const val = st.value > 0 ? st.value : st.qty * mat.standardPrice;
      totalPortfolioValue += val;

      itemsRaw.push({
        material: mat,
        stock: st.qty,
        value: val,
        unitPrice: mat.standardPrice,
        lastDate: st.lastDate || '2026-06-01',
        movements: movementCountMap.get(mat.materialCode) || 0,
      });
    }

    // Sort descending by value for Pareto ABC
    itemsRaw.sort((a, b) => b.value - a.value);

    let runningValue = 0;
    const nowMs = Date.now();
    const result: AbcXyzItem[] = [];

    for (const item of itemsRaw) {
      runningValue += item.value;
      const cumPct = totalPortfolioValue > 0 ? (runningValue / totalPortfolioValue) * 100 : 100;

      let abcClass: 'A' | 'B' | 'C' = 'C';
      if (cumPct <= 80) abcClass = 'A';
      else if (cumPct <= 95) abcClass = 'B';

      let xyzClass: 'X' | 'Y' | 'Z' = 'Z';
      if (item.movements >= 5) xyzClass = 'X';
      else if (item.movements >= 2) xyzClass = 'Y';

      const lastDateMs = new Date(item.lastDate).getTime();
      const idleDays = Math.max(0, Math.floor((nowMs - lastDateMs) / (1000 * 3600 * 24)));
      const isSlowMoving = idleDays >= slowMovingDaysThreshold && item.stock > 0;

      result.push({
        materialCode: item.material.materialCode,
        materialName: item.material.name,
        groupCode: item.material.groupCode,
        currentStock: item.stock,
        unitPrice: item.unitPrice,
        totalValuation: item.value,
        cumulativeValuePercent: Math.round(cumPct * 10) / 10,
        abcClass,
        movementCount: item.movements,
        xyzClass,
        lastMovementDate: item.lastDate,
        idleDays,
        isSlowMoving,
      });
    }

    return result;
  }

  /**
   * Creates an Auction Record for selling obsolete/slow-moving inventory by auction.
   */
  static async createAuctionRecord(params: {
    materialCode: string;
    plantCode: string;
    storageLocation: string;
    quantity: number;
    startingPrice: number;
    reservePrice: number;
    condition: 'Fair' | 'Scrap' | 'UsedGood' | 'Obsolete';
    userId: string;
  }): Promise<AuctionRecord> {
    requirePermission(
      { module: 'WM', activity: 'create' },
      { plant: params.plantCode, amount: params.startingPrice }
    );

    const mat = await db.materials.where('materialCode').equals(params.materialCode).first();
    const num = await NumberRangeService.getNextNumber('AUC', '2026');
    const now = new Date().toISOString();

    const auction: AuctionRecord = {
      id: `auc-${num}`,
      materialCode: params.materialCode,
      materialName: mat?.name || params.materialCode,
      plantCode: params.plantCode,
      storageLocation: params.storageLocation,
      quantity: params.quantity,
      unit: mat?.baseUnit || 'PCS',
      startingPrice: params.startingPrice,
      reservePrice: params.reservePrice,
      currentBid: params.startingPrice,
      currency: 'SAR',
      condition: params.condition,
      auctionReference: `AUC-REF-${num}`,
      status: 'published',
      createdAt: now,
      createdBy: params.userId,
      isDeleted: false,
    };

    await db.auctionRecords.add(auction);
    return auction;
  }

  /**
   * Physical Inventory: Step 1 - Create count document (MI01)
   */
  static async createPhysicalInventoryDoc(params: {
    plantCode: string;
    storageLocation: string;
    freezeMovements?: boolean;
    abcClassFilter?: 'A' | 'B' | 'C' | 'ALL';
    userId: string;
  }): Promise<PhysicalInventoryDoc> {
    requirePermission({ module: 'WM', activity: 'create' }, { plant: params.plantCode });
    const docNumber = await NumberRangeService.getNextNumber('PI', '2026');
    const now = new Date().toISOString();

    // Fetch current balances for the location
    const balances = await db.stockBalances
      .where('plantCode')
      .equals(params.plantCode)
      .and((b) => b.storageLocation === params.storageLocation && !b.isDeleted)
      .toArray();

    const items: PhysicalInventoryItem[] = [];
    let lineIdx = 10;

    for (const b of balances) {
      const mat = await db.materials.where('materialCode').equals(b.materialCode).first();
      if (params.abcClassFilter && params.abcClassFilter !== 'ALL' && mat?.abcClass !== params.abcClassFilter) {
        continue;
      }

      items.push({
        lineItem: lineIdx,
        materialCode: b.materialCode,
        materialName: mat?.name || b.materialCode,
        bookQty: b.unrestrictedQty,
        countedQty: b.unrestrictedQty, // default prefilled or zero
        varianceQty: 0,
        unit: b.unit,
        unitPrice: mat?.standardPrice || b.movingAveragePrice || 0,
        varianceValue: 0,
        counted: false,
      });

      lineIdx += 10;
    }

    const piDoc: PhysicalInventoryDoc = {
      id: `pi-${docNumber}`,
      docNumber,
      status: 'draft',
      plantCode: params.plantCode,
      storageLocation: params.storageLocation,
      countDate: now.split('T')[0],
      freezeMovements: params.freezeMovements || false,
      abcClassFilter: params.abcClassFilter || 'ALL',
      items,
      totalVarianceValue: 0,
      createdBy: params.userId,
      createdAt: now,
      updatedBy: params.userId,
      updatedAt: now,
      version: 1,
      isDeleted: false,
    };

    await db.physicalInventoryDocs.add(piDoc);
    return piDoc;
  }

  /**
   * Physical Inventory: Step 2 & 3 - Save entered counts and recalculate variance (MI04/MI20)
   */
  static async savePhysicalInventoryCounts(
    piId: string,
    countedItems: Array<{ materialCode: string; countedQty: number }>,
    userId: string
  ): Promise<PhysicalInventoryDoc> {
    const pi = await db.physicalInventoryDocs.get(piId);
    if (!pi) throw new Error('مستند الجرد غير موجود');
    requirePermission({ module: 'WM', activity: 'change' }, { plant: pi.plantCode });

    let totalVarianceValue = 0;
    const updatedItems = pi.items.map((item) => {
      const entered = countedItems.find((c) => c.materialCode === item.materialCode);
      if (entered) {
        const varianceQty = entered.countedQty - item.bookQty;
        const varianceValue = varianceQty * item.unitPrice;
        totalVarianceValue += varianceValue;
        return {
          ...item,
          countedQty: entered.countedQty,
          varianceQty,
          varianceValue,
          counted: true,
        };
      }
      return item;
    });

    const now = new Date().toISOString();
    await db.physicalInventoryDocs.update(piId, {
      items: updatedItems,
      totalVarianceValue,
      status: 'in_review',
      updatedBy: userId,
      updatedAt: now,
    });

    return { ...pi, items: updatedItems, totalVarianceValue, status: 'in_review' };
  }

  /**
   * Physical Inventory: Step 4 - Approve and Post Differences (MI07)
   * Shortages (varianceQty < 0) post Movement 702
   * Surpluses (varianceQty > 0) post Movement 701
   */
  static async postPhysicalInventoryDifferences(
    piId: string,
    userId: string,
    userName: string
  ): Promise<{ success: boolean; materialDocNumbers: string[] }> {
    const pi = await db.physicalInventoryDocs.get(piId);
    if (!pi) throw new Error('مستند الجرد غير موجود');
    if (pi.status === 'completed') throw new Error('تم ترحيل فروقات هذا المستند مسبقاً');
    requirePermission({ module: 'WM', activity: 'post' }, { plant: pi.plantCode });

    const materialDocNumbers: string[] = [];

    // Separate surplus and deficit items
    const surplusItems = pi.items.filter((i) => i.varianceQty > 0);
    const deficitItems = pi.items.filter((i) => i.varianceQty < 0);

    // Post Surplus (701)
    if (surplusItems.length > 0) {
      const doc701 = await this.postMaterialDocument({
        movementType: '701',
        plantCode: pi.plantCode,
        storageLocation: pi.storageLocation,
        headerText: `تسوية فروقات جرد فعلي (فائض) - مستند ${pi.docNumber}`,
        items: surplusItems.map((s) => ({
          materialCode: s.materialCode,
          quantity: s.varianceQty,
          unitPrice: s.unitPrice,
          unit: s.unit,
        })),
        userId,
        userName,
      });
      materialDocNumbers.push(doc701.docNumber);
    }

    // Post Deficit (702)
    if (deficitItems.length > 0) {
      const doc702 = await this.postMaterialDocument({
        movementType: '702',
        plantCode: pi.plantCode,
        storageLocation: pi.storageLocation,
        headerText: `تسوية فروقات جرد فعلي (عجز) - مستند ${pi.docNumber}`,
        items: deficitItems.map((d) => ({
          materialCode: d.materialCode,
          quantity: Math.abs(d.varianceQty),
          unitPrice: d.unitPrice,
          unit: d.unit,
        })),
        userId,
        userName,
      });
      materialDocNumbers.push(doc702.docNumber);
    }

    const now = new Date().toISOString();
    await db.physicalInventoryDocs.update(piId, {
      status: 'completed',
      approvedBy: userId,
      approvedAt: now,
      postedDocNumber: materialDocNumbers.join(', '),
      updatedAt: now,
    });

    return {
      success: true,
      materialDocNumbers,
    };
  }

  /**
   * Returns simulated connected RFID and Barcode hardware devices.
   */
  static getScannerDevices(): ScannerDeviceStatus[] {
    return [
      {
        id: 'dev-rfid-01',
        deviceName: 'بوابة RFID الثابتة - مدخل المستودع الرئيسي',
        deviceType: 'FixedGate',
        plantCode: '1100',
        location: 'بوابة الشحن والتفريغ #1',
        ipAddress: '192.168.10.45',
        batteryLevel: 100,
        status: 'online',
        lastSyncAt: new Date(Date.now() - 2 * 60000).toISOString(),
      },
      {
        id: 'dev-handheld-02',
        deviceName: 'قارئ باركود ليزري يدوي (Zebra TC57)',
        deviceType: 'HandheldBarcode',
        plantCode: '1100',
        location: 'منطقة أرفف الزيوت SL02',
        ipAddress: '192.168.10.78',
        batteryLevel: 84,
        status: 'online',
        lastSyncAt: new Date(Date.now() - 5 * 60000).toISOString(),
      },
      {
        id: 'dev-rfid-03',
        deviceName: 'ماسح صهاريج وقود RFID (Long-Range UHF)',
        deviceType: 'RFID',
        plantCode: '1200',
        location: 'رصيف تعبئة ينبع SL01',
        ipAddress: '192.168.20.12',
        batteryLevel: 92,
        status: 'online',
        lastSyncAt: new Date(Date.now() - 8 * 60000).toISOString(),
      },
      {
        id: 'dev-handheld-04',
        deviceName: 'قارئ جرد محمول للسلامة (Honeywell EDA51)',
        deviceType: 'HandheldBarcode',
        plantCode: '1300',
        location: 'مستودع مهمات السلامة SL06',
        ipAddress: '192.168.30.90',
        batteryLevel: 41,
        status: 'warning',
        lastSyncAt: new Date(Date.now() - 25 * 60000).toISOString(),
      },
    ];
  }
}
