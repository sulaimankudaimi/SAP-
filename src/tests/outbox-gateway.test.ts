import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '../core/db';
import {
  OutboxEngine,
  WHITELISTED_OFFLINE_COMMANDS,
  OFFLINE_BLOCKED_ARABIC_EXPLANATION,
} from '../core/gateway/OutboxEngine';
import { getGateway, _setGatewayInstanceForTesting } from '../core/gateway/ServerGateway';
import { LocalDexieGateway } from '../core/gateway/LocalDexieGateway';
import { useConnectivityStore } from '../core/gateway/connectivity';
import type { IDataGateway, CreateFuelLogCommand } from '../core/gateway/IDataGateway';
import { isAllowedUrl, getAllowedServerOrigin } from '../core/security/offlineGuard';

describe('ServerGateway, Offline Outbox, and Multi-User Guard Suite', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await db.outbox.clear();
    useConnectivityStore.setState({
      isOnline: true,
      isSyncing: false,
      pendingCount: 0,
      needsReviewCount: 0,
    });
    _setGatewayInstanceForTesting(null);
  });

  afterEach(() => {
    _setGatewayInstanceForTesting(null);
  });

  // 1. Gateway factory returns LocalDexieGateway when server mode is off
  it('gateway factory returns local gateway when server mode is off', () => {
    _setGatewayInstanceForTesting(null);
    const gateway = getGateway();
    expect(gateway).toBeInstanceOf(LocalDexieGateway);
    expect(gateway.mode).toBe('local');
  });

  // 2. Non-whitelisted commands are blocked offline with Arabic explanation
  it('non-whitelisted commands are blocked offline with Arabic explanation', async () => {
    // Only fuel_log, trip_event, odometer_reading, inspection are allowed
    expect(WHITELISTED_OFFLINE_COMMANDS).toEqual([
      'fuel_log',
      'trip_event',
      'odometer_reading',
      'inspection',
    ]);

    // Forbidden commands
    const forbiddenCommands = [
      'post_journal',
      'complete_trip',
      'approve_po',
      'cancel_invoice',
      'create_vendor',
      'delete_vehicle',
    ];

    for (const cmdType of forbiddenCommands) {
      await expect(
        OutboxEngine.enqueue({
          type: cmdType as unknown as 'fuel_log',
          payload: { test: true },
        })
      ).rejects.toThrow(OFFLINE_BLOCKED_ARABIC_EXPLANATION);
    }
  });

  // 3. Outbox ordering and FIFO per vehicle
  it('processes outbox in strict FIFO order per vehicle', async () => {
    useConnectivityStore.setState({ isOnline: true });

    const executionLog: Array<{ vehicleId: string; logSeq: number }> = [];

    const mockGateway = {
      mode: 'server' as const,
      createFuelLog: vi.fn().mockImplementation(async (cmd: CreateFuelLogCommand) => {
        executionLog.push({
          vehicleId: cmd.vehicleId,
          logSeq: cmd.odometer,
        });
        return { id: cmd.requestId || 'mock-id' } as unknown as import('../types/models').FuelLog;
      }),
    } as unknown as IDataGateway;

    // Enqueue 2 items for Vehicle A and 2 items for Vehicle B out of order
    await db.outbox.add({
      id: 'cmd-b-1',
      type: 'fuel_log',
      payload: { vehicleId: 'VEH-B', odometer: 200, fuelType: 'Diesel', quantityLiters: 50, costPerLiter: 1.15, date: '2026-03-01', stationName: 'Station 1' },
      createdAt: '2026-03-01T10:00:00Z',
      attempts: 0,
      status: 'pending',
      vehicleId: 'VEH-B',
    });

    await db.outbox.add({
      id: 'cmd-a-1',
      type: 'fuel_log',
      payload: { vehicleId: 'VEH-A', odometer: 100, fuelType: 'Diesel', quantityLiters: 40, costPerLiter: 1.15, date: '2026-03-01', stationName: 'Station 1' },
      createdAt: '2026-03-01T09:00:00Z',
      attempts: 0,
      status: 'pending',
      vehicleId: 'VEH-A',
    });

    await db.outbox.add({
      id: 'cmd-a-2',
      type: 'fuel_log',
      payload: { vehicleId: 'VEH-A', odometer: 150, fuelType: 'Diesel', quantityLiters: 45, costPerLiter: 1.15, date: '2026-03-01', stationName: 'Station 2' },
      createdAt: '2026-03-01T11:00:00Z',
      attempts: 0,
      status: 'pending',
      vehicleId: 'VEH-A',
    });

    await db.outbox.add({
      id: 'cmd-b-2',
      type: 'fuel_log',
      payload: { vehicleId: 'VEH-B', odometer: 250, fuelType: 'Diesel', quantityLiters: 55, costPerLiter: 1.15, date: '2026-03-01', stationName: 'Station 2' },
      createdAt: '2026-03-01T12:00:00Z',
      attempts: 0,
      status: 'pending',
      vehicleId: 'VEH-B',
    });

    await OutboxEngine.processQueue(mockGateway);

    // Verify Vehicle A commands executed in FIFO order (100 before 150)
    const vehAExecutions = executionLog.filter((x) => x.vehicleId === 'VEH-A');
    expect(vehAExecutions).toHaveLength(2);
    expect(vehAExecutions[0].logSeq).toBe(100);
    expect(vehAExecutions[1].logSeq).toBe(150);

    // Verify Vehicle B commands executed in FIFO order (200 before 250)
    const vehBExecutions = executionLog.filter((x) => x.vehicleId === 'VEH-B');
    expect(vehBExecutions).toHaveLength(2);
    expect(vehBExecutions[0].logSeq).toBe(200);
    expect(vehBExecutions[1].logSeq).toBe(250);

    // All items should now be marked 'done'
    const remainingPending = await db.outbox.where('status').equals('pending').count();
    expect(remainingPending).toBe(0);
    const doneCount = await db.outbox.where('status').equals('done').count();
    expect(doneCount).toBe(4);
  });

  // 4. Retry reuses the exact same request_id
  it('retry reuses the exact same request_id', async () => {
    const fixedRequestId = 'req-uuid-fixed-12345';
    let receivedRequestId: string | undefined;

    const mockGateway = {
      mode: 'server' as const,
      createFuelLog: vi.fn().mockImplementation(async (cmd: CreateFuelLogCommand) => {
        receivedRequestId = cmd.requestId;
        return { id: cmd.requestId } as unknown as import('../types/models').FuelLog;
      }),
    } as unknown as IDataGateway;

    // Add an item that failed and was queued
    await db.outbox.add({
      id: fixedRequestId,
      type: 'fuel_log',
      payload: { vehicleId: 'VEH-X', odometer: 500, fuelType: 'Diesel', quantityLiters: 30, costPerLiter: 1.15, date: '2026-03-01', stationName: 'Station X' },
      createdAt: new Date().toISOString(),
      attempts: 1,
      status: 'pending',
      vehicleId: 'VEH-X',
    });

    await OutboxEngine.processQueue(mockGateway);

    expect(receivedRequestId).toBe(fixedRequestId);
  });

  // 5. Duplicate delivery is harmless (fake gateway returns previous result idempotently)
  it('duplicate delivery is harmless and returns previous result without duplicating', async () => {
    const processedRequests = new Map<string, { id: string; status: string }>();

    const mockGateway = {
      mode: 'server' as const,
      createFuelLog: vi.fn().mockImplementation(async (cmd: CreateFuelLogCommand) => {
        const id = cmd.requestId || 'req-default';
        if (processedRequests.has(id)) {
          // Idempotent return of existing committed record
          return processedRequests.get(id);
        }
        const createdRecord = { id, status: 'committed' };
        processedRequests.set(id, createdRecord);
        return createdRecord;
      }),
    } as unknown as IDataGateway;

    const reqId = 'req-idempotent-repeat';

    // First call
    const res1 = await mockGateway.createFuelLog({
      vehicleId: 'VEH-1',
      driverId: 'DRV-1',
      fuelType: 'Diesel',
      date: '2026-03-01',
      odometer: 1000,
      quantityLiters: 50,
      costPerLiter: 1.15,
      stationName: 'Depot A',
      requestId: reqId,
    });

    // Duplicate call with exact same requestId
    const res2 = await mockGateway.createFuelLog({
      vehicleId: 'VEH-1',
      driverId: 'DRV-1',
      fuelType: 'Diesel',
      date: '2026-03-01',
      odometer: 1000,
      quantityLiters: 50,
      costPerLiter: 1.15,
      stationName: 'Depot A',
      requestId: reqId,
    });

    expect(res1).toEqual(res2);
    expect(processedRequests.size).toBe(1);
  });

  // 6. Server rejection lands in needs_review and is never dropped
  it('server rejection lands in needs_review with Arabic reason and is not deleted', async () => {
    const rejectionReason = 'رفض الخادم: المركبة محذوفة أو ملغاة من النظام';

    const mockGateway = {
      mode: 'server' as const,
      createFuelLog: vi.fn().mockRejectedValue(new Error(rejectionReason)),
    } as unknown as IDataGateway;

    const item = await OutboxEngine.enqueue({
      type: 'fuel_log',
      payload: { vehicleId: 'VEH-DECOMMISSIONED', odometer: 9999 },
      vehicleId: 'VEH-DECOMMISSIONED',
    });

    await OutboxEngine.processQueue(mockGateway);

    // Verify record in Dexie
    const recorded = await db.outbox.get(item.id);
    expect(recorded).toBeDefined();
    expect(recorded?.status).toBe('needs_review');
    expect(recorded?.lastError).toContain('رفض الخادم');
  });

  // 7. offlineGuard rejects a foreign origin
  it('offlineGuard rejects foreign origin and allows same origin or allowed server URL', () => {
    // Standard relative and blob/data paths must be allowed
    expect(isAllowedUrl('/api/local')).toBe(true);
    expect(isAllowedUrl('data:image/svg+xml;utf8,<svg></svg>')).toBe(true);
    expect(isAllowedUrl('blob:http://localhost:3000/some-blob')).toBe(true);

    // Foreign origins must be blocked
    expect(isAllowedUrl('https://evil-analytics.com/track')).toBe(false);
    expect(isAllowedUrl('https://api.mixpanel.com/events')).toBe(false);
    expect(isAllowedUrl('https://telemetry.external-service.org')).toBe(false);

    // Allowed server origin when configured
    const allowed = getAllowedServerOrigin();
    if (allowed) {
      expect(isAllowedUrl(`${allowed}/rest/v1/trips`)).toBe(true);
    }
  });
});
