import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../core/db';
import { DatabaseSeeder } from '../seed';
import { useAuthStore } from '../core/auth/useAuthStore';
import { AuthService } from '../core/services/AuthService';
import { SessionContext } from '../core/security/SessionContext';
import { FleetService } from '../modules/fleet/services/FleetService';
import { InventoryService } from '../modules/inventory/services/InventoryService';
import { FinanceService } from '../modules/finance/services/FinanceService';
import { AccountsPayableService } from '../modules/finance/services/AccountsPayableService';
import { DepreciationEngine } from '../modules/assets/services/DepreciationEngine';
import { AssetService } from '../modules/assets/services/AssetService';

describe('Atomic Transactions & Failure-Injection Verification Suite', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    useAuthStore.getState().logout();
    SessionContext.clearActor();

    // Reset and seed database in demo mode with authenticated admin
    await DatabaseSeeder.resetAndSeed({ demoMode: true });
    const adminSession = await AuthService.login('admin', 'Admin@123');
    useAuthStore.getState().setSession(adminSession);
  });

  // 1. FleetService.createTrip
  it('FleetService.createTrip rolls back completely on injected write failure', async () => {
    const vehicle = (await db.vehicles.toArray())[0];
    const driver = (await db.drivers.toArray())[0];
    const initialTripCount = await db.trips.count();
    const initialAuditCount = await db.auditLogs.count();
    const nrBefore = (await db.numberRanges.get('TRIP-2026'))?.currentNumber || 0;

    // Inject failure on db.trips.add
    vi.spyOn(db.trips, 'add').mockRejectedValueOnce(new Error('Injected disk error on db.trips.add'));

    await expect(
      FleetService.createTrip({
        vehicleId: vehicle.id,
        driverId: driver.id,
        originPlant: '1100',
        destinationLocation: 'Dammam Depot',
        cargoType: 'Diesel',
        cargoVolumeLiters: 30000,
        scheduledDeparture: '2026-03-20 08:00',
        scheduledArrival: '2026-03-20 16:00',
        startOdometer: vehicle.currentOdometer,
      })
    ).rejects.toThrow('Injected disk error on db.trips.add');

    // Assert rollbacks
    expect(await db.trips.count()).toBe(initialTripCount);
    const vehicleAfter = await db.vehicles.get(vehicle.id);
    expect(vehicleAfter?.status).toBe(vehicle.status); // Vehicle status unchanged
    const driverAfter = await db.drivers.get(driver.id);
    expect(driverAfter?.status).toBe(driver.status); // Driver status unchanged
    expect(await db.auditLogs.count()).toBe(initialAuditCount);
    const nrAfter = (await db.numberRanges.get('TRIP-2026'))?.currentNumber || 0;
    expect(nrAfter).toBe(nrBefore); // Number range unchanged
  });

  // 2. FleetService.completeTrip
  it('FleetService.completeTrip rolls back trip status, vehicle, driver, journal, and posting registry on failure', async () => {
    const vehicle = (await db.vehicles.toArray())[0];
    const driver = (await db.drivers.toArray())[0];

    // Create an in_progress trip
    const trip = await FleetService.createTrip({
      vehicleId: vehicle.id,
      driverId: driver.id,
      originPlant: '1100',
      destinationLocation: 'Dammam Depot',
      cargoType: 'Diesel',
      cargoVolumeLiters: 30000,
      scheduledDeparture: '2026-03-20 08:00',
      scheduledArrival: '2026-03-20 16:00',
      startOdometer: vehicle.currentOdometer,
    });

    const initialJeCount = await db.journalEntries.count();
    const initialRegCount = await db.postingRegistry.count();
    const initialAuditCount = await db.auditLogs.count();
    const initialJeNr = (await db.numberRanges.get('JE-2026'))?.currentNumber || 0;

    // Inject failure on db.vehicles.update
    vi.spyOn(db.vehicles, 'update').mockRejectedValueOnce(new Error('Injected error on vehicle update'));

    await expect(
      FleetService.completeTrip(trip.id, {
        endOdometer: trip.startOdometer + 350,
        fuelLitersConsumed: 120,
        fuelCost: 150,
      })
    ).rejects.toThrow('Injected error on vehicle update');

    // Assert rollbacks
    const tripAfter = await db.trips.get(trip.id);
    expect(tripAfter?.status).toBe('in_progress'); // Trip remains in_progress
    expect(await db.journalEntries.count()).toBe(initialJeCount); // No journal created
    expect(await db.postingRegistry.count()).toBe(initialRegCount); // No registry created
    expect(await db.auditLogs.count()).toBe(initialAuditCount); // No audit row added
    const jeNrAfter = (await db.numberRanges.get('JE-2026'))?.currentNumber || 0;
    expect(jeNrAfter).toBe(initialJeNr); // JE number range unchanged
  });

  // 3. FleetService.createFuelLog
  it('FleetService.createFuelLog rolls back fuel log, vehicle odometer, journal, and registry on failure', async () => {
    const vehicle = (await db.vehicles.toArray())[0];
    const driver = (await db.drivers.toArray())[0];
    const initialLogCount = await db.fuelLogs.count();
    const initialJeCount = await db.journalEntries.count();
    const initialRegCount = await db.postingRegistry.count();
    const initialAuditCount = await db.auditLogs.count();
    const initialJeNr = (await db.numberRanges.get('JE-2026'))?.currentNumber || 0;

    // Inject failure on db.auditLogs.add
    vi.spyOn(db.auditLogs, 'add').mockRejectedValueOnce(new Error('Injected error on audit log'));

    await expect(
      FleetService.createFuelLog({
        vehicleId: vehicle.id,
        driverId: driver.id,
        fuelType: 'Diesel',
        date: '2026-03-21',
        odometer: vehicle.currentOdometer + 500,
        quantityLiters: 150,
        costPerLiter: 2.18,
        stationName: 'محطة أرامكو الدائري',
      })
    ).rejects.toThrow('Injected error on audit log');

    // Assert rollbacks
    expect(await db.fuelLogs.count()).toBe(initialLogCount);
    const vehicleAfter = await db.vehicles.get(vehicle.id);
    expect(vehicleAfter?.currentOdometer).toBe(vehicle.currentOdometer); // Odometer unchanged
    expect(await db.journalEntries.count()).toBe(initialJeCount);
    expect(await db.postingRegistry.count()).toBe(initialRegCount);
    expect(await db.auditLogs.count()).toBe(initialAuditCount);
    const jeNrAfter = (await db.numberRanges.get('JE-2026'))?.currentNumber || 0;
    expect(jeNrAfter).toBe(initialJeNr);
  });

  // 4. FleetService.issuePartsToMaintenanceOrder
  it('FleetService.issuePartsToMaintenanceOrder rolls back material document, stock, and order update on failure', async () => {
    const vehicle = (await db.vehicles.toArray())[0];
    const material = (await db.materials.toArray())[0];
    const balBefore = await db.stockBalances.where('[materialCode+plantCode+storageLocation]').equals([material.materialCode, '1100', 'SL01']).first();
    const initialStock = balBefore?.unrestrictedQty || 0;

    // Create an active maintenance order
    const order = await FleetService.createMaintenanceOrder({
      vehicleId: vehicle.id,
      orderType: 'Corrective',
      description: 'استبدال فلاتر زيت وفحمات فرامل',
      estimatedCost: 1500,
      startDate: '2026-03-21',
    });

    const initialMatDocCount = await db.materialDocuments.count();
    const initialStockLedgerCount = await db.stockLedger.count();
    const initialJeCount = await db.journalEntries.count();
    const initialAuditCount = await db.auditLogs.count();
    const initialMatDocNr = (await db.numberRanges.get('MATDOC-2026'))?.currentNumber || 0;

    // Inject failure on db.maintenanceOrders.put
    vi.spyOn(db.maintenanceOrders, 'put').mockRejectedValueOnce(new Error('Injected failure on maintenanceOrders.put'));

    await expect(
      FleetService.issuePartsToMaintenanceOrder(
        order.id,
        [
          {
            lineItem: 10,
            materialCode: material.materialCode,
            materialName: material.name,
            quantity: 5,
            unit: material.baseUnit,
            unitPrice: 200,
            totalCost: 1000,
            storageLocation: 'SL01',
          },
        ],
        '1100'
      )
    ).rejects.toThrow('Injected failure on maintenanceOrders.put');

    // Assert rollbacks
    const orderAfter = await db.maintenanceOrders.get(order.id);
    expect(orderAfter?.partsCost).toBe(0); // Parts cost not incremented
    expect(orderAfter?.partsUsed.length).toBe(0); // No parts added
    expect(await db.materialDocuments.count()).toBe(initialMatDocCount);
    expect(await db.stockLedger.count()).toBe(initialStockLedgerCount);
    expect(await db.journalEntries.count()).toBe(initialJeCount);
    expect(await db.auditLogs.count()).toBe(initialAuditCount);

    const balAfter = await db.stockBalances.where('[materialCode+plantCode+storageLocation]').equals([material.materialCode, '1100', 'SL01']).first();
    expect(balAfter?.unrestrictedQty).toBe(initialStock); // Stock balance untouched
    const matDocNrAfter = (await db.numberRanges.get('MATDOC-2026'))?.currentNumber || 0;
    expect(matDocNrAfter).toBe(initialMatDocNr); // MATDOC number range untouched
  });

  // 5. FleetService.completeMaintenanceOrder
  it('FleetService.completeMaintenanceOrder rolls back order completion, vehicle status, and GL posting on failure', async () => {
    const vehicle = (await db.vehicles.toArray())[0];
    const order = await FleetService.createMaintenanceOrder({
      vehicleId: vehicle.id,
      orderType: 'Preventive',
      description: 'صيانة دورية للمحرك',
      estimatedCost: 1200,
      startDate: '2026-03-21',
    });

    const initialJeCount = await db.journalEntries.count();
    const initialRegCount = await db.postingRegistry.count();
    const initialAuditCount = await db.auditLogs.count();
    const initialJeNr = (await db.numberRanges.get('JE-2026'))?.currentNumber || 0;

    // Inject failure on db.auditLogs.add
    vi.spyOn(db.auditLogs, 'add').mockRejectedValueOnce(new Error('Injected error on audit logs'));

    await expect(
      FleetService.completeMaintenanceOrder(order.id, {
        laborHours: 4,
        laborRatePerHour: 120,
        downtimeHours: 6,
        completionDate: '2026-03-21',
      })
    ).rejects.toThrow('Injected error on audit logs');

    // Assert rollbacks
    const orderAfter = await db.maintenanceOrders.get(order.id);
    expect(orderAfter?.status).toBe('in_progress'); // Order not completed
    expect(await db.journalEntries.count()).toBe(initialJeCount);
    expect(await db.postingRegistry.count()).toBe(initialRegCount);
    expect(await db.auditLogs.count()).toBe(initialAuditCount);
    const jeNrAfter = (await db.numberRanges.get('JE-2026'))?.currentNumber || 0;
    expect(jeNrAfter).toBe(initialJeNr);
  });

  // 6. InventoryService (goods receipt 101, goods issue 201, transfer 311, scrapping 551)
  it('InventoryService.postMaterialDocument rolls back for Goods Receipt (101) on failure', async () => {
    const material = (await db.materials.toArray())[0];
    const balBefore = await db.stockBalances.where('[materialCode+plantCode+storageLocation]').equals([material.materialCode, '1100', 'SL01']).first();
    const initialQty = balBefore?.unrestrictedQty || 0;

    const initialMatDocCount = await db.materialDocuments.count();
    const initialLedgerCount = await db.stockLedger.count();
    const initialJeCount = await db.journalEntries.count();
    const initialAuditCount = await db.auditLogs.count();
    const initialMatDocNr = (await db.numberRanges.get('MATDOC-2026'))?.currentNumber || 0;

    // Inject failure on db.auditLogs.add
    vi.spyOn(db.auditLogs, 'add').mockRejectedValueOnce(new Error('Injected failure during GR audit'));

    await expect(
      InventoryService.postMaterialDocument({
        movementType: '101',
        plantCode: '1100',
        storageLocation: 'SL01',
        headerText: 'استلام وقود اختباري',
        items: [
          {
            materialCode: material.materialCode,
            quantity: 100,
            unit: material.baseUnit,
            unitPrice: 50,
          },
        ],
        userId: 'admin',
      })
    ).rejects.toThrow('Injected failure during GR audit');

    // Assert complete rollback
    expect(await db.materialDocuments.count()).toBe(initialMatDocCount);
    expect(await db.stockLedger.count()).toBe(initialLedgerCount);
    expect(await db.journalEntries.count()).toBe(initialJeCount);
    expect(await db.auditLogs.count()).toBe(initialAuditCount);

    const balAfter = await db.stockBalances.where('[materialCode+plantCode+storageLocation]').equals([material.materialCode, '1100', 'SL01']).first();
    expect(balAfter?.unrestrictedQty).toBe(initialQty); // Stock untouched
    const nrAfter = (await db.numberRanges.get('MATDOC-2026'))?.currentNumber || 0;
    expect(nrAfter).toBe(initialMatDocNr); // Number range unchanged
  });

  it('InventoryService.postMaterialDocument rolls back for Goods Issue (201) on failure', async () => {
    const material = (await db.materials.toArray())[0];
    const balBefore = await db.stockBalances.where('[materialCode+plantCode+storageLocation]').equals([material.materialCode, '1100', 'SL01']).first();
    const initialQty = balBefore?.unrestrictedQty || 0;

    const initialMatDocCount = await db.materialDocuments.count();
    const initialJeCount = await db.journalEntries.count();

    // Inject failure on db.stockLedger.add
    vi.spyOn(db.stockLedger, 'add').mockRejectedValueOnce(new Error('Injected stock ledger error'));

    await expect(
      InventoryService.postMaterialDocument({
        movementType: '201',
        plantCode: '1100',
        storageLocation: 'SL01',
        headerText: 'صرف مركز تكلفة اختباري',
        items: [
          {
            materialCode: material.materialCode,
            quantity: 10,
            costCenter: 'CC-1001',
          },
        ],
        userId: 'admin',
      })
    ).rejects.toThrow('Injected stock ledger error');

    expect(await db.materialDocuments.count()).toBe(initialMatDocCount);
    expect(await db.journalEntries.count()).toBe(initialJeCount);
    const balAfter = await db.stockBalances.where('[materialCode+plantCode+storageLocation]').equals([material.materialCode, '1100', 'SL01']).first();
    expect(balAfter?.unrestrictedQty).toBe(initialQty);
  });

  it('InventoryService.postMaterialDocument rolls back for Storage Transfer (311) on failure', async () => {
    const material = (await db.materials.toArray())[0];
    const sourceBal = await db.stockBalances.where('[materialCode+plantCode+storageLocation]').equals([material.materialCode, '1100', 'SL01']).first();
    const initialSourceQty = sourceBal?.unrestrictedQty || 0;

    const initialMatDocCount = await db.materialDocuments.count();
    vi.spyOn(db.auditLogs, 'add').mockRejectedValueOnce(new Error('Injected error on 311 transfer'));

    await expect(
      InventoryService.postMaterialDocument({
        movementType: '311',
        plantCode: '1100',
        storageLocation: 'SL01',
        headerText: 'نقل مخزني بين المستودعات',
        items: [
          {
            materialCode: material.materialCode,
            quantity: 15,
            toStorageLocation: 'SL02',
          },
        ],
        userId: 'admin',
      })
    ).rejects.toThrow('Injected error on 311 transfer');

    expect(await db.materialDocuments.count()).toBe(initialMatDocCount);
    const sourceBalAfter = await db.stockBalances.where('[materialCode+plantCode+storageLocation]').equals([material.materialCode, '1100', 'SL01']).first();
    expect(sourceBalAfter?.unrestrictedQty).toBe(initialSourceQty);
  });

  it('InventoryService.postMaterialDocument rolls back for Scrapping (551) on failure', async () => {
    const material = (await db.materials.toArray())[0];
    const balBefore = await db.stockBalances.where('[materialCode+plantCode+storageLocation]').equals([material.materialCode, '1100', 'SL01']).first();
    const initialQty = balBefore?.unrestrictedQty || 0;

    vi.spyOn(db.auditLogs, 'add').mockRejectedValueOnce(new Error('Injected error on scrapping'));

    await expect(
      InventoryService.postMaterialDocument({
        movementType: '551',
        plantCode: '1100',
        storageLocation: 'SL01',
        headerText: 'تخريد مخزون تالف',
        items: [
          {
            materialCode: material.materialCode,
            quantity: 2,
            costCenter: 'CC-1001',
          },
        ],
        userId: 'admin',
      })
    ).rejects.toThrow('Injected error on scrapping');

    const balAfter = await db.stockBalances.where('[materialCode+plantCode+storageLocation]').equals([material.materialCode, '1100', 'SL01']).first();
    expect(balAfter?.unrestrictedQty).toBe(initialQty);
  });

  // 7. InventoryService.postPhysicalInventoryDifferences (Physical inventory 701/702)
  it('InventoryService.postPhysicalInventoryDifferences rolls back all surplus/deficit material documents and status on failure', async () => {
    const material = (await db.materials.toArray())[0];

    // Create a physical inventory doc with items
    const piDoc = await InventoryService.createPhysicalInventoryDoc({
      plantCode: '1100',
      storageLocation: 'SL01',
      userId: 'admin',
    });

    // Record count with variance (+10 surplus)
    await InventoryService.savePhysicalInventoryCounts(
      piDoc.id,
      [
        {
          materialCode: material.materialCode,
          countedQty: (piDoc.items[0]?.bookQty || 0) + 10,
        },
      ],
      'admin'
    );

    const initialMatDocCount = await db.materialDocuments.count();
    const initialJeCount = await db.journalEntries.count();

    // Inject failure on physicalInventoryDocs.update
    vi.spyOn(db.physicalInventoryDocs, 'update').mockRejectedValueOnce(new Error('Injected error updating PI doc'));

    await expect(
      InventoryService.postPhysicalInventoryDifferences(piDoc.id, 'admin', 'مدير النظام')
    ).rejects.toThrow('Injected error updating PI doc');

    // Assert PI doc status unchanged and no documents left orphaned
    const piAfter = await db.physicalInventoryDocs.get(piDoc.id);
    expect(piAfter?.status).toBe('in_review'); // Not completed
    expect(await db.materialDocuments.count()).toBe(initialMatDocCount);
    expect(await db.journalEntries.count()).toBe(initialJeCount);
  });

  // 8. FinanceService.createJournalEntry
  it('FinanceService.createJournalEntry rolls back journal entry, audit, and JE number range on failure', async () => {
    const initialJeCount = await db.journalEntries.count();
    const initialAuditCount = await db.auditLogs.count();
    const initialNr = (await db.numberRanges.get('JE-2026'))?.currentNumber || 0;

    vi.spyOn(db.auditLogs, 'add').mockRejectedValueOnce(new Error('Injected error on journal entry audit'));

    await expect(
      FinanceService.createJournalEntry({
        companyCode: '1000',
        fiscalYear: '2026',
        period: 3,
        postingDate: '2026-03-21',
        documentDate: '2026-03-21',
        documentType: 'SA',
        headerText: 'قيد محاسبي اختباري للتأكد من التراجع الذري',
        createdBy: 'admin',
        lines: [
          {
            accountNumber: '110010',
            accountName: 'الصندوق',
            debit: 1000,
            credit: 0,
            lineText: 'مدين',
          },
          {
            accountNumber: '401010',
            accountName: 'إيرادات مبيعات',
            debit: 0,
            credit: 1000,
            lineText: 'دائن',
          },
        ],
      })
    ).rejects.toThrow('Injected error on journal entry audit');

    expect(await db.journalEntries.count()).toBe(initialJeCount);
    expect(await db.auditLogs.count()).toBe(initialAuditCount);
    const nrAfter = (await db.numberRanges.get('JE-2026'))?.currentNumber || 0;
    expect(nrAfter).toBe(initialNr); // Sequence counter must be rolled back!
  });

  // 9. AccountsPayableService.executePaymentProposal
  it('AccountsPayableService.executePaymentProposal rolls back payment, invoice status, and journal on failure', async () => {
    const invoice = (await db.vendorInvoices.toArray())[0];
    const initialPaymentCount = await db.payments.count();
    const initialJeCount = await db.journalEntries.count();
    const initialRegCount = await db.postingRegistry.count();
    const initialPayNr = (await db.numberRanges.get('PAY-2026'))?.currentNumber || 0;

    // Inject failure on db.vendorInvoices.update
    vi.spyOn(db.vendorInvoices, 'update').mockRejectedValueOnce(new Error('Injected error on invoice update during payment'));

    await expect(
      AccountsPayableService.executePaymentProposal({
        items: [
          {
            invoiceId: invoice.id,
            invoiceDocNumber: invoice.docNumber,
            vendorInvoiceNumber: invoice.vendorInvoiceNumber,
            vendorCode: invoice.vendorCode,
            vendorName: invoice.vendorName || invoice.vendorCode,
            invoiceDate: invoice.invoiceDate,
            dueDate: invoice.dueDate,
            totalAmount: invoice.totalAmount,
            cashDiscountAmount: 0,
            netPaymentAmount: invoice.totalAmount,
            paymentTerms: 'NT30',
            isBlocked: false,
            selected: true,
          },
        ],
        paymentDate: '2026-03-21',
        bankAccount: '110020 - مصرف الراجحي الرئيسي',
        createdBy: 'admin',
      })
    ).rejects.toThrow('Injected error on invoice update during payment');

    expect(await db.payments.count()).toBe(initialPaymentCount);
    const invAfter = await db.vendorInvoices.get(invoice.id);
    expect(invAfter?.paymentStatus).toBe(invoice.paymentStatus); // Not marked as Paid
    expect(await db.journalEntries.count()).toBe(initialJeCount);
    expect(await db.postingRegistry.count()).toBe(initialRegCount);
    const payNrAfter = (await db.numberRanges.get('PAY-2026'))?.currentNumber || 0;
    expect(payNrAfter).toBe(initialPayNr);
  });

  // 10. DepreciationEngine.postDepreciationRun
  it('DepreciationEngine.postDepreciationRun rolls back run record, asset net book values, journal, and DEP/JE number ranges on failure', async () => {
    const assetsBefore = await db.assets.toArray();
    const initialDepCount = await db.depreciationRuns.count();
    const initialJeCount = await db.journalEntries.count();
    const initialRegCount = await db.postingRegistry.count();
    const initialDepNr = (await db.numberRanges.get('DEP-2026'))?.currentNumber || 0;
    const initialJeNr = (await db.numberRanges.get('JE-2026'))?.currentNumber || 0;

    vi.spyOn(db.auditLogs, 'add').mockRejectedValueOnce(new Error('Injected failure during depreciation run audit'));

    await expect(
      DepreciationEngine.postDepreciationRun({
        fiscalYear: '2026',
        period: 12,
        companyCode: '1000',
        plantCode: '1100',
        user: { id: 'admin', fullName: 'مدير النظام' },
      })
    ).rejects.toThrow('Injected failure during depreciation run audit');

    expect(await db.depreciationRuns.count()).toBe(initialDepCount);
    expect(await db.journalEntries.count()).toBe(initialJeCount);
    expect(await db.postingRegistry.count()).toBe(initialRegCount);

    const depNrAfter = (await db.numberRanges.get('DEP-2026'))?.currentNumber || 0;
    const jeNrAfter = (await db.numberRanges.get('JE-2026'))?.currentNumber || 0;
    expect(depNrAfter).toBe(initialDepNr);
    expect(jeNrAfter).toBe(initialJeNr);

    // Verify assets book values were not mutated
    const assetsAfter = await db.assets.toArray();
    for (let i = 0; i < assetsBefore.length; i++) {
      expect(assetsAfter[i].accumulatedDepreciation).toBe(assetsBefore[i].accumulatedDepreciation);
      expect(assetsAfter[i].netBookValue).toBe(assetsBefore[i].netBookValue);
    }
  });

  // 11. AssetService.createTransfer and AssetService.disposeAsset
  it('AssetService.createTransfer rolls back transfer record, asset status, and AST number range on failure', async () => {
    const asset = (await db.assets.toArray())[0];
    const initialTransferCount = await db.assetTransfers.count();
    const initialAstNr = (await db.numberRanges.get('AST-2026'))?.currentNumber || 0;

    vi.spyOn(db.auditLogs, 'add').mockRejectedValueOnce(new Error('Injected error on transfer audit'));

    await expect(
      AssetService.createTransfer(
        {
          assetId: asset.id,
          toPlant: '1200',
          toCostCenter: 'CC-1002',
          toCustodian: 'سعيد القحطاني',
          reason: 'نقل لمشروع محطة رأس تنورة',
        },
        { id: 'admin', fullName: 'مدير النظام' }
      )
    ).rejects.toThrow('Injected error on transfer audit');

    expect(await db.assetTransfers.count()).toBe(initialTransferCount);
    const assetAfter = await db.assets.get(asset.id);
    expect(assetAfter?.status).toBe(asset.status);
    const astNrAfter = (await db.numberRanges.get('AST-2026'))?.currentNumber || 0;
    expect(astNrAfter).toBe(initialAstNr);
  });

  it('AssetService.disposeAsset rolls back asset retirement, journal, registry, and JE number range on failure', async () => {
    const asset = (await db.assets.toArray())[0];
    const initialJeCount = await db.journalEntries.count();
    const initialRegCount = await db.postingRegistry.count();
    const initialJeNr = (await db.numberRanges.get('JE-2026'))?.currentNumber || 0;

    vi.spyOn(db.auditLogs, 'add').mockRejectedValueOnce(new Error('Injected failure on asset disposal audit'));

    await expect(
      AssetService.disposeAsset(
        asset.id,
        {
          disposalType: 'Scrap',
          disposalDate: '2026-03-21',
          proceeds: 0,
          reason: 'تلف كلي غير اقتصادي للإصلاح',
        },
        { id: 'admin', fullName: 'مدير النظام' }
      )
    ).rejects.toThrow('Injected failure on asset disposal audit');

    const assetAfter = await db.assets.get(asset.id);
    expect(assetAfter?.status).toBe(asset.status); // Not Disposed
    expect(await db.journalEntries.count()).toBe(initialJeCount);
    expect(await db.postingRegistry.count()).toBe(initialRegCount);
    const jeNrAfter = (await db.numberRanges.get('JE-2026'))?.currentNumber || 0;
    expect(jeNrAfter).toBe(initialJeNr);
  });
});
