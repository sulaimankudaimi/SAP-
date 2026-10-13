import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../core/db';
import { IntegrityService } from '../core/services/IntegrityService';
import type {
  Trip,
  JournalEntry,
  StockBalance,
  StockLedgerEntry,
  OutboxCommand,
} from '../types/models';

describe('Integrity Checker & ADR Invariants Automated Verification', () => {
  beforeEach(async () => {
    // Clear relevant tables before each test
    await db.trips.clear();
    await db.fuelLogs.clear();
    await db.maintenanceOrders.clear();
    await db.materialDocuments.clear();
    await db.journalEntries.clear();
    await db.stockBalances.clear();
    await db.stockLedger.clear();
    await db.plants.clear();
    await db.auditLogs.clear();
    await db.outbox.clear();
    await db.integrityRuns.clear();

    // Plant 1100 default
    await db.plants.add({
      id: 'pl-1100',
      code: '1100',
      name: 'محطة الرياض المركزية',
      companyCode: '1000',
      city: 'الرياض',
      allowsNegativeStock: false,
      isDeleted: false,
    });
  });

  // --------------------------------------------------------------------------
  // Test 1: Lists every ADR Invariant
  // --------------------------------------------------------------------------
  it('lists every ADR invariant (all 7 invariants + audit chain + stuck outbox)', async () => {
    const report = await IntegrityService.runIntegrityReport({ executedBy: 'auditor' });

    expect(report.invariants).toHaveLength(7);
    const invariantNumbers = report.invariants.map((i) => i.invariantNumber).sort();
    expect(invariantNumbers).toEqual([1, 2, 3, 4, 5, 6, 7]);

    // Check invariant names
    expect(report.invariants[0].invariantName).toContain('أرقام المستندات فريدة تماماً');
    expect(report.invariants[1].invariantName).toContain('قيد محاسبي متوازن وواحد');
    expect(report.invariants[2].invariantName).toContain('توازن ميزان المراجعة الإجمالي');
    expect(report.invariants[3].invariantName).toContain('تطابق رصيد المخزون مع مجموع سجل الحركات');
    expect(report.invariants[4].invariantName).toContain('حظر الأرصدة المخزنية السالبة');
    expect(report.invariants[5].invariantName).toContain('إسناد كافة العمليات لمستخدم موثق');
    expect(report.invariants[6].invariantName).toContain('سلامة سلسلة التدقيق التشفيرية');

    expect(report.auditChain).toBeDefined();
    expect(report.auditChain.isValid).toBe(true);
    expect(report.stuckOutbox).toBeDefined();
    expect(report.stuckOutbox.count).toBe(0);
    expect(report.status).toBe('PASS');
    expect(report.totalViolations).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Test 2: Detects Duplicate Document Number Violation (Invariant 1)
  // --------------------------------------------------------------------------
  it('detects a seeded duplicate document number in local mode', async () => {
    const duplicateDocNumber = 'TRIP-2026-9999';

    const trip1: Trip = {
      id: 'tr-001',
      docNumber: duplicateDocNumber,
      vehicleId: 'veh-1',
      vehiclePlate: '1234-KSA',
      driverId: 'drv-1',
      driverName: 'خالد السبيعي',
      originPlant: '1100',
      destinationLocation: 'محطة الخرج',
      cargoType: 'Diesel',
      cargoVolumeLiters: 35000,
      scheduledDeparture: new Date().toISOString(),
      scheduledArrival: new Date().toISOString(),
      startOdometer: 100000,
      status: 'dispatched',
      createdBy: 'u-fleet-mgr',
      createdAt: new Date().toISOString(),
      updatedBy: 'u-fleet-mgr',
      updatedAt: new Date().toISOString(),
      version: 1,
      isDeleted: false,
    };

    const trip2: Trip = {
      id: 'tr-002',
      docNumber: duplicateDocNumber, // Duplicate!
      vehicleId: 'veh-2',
      vehiclePlate: '5678-KSA',
      driverId: 'drv-2',
      driverName: 'سعد القحطاني',
      originPlant: '1100',
      destinationLocation: 'محطة المجمعة',
      cargoType: 'Gasoline95',
      cargoVolumeLiters: 30000,
      scheduledDeparture: new Date().toISOString(),
      scheduledArrival: new Date().toISOString(),
      startOdometer: 120000,
      status: 'dispatched',
      createdBy: 'u-fleet-mgr',
      createdAt: new Date().toISOString(),
      updatedBy: 'u-fleet-mgr',
      updatedAt: new Date().toISOString(),
      version: 1,
      isDeleted: false,
    };

    await db.trips.bulkAdd([trip1, trip2]);

    const report = await IntegrityService.runIntegrityReport();
    const inv1 = report.invariants.find((i) => i.invariantNumber === 1);

    expect(inv1).toBeDefined();
    expect(inv1?.status).toBe('FAIL');
    expect(inv1?.violationsCount).toBeGreaterThanOrEqual(1);
    expect(inv1?.sampleIds.some((s) => s.includes(duplicateDocNumber))).toBe(true);
    expect(report.status).toBe('FAIL');
    expect(report.totalViolations).toBeGreaterThan(0);
  });

  // --------------------------------------------------------------------------
  // Test 3: Detects Unbalanced Journal Entry Violation (Invariant 3)
  // --------------------------------------------------------------------------
  it('detects a seeded unbalanced journal entry in local mode', async () => {
    const unbalancedJe: JournalEntry = {
      id: 'je-bad-01',
      docNumber: 'JE-2026-8888',
      companyCode: '1000',
      fiscalYear: '2026',
      period: 10,
      documentType: 'SA',
      status: 'posted',
      documentDate: '2026-10-13',
      postingDate: '2026-10-13',
      headerText: 'قيد غير متوازن للاختبار',
      totalDebit: 5000.0,
      totalCredit: 4500.0, // Difference of 500 SAR!
      lines: [
        {
          lineNumber: 1,
          accountNumber: '601010',
          accountName: 'مصاريف وقود',
          debit: 5000.0,
          credit: 0.0,
          costCenter: 'CC-1100',
          lineText: 'مصاريف وقود',
        },
        {
          lineNumber: 2,
          accountNumber: '201010',
          accountName: 'ذمم مورد وقود',
          debit: 0.0,
          credit: 4500.0,
          lineText: 'ذمم مورد وقود',
        },
      ],
      isParked: false,
      createdBy: 'u-accountant',
      createdAt: new Date().toISOString(),
      updatedBy: 'u-accountant',
      updatedAt: new Date().toISOString(),
      version: 1,
      isDeleted: false,
    };

    await db.journalEntries.add(unbalancedJe);

    const report = await IntegrityService.runIntegrityReport();
    const inv3 = report.invariants.find((i) => i.invariantNumber === 3);

    expect(inv3).toBeDefined();
    expect(inv3?.status).toBe('FAIL');
    expect(inv3?.violationsCount).toBeGreaterThanOrEqual(1);
    expect(inv3?.sampleIds.some((s) => s.includes('JE-2026-8888'))).toBe(true);
    expect(report.status).toBe('FAIL');
  });

  // --------------------------------------------------------------------------
  // Test 4: Detects Stock Balance vs Ledger Sum Mismatch (Invariant 4)
  // --------------------------------------------------------------------------
  it('detects a seeded stock mismatch where balance != ledger sum in local mode', async () => {
    const materialCode = 'MAT-DIESEL-01';
    const plantCode = '1100';
    const storageLocation = 'SL-01';

    // Balance says 100,000 liters
    const stockBalance: StockBalance = {
      id: 'sb-001',
      materialCode,
      plantCode,
      storageLocation,
      unrestrictedQty: 100000,
      qualityInspectionQty: 0,
      blockedQty: 0,
      unit: 'L',
      totalValuation: 150000,
      lastMovementDate: '2026-10-13',
      isDeleted: false,
    };
    await db.stockBalances.add(stockBalance);

    // Ledger only has 60,000 liters (Discrepancy of 40,000 liters!)
    const ledgerEntry: StockLedgerEntry = {
      id: 'sl-001',
      materialCode,
      plantCode,
      storageLocation,
      movementType: '101',
      quantity: 60000,
      unit: 'L',
      amount: 90000,
      unitPrice: 1.5,
      referenceDocNumber: 'MIGO-2026-0001',
      postingDate: '2026-10-13',
      createdBy: 'u-clerk',
      isDeleted: false,
    };
    await db.stockLedger.add(ledgerEntry);

    const report = await IntegrityService.runIntegrityReport();
    const inv4 = report.invariants.find((i) => i.invariantNumber === 4);

    expect(inv4).toBeDefined();
    expect(inv4?.status).toBe('FAIL');
    expect(inv4?.violationsCount).toBeGreaterThanOrEqual(1);
    expect(inv4?.sampleIds.some((s) => s.includes(materialCode))).toBe(true);
    expect(report.status).toBe('FAIL');
  });

  // --------------------------------------------------------------------------
  // Test 5: Detects Stuck Outbox Item (> 24h)
  // --------------------------------------------------------------------------
  it('detects outbox items stuck in pending/needs_review for more than 24 hours', async () => {
    const stuckTime = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(); // 30 hours ago

    const stuckItem: OutboxCommand = {
      id: 'outbox-cmd-stuck-999',
      type: 'fuel_log',
      payload: { vehicleId: 'veh-1', quantity: 500 },
      status: 'needs_review',
      createdAt: stuckTime,
      attempts: 5,
      lastError: 'انقطاع الاتصال بالخادم المرجعي وتجاوز مهلة المحاولة',
      vehicleId: 'veh-1',
    };

    await db.outbox.add(stuckItem);

    const report = await IntegrityService.runIntegrityReport();

    expect(report.stuckOutbox.count).toBe(1);
    expect(report.stuckOutbox.sampleIds).toContain('outbox-cmd-stuck-999');
    expect(report.stuckOutbox.items[0].status).toBe('needs_review');
    expect(report.status).toBe('FAIL');
  });

  // --------------------------------------------------------------------------
  // Test 6: Persistence to integrityRuns Table & History
  // --------------------------------------------------------------------------
  it('persists integrity runs to Dexie integrityRuns table and retrieves history', async () => {
    const report1 = await IntegrityService.runIntegrityReport({ executedBy: 'admin-1' });
    const report2 = await IntegrityService.runIntegrityReport({ executedBy: 'admin-2' });

    expect(report1.id).toBeDefined();
    expect(report2.id).toBeDefined();

    const history = await IntegrityService.getRunHistory();
    expect(history.length).toBe(2);

    const { run, report } = await IntegrityService.getLastRun();
    expect(run).toBeDefined();
    expect(run?.id).toBe(report2.id);
    expect(report?.executedBy).toBe('admin-2');
  });
});
