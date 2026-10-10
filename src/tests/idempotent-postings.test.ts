import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../core/db';
import { DatabaseSeeder } from '../seed';
import { useAuthStore } from '../core/auth/useAuthStore';
import { AuthService } from '../core/services/AuthService';
import { SessionContext } from '../core/security/SessionContext';
import { AutomaticPostingEngine } from '../modules/finance/services/AutomaticPostingEngine';
import { FleetService } from '../modules/fleet/services/FleetService';
import { NumberRangeService } from '../core/services/NumberRangeService';
import type { JournalEntry } from '../types/models';

describe('Idempotent Postings & Registry Verification Suite', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    useAuthStore.getState().logout();
    SessionContext.clearActor();

    await DatabaseSeeder.resetAndSeed({ demoMode: true });
    const adminSession = await AuthService.login('admin', 'Admin@123');
    useAuthStore.getState().setSession(adminSession);
  });

  // 1. Sequential Idempotency
  it('calling the same posting twice sequentially yields exactly one journal entry and returns existing reference', async () => {
    const sourceType = 'CUSTOM_TEST_SOURCE';
    const sourceId = `src-seq-${Date.now()}`;
    const initialJeCount = await db.journalEntries.count();

    const makeCall = () =>
      AutomaticPostingEngine.executeIdempotentPosting({
        sourceType,
        sourceId,
        createEntry: async () => {
          const docNumber = await NumberRangeService.getNextNumber('JE', '2026');
          const now = new Date().toISOString();
          const entry: JournalEntry = {
            id: `je-${docNumber}`,
            docNumber,
            status: 'posted',
            companyCode: '1000',
            fiscalYear: '2026',
            period: 3,
            postingDate: '2026-03-21',
            documentDate: '2026-03-21',
            documentType: 'SA',
            headerText: 'اختبار قيد متكرر متسلسل',
            totalDebit: 500,
            totalCredit: 500,
            lines: [
              {
                lineNumber: 1,
                accountNumber: '110010',
                accountName: 'الصندوق',
                debit: 500,
                credit: 0,
                lineText: 'مدين',
              },
              {
                lineNumber: 2,
                accountNumber: '401010',
                accountName: 'إيراد',
                debit: 0,
                credit: 500,
                lineText: 'دائن',
              },
            ],
            createdBy: 'admin',
            createdAt: now,
            updatedBy: 'admin',
            updatedAt: now,
            version: 1,
            isDeleted: false,
          };
          return entry;
        },
      });

    // Call 1
    const res1 = await makeCall();
    expect(res1.success).toBe(true);
    expect(res1.isDuplicate).toBeFalsy();
    expect(res1.jeDocNumber).toBeTruthy();

    // Call 2
    const res2 = await makeCall();
    expect(res2.success).toBe(true);
    expect(res2.isDuplicate).toBe(true);
    expect(res2.jeDocNumber).toBe(res1.jeDocNumber); // Exact same document number!

    // Verify only 1 journal entry and 1 registry row in database
    expect(await db.journalEntries.count()).toBe(initialJeCount + 1);
    const regEntries = await db.postingRegistry
      .where('[sourceType+sourceId+event]')
      .equals([sourceType, sourceId, 'POST'])
      .toArray();
    expect(regEntries.length).toBe(1);
    expect(regEntries[0].journalDocNumber).toBe(res1.jeDocNumber);
  });

  // 2. Concurrent Idempotency with Promise.all
  it('calling the same posting twice concurrently via Promise.all yields exactly one journal entry', async () => {
    const sourceType = 'CONCURRENT_TEST_SOURCE';
    const sourceId = `src-conc-${Date.now()}`;
    const initialJeCount = await db.journalEntries.count();

    const makeCall = () =>
      AutomaticPostingEngine.executeIdempotentPosting({
        sourceType,
        sourceId,
        createEntry: async () => {
          const docNumber = await NumberRangeService.getNextNumber('JE', '2026');
          const now = new Date().toISOString();
          const entry: JournalEntry = {
            id: `je-${docNumber}`,
            docNumber,
            status: 'posted',
            companyCode: '1000',
            fiscalYear: '2026',
            period: 3,
            postingDate: '2026-03-21',
            documentDate: '2026-03-21',
            documentType: 'SA',
            headerText: 'اختبار قيد متزامن',
            totalDebit: 800,
            totalCredit: 800,
            lines: [
              {
                lineNumber: 1,
                accountNumber: '110010',
                accountName: 'الصندوق',
                debit: 800,
                credit: 0,
                lineText: 'مدين',
              },
              {
                lineNumber: 2,
                accountNumber: '401010',
                accountName: 'إيراد',
                debit: 0,
                credit: 800,
                lineText: 'دائن',
              },
            ],
            createdBy: 'admin',
            createdAt: now,
            updatedBy: 'admin',
            updatedAt: now,
            version: 1,
            isDeleted: false,
          };
          return entry;
        },
      });

    // Execute concurrent race
    const [resA, resB] = await Promise.all([makeCall(), makeCall()]);

    expect(resA.success).toBe(true);
    expect(resB.success).toBe(true);
    expect(resA.jeDocNumber).toBe(resB.jeDocNumber);

    // Exactly 1 new journal entry persisted
    expect(await db.journalEntries.count()).toBe(initialJeCount + 1);

    const regRows = await db.postingRegistry
      .where('[sourceType+sourceId+event]')
      .equals([sourceType, sourceId, 'POST'])
      .toArray();
    expect(regRows.length).toBe(1);
  });

  // 3. Fleet completeTrip Idempotency
  it('FleetService.completeTrip called twice does not double-post trip costs', async () => {
    const vehicle = (await db.vehicles.toArray())[0];
    const driver = (await db.drivers.toArray())[0];

    const trip = await FleetService.createTrip({
      vehicleId: vehicle.id,
      driverId: driver.id,
      originPlant: '1100',
      destinationLocation: 'Yanbu Terminal',
      cargoType: 'Crude',
      cargoVolumeLiters: 45000,
      scheduledDeparture: '2026-03-20 06:00',
      scheduledArrival: '2026-03-20 18:00',
      startOdometer: vehicle.currentOdometer,
    });

    const initialJeCount = await db.journalEntries.count();

    // First completion
    const completed1 = await FleetService.completeTrip(trip.id, {
      endOdometer: trip.startOdometer + 400,
      fuelLitersConsumed: 160,
      fuelCost: 200,
      driverAllowanceCost: 140,
    });
    expect(completed1.status).toBe('completed');
    expect(completed1.postedAccountingDocNumber).toBeTruthy();

    const jeCountAfterFirst = await db.journalEntries.count();
    expect(jeCountAfterFirst).toBe(initialJeCount + 1);

    // Second completion on same trip
    const completed2 = await FleetService.completeTrip(trip.id, {
      endOdometer: trip.startOdometer + 400,
      fuelLitersConsumed: 160,
      fuelCost: 200,
      driverAllowanceCost: 140,
    });

    // Does NOT create another journal entry!
    expect(await db.journalEntries.count()).toBe(jeCountAfterFirst);

    // Verify registry entry
    const reg = await db.postingRegistry
      .where('[sourceType+sourceId+event]')
      .equals(['FLEET_TRIP', trip.docNumber, 'POST'])
      .first();
    expect(reg).toBeDefined();
    expect(reg?.journalDocNumber).toBe(completed1.postedAccountingDocNumber);
  });

  // 4. Reversal Idempotency
  it('reversing a posting twice throws an error on the second attempt', async () => {
    const sourceType = 'REVERSAL_TEST_SOURCE';
    const sourceId = `src-rev-${Date.now()}`;

    // Post initially
    const postRes = await AutomaticPostingEngine.executeIdempotentPosting({
      sourceType,
      sourceId,
      createEntry: async () => {
        const docNumber = await NumberRangeService.getNextNumber('JE', '2026');
        const now = new Date().toISOString();
        const entry: JournalEntry = {
          id: `je-${docNumber}`,
          docNumber,
          status: 'posted',
          companyCode: '1000',
          fiscalYear: '2026',
          period: 3,
          postingDate: '2026-03-21',
          documentDate: '2026-03-21',
          documentType: 'SA',
          headerText: 'قيد تجريبي للاختبار مع العكس',
          totalDebit: 1200,
          totalCredit: 1200,
          lines: [
            {
              lineNumber: 1,
              accountNumber: '110010',
              accountName: 'الصندوق',
              debit: 1200,
              credit: 0,
              lineText: 'مدين',
            },
            {
              lineNumber: 2,
              accountNumber: '401010',
              accountName: 'إيراد',
              debit: 0,
              credit: 1200,
              lineText: 'دائن',
            },
          ],
          createdBy: 'admin',
          createdAt: now,
          updatedBy: 'admin',
          updatedAt: now,
          version: 1,
          isDeleted: false,
        };
        return entry;
      },
    });

    expect(postRes.success).toBe(true);

    // First reversal: must succeed
    const rev1 = await AutomaticPostingEngine.reversePosting({
      sourceType,
      sourceId,
      reason: 'خطأ في الترحيل الأصلي',
      userId: 'admin',
    });

    expect(rev1.success).toBe(true);
    expect(rev1.reversalDocNumber).toBeTruthy();

    const regAfterRev = await db.postingRegistry
      .where('[sourceType+sourceId+event]')
      .equals([sourceType, sourceId, 'POST'])
      .first();
    expect(regAfterRev?.isReversed).toBe(true);
    expect(regAfterRev?.reversalDocNumber).toBe(rev1.reversalDocNumber);

    // Second reversal: MUST throw error!
    await expect(
      AutomaticPostingEngine.reversePosting({
        sourceType,
        sourceId,
        reason: 'محاولة عكس للمرة الثانية',
        userId: 'admin',
      })
    ).rejects.toThrow('تم عكس هذا القيد مسبقاً');
  });
});
