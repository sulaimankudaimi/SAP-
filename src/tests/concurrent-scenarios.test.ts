import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, GulfErpDatabase } from '../core/db';
import { DatabaseSeeder } from '../seed';
import { useAuthStore } from '../core/auth/useAuthStore';
import { AuthService } from '../core/services/AuthService';
import { SessionContext } from '../core/security/SessionContext';
import { FleetService } from '../modules/fleet/services/FleetService';
import { InventoryService } from '../modules/inventory/services/InventoryService';
import { AccountsPayableService } from '../modules/finance/services/AccountsPayableService';
import { ThreeWayMatchService } from '../modules/finance/services/ThreeWayMatchService';
import { NumberRangeService } from '../core/services/NumberRangeService';
import { poRepository } from '../core/repositories';
import { ConcurrencyError, DependencyError } from '../core/errors';
import type { PurchaseOrder, VendorInvoice } from '../types/models';

describe('Concurrent Scenarios & High-Integrity Multi-User Protection Suite', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    useAuthStore.getState().logout();
    SessionContext.clearActor();

    // Reset and seed database in demo mode with authenticated admin
    await DatabaseSeeder.resetAndSeed({ demoMode: true });
    const adminSession = await AuthService.login('admin', 'Admin@123');
    useAuthStore.getState().setSession(adminSession);
  });

  // ---------------------------------------------------------------------------
  // Scenario 4a: Two connections edit the same vehicle
  // ---------------------------------------------------------------------------
  it('4a. Both edit the same vehicle -> second save throws ConcurrencyError, first value preserved', async () => {
    // Two client connections to the same underlying fake-indexeddb database
    const conn1 = new GulfErpDatabase();
    const conn2 = new GulfErpDatabase();

    const vehicle = (await conn1.vehicles.toArray())[0];
    expect(vehicle).toBeDefined();

    const initialVersion = vehicle.version || 1;

    // Both "windows" load the record concurrently at initialVersion
    const user1ExpectedVersion = initialVersion;
    const user2ExpectedVersion = initialVersion;

    // User 1 saves first
    const savedV1 = await FleetService.updateVehicle(
      vehicle.id,
      { makeModel: 'فولفو إف إتش 16 توربو (Volvo FH16 Turbo)' },
      'user-window-1',
      user1ExpectedVersion
    );
    expect(savedV1.makeModel).toBe('فولفو إف إتش 16 توربو (Volvo FH16 Turbo)');
    expect(savedV1.version).toBe(initialVersion + 1);

    // User 2 attempts to save with stale version
    await expect(
      FleetService.updateVehicle(
        vehicle.id,
        { makeModel: 'مرسيدس أكتروس محرك ديزل 2026 (Mercedes Actros)' },
        'user-window-2',
        user2ExpectedVersion
      )
    ).rejects.toThrow(ConcurrencyError);

    // Verify stored record: first value is preserved, version incremented once
    const reloaded = await conn2.vehicles.get(vehicle.id);
    expect(reloaded?.makeModel).toBe('فولفو إف إتش 16 توربو (Volvo FH16 Turbo)');
    expect(reloaded?.version).toBe(initialVersion + 1);
  });

  // ---------------------------------------------------------------------------
  // Scenario 4b: Goods receipt and invoice entry for the same PO via Promise.all
  // ---------------------------------------------------------------------------
  it('4b. Goods receipt posting and invoice entry for the same PO via Promise.all -> three-way match consistent, one journal per doc, balances equal ledger sums', async () => {
    // Setup a clean PO for 100 units at 50 SYP
    const poDocNumber = 'PO-2026-CONC01';
    const unitPrice = 50;
    const quantity = 100;
    const netAmount = unitPrice * quantity; // 5000 SYP
    const taxRate = 0.0; // Syria default tax rate 0%
    const vatAmount = netAmount * taxRate; // 0 SYP
    const totalAmount = netAmount + vatAmount; // 5000 SYP

    const newPo: PurchaseOrder = {
      id: `po-conc-${Date.now()}`,
      docNumber: poDocNumber,
      status: 'approved',
      vendorCode: 'VEND-001',
      vendorName: 'الشركة العربية لخدمات الحفر',
      companyCode: '1000',
      plantCode: '1100',
      orderDate: '2026-03-20',
      deliveryDate: '2026-03-25',
      totalAmount,
      currency: 'SYP',
      paymentTerms: 'Net 30',
      items: [
        {
          lineItem: 10,
          materialCode: 'MAT-CHEM-001',
          materialName: 'مثبط تآكل كيميائي لأنابيب الحفر',
          quantity,
          receivedQuantity: 0,
          unit: 'L',
          unitPrice,
          totalPrice: netAmount,
          storageLocation: 'SL01',
        },
      ],
      createdBy: 'admin',
      createdAt: new Date().toISOString(),
      updatedBy: 'admin',
      updatedAt: new Date().toISOString(),
      version: 1,
      isDeleted: false,
    };
    await db.purchaseOrders.put(newPo);

    // Run GR posting and Vendor Invoice entry concurrently via Promise.all
    const grPromise = InventoryService.postMaterialDocument({
      movementType: '101',
      plantCode: '1100',
      storageLocation: 'SL01',
      poNumber: poDocNumber,
      items: [
        {
          materialCode: 'MAT-CHEM-001',
          quantity,
          unitPrice,
          storageLocation: 'SL01',
        },
      ],
      userId: 'admin',
    });

    const invPromise = AccountsPayableService.createInvoice({
      vendorCode: 'VEND-001',
      vendorInvoiceNumber: 'INV-CONC-9901',
      poNumber: poDocNumber,
      invoiceDate: '2026-03-20',
      postingDate: '2026-03-20',
      dueDate: '2026-04-20',
      totalAmount,
      vatAmount,
      netAmount,
      items: [
        {
          lineItem: 10,
          description: 'مثبط تآكل كيميائي لأنابيب الحفر',
          quantity,
          unitPrice,
          amount: netAmount,
          vatRate: taxRate,
          vatAmount,
          totalWithVat: totalAmount,
          poItemNumber: 10,
        },
      ],
    }, 'admin');

    const [grDoc, inv] = await Promise.all([grPromise, invPromise]);

    expect(grDoc.docNumber).toBeTruthy();
    expect(inv.docNumber).toBeTruthy();

    // 1. Three-way match outcome is consistent with committed GR quantity
    const matchResult = await ThreeWayMatchService.evaluateInvoice(inv);
    expect(matchResult.isMatched).toBe(true);
    expect(matchResult.details.grQuantityTotal).toBe(quantity);
    expect(matchResult.details.invoiceQuantityTotal).toBe(quantity);
    expect(matchResult.reasons).toHaveLength(0);

    // 2. Exactly one journal per document in postingRegistry
    const grRegistry = await db.postingRegistry
      .where('[sourceType+sourceId+event]')
      .equals(['GOODS_RECEIPT', grDoc.docNumber, 'POST'])
      .toArray();
    expect(grRegistry).toHaveLength(1);

    const invRegistry = await db.postingRegistry
      .where('[sourceType+sourceId+event]')
      .equals(['VENDOR_INVOICE', inv.id, 'POST'])
      .toArray();
    expect(invRegistry).toHaveLength(1);

    // 3. Balances equal ledger sums: every journal entry debits == credits
    const grJe = await db.journalEntries.where('docNumber').equals(grRegistry[0].journalDocNumber).first();
    expect(grJe).toBeDefined();
    expect(grJe!.totalDebit).toBeCloseTo(grJe!.totalCredit, 2);

    const invJe = await db.journalEntries.where('docNumber').equals(invRegistry[0].journalDocNumber).first();
    expect(invJe).toBeDefined();
    expect(invJe!.totalDebit).toBeCloseTo(invJe!.totalCredit, 2);
  });

  // ---------------------------------------------------------------------------
  // Scenario 4c: Two issues competing for the last unit of stock
  // ---------------------------------------------------------------------------
  it('4c. Two issues of the last unit -> exactly one succeeds, stock never negative', async () => {
    const matCode = 'MAT-SOLO-01';
    const plant = '1100';
    const sloc = 'SL01';

    // Set unrestricted quantity to exactly 1
    const balanceKey = `bal-${matCode}-${plant}-${sloc}`;
    await db.stockBalances.put({
      id: balanceKey,
      materialCode: matCode,
      plantCode: plant,
      storageLocation: sloc,
      unrestrictedQty: 1,
      qualityInspectionQty: 0,
      blockedQty: 0,
      unit: 'L',
      movingAveragePrice: 200,
      totalValuation: 200,
      lastMovementDate: '2026-03-20',
      isDeleted: false,
    });

    const issuePayload = {
      movementType: '201' as const, // Goods Issue for Cost Center
      plantCode: plant,
      storageLocation: sloc,
      items: [
        {
          materialCode: matCode,
          quantity: 1,
          plantCode: plant,
          storageLocation: sloc,
          costCenter: 'CC-1100',
        },
      ],
      userId: 'admin',
    };

    // Competing concurrent issues
    const [res1, res2] = await Promise.allSettled([
      InventoryService.postMaterialDocument(issuePayload),
      InventoryService.postMaterialDocument(issuePayload),
    ]);

    const successes = [res1, res2].filter((r) => r.status === 'fulfilled');
    const failures = [res1, res2].filter((r) => r.status === 'rejected');

    // Exactly one succeeds and one cleanly fails
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    // The rejected reason clearly states insufficient stock
    const rejectedReason = (failures[0] as PromiseRejectedResult).reason;
    expect(rejectedReason.message).toMatch(/الرصيد المتاح.*لا يكفي/);

    // Stock balance in DB is exactly 0 and NEVER negative
    const finalBal = await db.stockBalances
      .where('[materialCode+plantCode+storageLocation]')
      .equals([matCode, plant, sloc])
      .first();
    expect(finalBal?.unrestrictedQty).toBe(0);
    expect(finalBal?.unrestrictedQty).toBeGreaterThanOrEqual(0);
  });

  // ---------------------------------------------------------------------------
  // Scenario 4d: Delete a PO after an invoice references it
  // ---------------------------------------------------------------------------
  it('4d. Delete a PO after an invoice references it -> DependencyError, PO unchanged', async () => {
    const poNumber = 'PO-2026-DEP001';
    const po = await poRepository.create({
      id: `po-dep-${Date.now()}`,
      docNumber: poNumber,
      status: 'draft',
      vendorCode: 'VEND-001',
      vendorName: 'الشركة العربية لخدمات الحفر',
      companyCode: '1000',
      plantCode: '1100',
      orderDate: '2026-03-20',
      deliveryDate: '2026-03-25',
      totalAmount: 1500,
      currency: 'SYP',
      paymentTerms: 'Net 30',
      items: [],
      createdBy: 'admin',
      createdAt: new Date().toISOString(),
      updatedBy: 'admin',
      updatedAt: new Date().toISOString(),
      version: 1,
      isDeleted: false,
    });

    // Add an invoice referencing this PO
    const inv: VendorInvoice = {
      id: `inv-ref-${Date.now()}`,
      docNumber: 'INV-2026-REF001',
      vendorCode: 'VEND-001',
      vendorInvoiceNumber: 'EXT-99988',
      poNumber: poNumber,
      invoiceDate: '2026-03-20',
      postingDate: '2026-03-20',
      dueDate: '2026-04-20',
      totalAmount: 1725,
      vatAmount: 225,
      netAmount: 1500,
      paymentStatus: 'Unpaid',
      items: [],
      status: 'posted',
      createdBy: 'admin',
      createdAt: new Date().toISOString(),
      updatedBy: 'admin',
      updatedAt: new Date().toISOString(),
      version: 1,
      isDeleted: false,
    };
    await db.vendorInvoices.put(inv);

    // Attempting to delete the PO must be rejected by DependencyGuard
    await expect(poRepository.delete(po.id)).rejects.toThrow(DependencyError);

    // The PO remains active and untouched in the database
    const poInDb = await db.purchaseOrders.get(po.id);
    expect(poInDb).toBeDefined();
    expect(poInDb?.isDeleted).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Scenario 4e: Cancel a posted invoice
  // ---------------------------------------------------------------------------
  it('4e. Cancel a posted invoice -> reversal journal created once, double cancel rejected', async () => {
    const postedInvoice = await AccountsPayableService.createInvoice({
      vendorCode: 'VEND-001',
      vendorInvoiceNumber: 'INV-REV-7701',
      invoiceDate: '2026-03-20',
      postingDate: '2026-03-20',
      dueDate: '2026-04-20',
      totalAmount: 2000,
      vatAmount: 0,
      netAmount: 2000,
      items: [
        {
          lineItem: 10,
          description: 'مثبط تآكل كيميائي لأنابيب الحفر',
          quantity: 20,
          unitPrice: 100,
          amount: 2000,
          vatRate: 0,
          vatAmount: 0,
          totalWithVat: 2000,
        },
      ],
    }, 'admin');

    expect(postedInvoice.jeDocNumber).toBeTruthy();

    // 1. Cancel invoice first time
    const cancelResult = await AccountsPayableService.cancelInvoice(
      postedInvoice.id,
      'إلغاء وعكس بسبب خطأ تسعير التوريد الفعلي',
      'admin'
    );
    expect(cancelResult.reversalDocNumber).toBeTruthy();
    expect(cancelResult.invoice.status).toBe('cancelled');
    expect(cancelResult.invoice.paymentStatus).toBe('Cancelled');

    // Reversal journal exists in journal entries
    const revJe = await db.journalEntries
      .where('docNumber')
      .equals(cancelResult.reversalDocNumber)
      .first();
    expect(revJe).toBeDefined();
    expect(revJe?.totalDebit).toBeCloseTo(revJe!.totalCredit, 2);

    // 2. Double cancel must be rejected immediately
    await expect(
      AccountsPayableService.cancelInvoice(
        postedInvoice.id,
        'محاولة إلغاء ثانية غير مسموحة',
        'admin'
      )
    ).rejects.toThrow('تم إلغاء/عكس هذه الفاتورة مسبقاً.');

    // Exactly one reversal entry in registry
    const registryEntry = await db.postingRegistry
      .where('[sourceType+sourceId+event]')
      .equals(['VENDOR_INVOICE', postedInvoice.id, 'POST'])
      .first();
    expect(registryEntry?.isReversed).toBe(true);
    expect(registryEntry?.reversalDocNumber).toBe(cancelResult.reversalDocNumber);
  });

  // ---------------------------------------------------------------------------
  // Scenario 4f: Two users requesting numbers 200 times in parallel
  // ---------------------------------------------------------------------------
  it('4f. Two users requesting numbers 200 times in parallel -> all numbers unique and gap-free', async () => {
    const docType = 'CONC_NR_TEST';
    const fiscalYear = '2026';

    // Two users generate 200 numbers each in parallel (400 total)
    const user1Promises = Array.from({ length: 200 }, () =>
      NumberRangeService.getNextNumber(docType, fiscalYear)
    );
    const user2Promises = Array.from({ length: 200 }, () =>
      NumberRangeService.getNextNumber(docType, fiscalYear)
    );

    const allNumbers = await Promise.all([...user1Promises, ...user2Promises]);

    // 1. Exactly 400 numbers returned
    expect(allNumbers).toHaveLength(400);

    // 2. All 400 numbers are distinct (no duplicates)
    const uniqueNumbers = new Set(allNumbers);
    expect(uniqueNumbers.size).toBe(400);

    // 3. Gap-free sequential numbers from 1 to 400
    const sequenceNumbers = allNumbers
      .map((str) => {
        const parts = str.split('-');
        return parseInt(parts[parts.length - 1], 10);
      })
      .sort((a, b) => a - b);

    for (let i = 0; i < 400; i++) {
      expect(sequenceNumbers[i]).toBe(i + 1);
    }
  });
});
