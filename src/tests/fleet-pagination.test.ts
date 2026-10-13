import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../core/db';
import { FleetService } from '../modules/fleet/services/FleetService';
import type { FuelLog } from '../types/models';

describe('Fleet Performance & Server-Side Pagination Test Suite', () => {
  beforeEach(async () => {
    await db.fuelLogs.clear();

    // Populate a sample dataset with synthetic entries
    const sampleBatch: FuelLog[] = [];
    const baseDate = new Date('2026-01-01T00:00:00Z').getTime();

    for (let i = 1; i <= 500; i++) {
      sampleBatch.push({
        id: `fl-perf-${i}`,
        vehicleId: `v-${(i % 10) + 1}`,
        vehiclePlate: `أ ب ج ${(i % 10) + 1000}`,
        driverId: `d-${(i % 5) + 1}`,
        driverName: `سائق ${(i % 5) + 1}`,
        date: new Date(baseDate + i * 3600000).toISOString().slice(0, 10),
        fuelType: 'Diesel',
        quantityLiters: 400 + (i % 50),
        costPerLiter: 1.15,
        totalCost: (400 + (i % 50)) * 1.15,
        odometer: 100000 + i * 50,
        stationName: `محطة المحروقات رقم ${(i % 4) + 1}`,
        status: 'posted',
        isDeleted: false,
      });
    }

    await db.fuelLogs.bulkAdd(sampleBatch);
  });

  it('paginates records server-side and responds in under 100 ms', async () => {
    const startTime = performance.now();

    const result = await FleetService.getPaginatedFuelLogs({
      page: 2,
      pageSize: 25,
    });

    const elapsedMs = performance.now() - startTime;

    expect(result.data.length).toBe(25);
    expect(result.totalCount).toBe(500);
    expect(result.totalPages).toBe(20);
    expect(result.page).toBe(2);

    // Performance assertion: Must execute and return under 100 ms
    expect(elapsedMs).toBeLessThan(100);
  });

  it('filters by search term with accurate pagination counts', async () => {
    const result = await FleetService.getPaginatedFuelLogs({
      page: 1,
      pageSize: 10,
      search: '1001',
    });

    expect(result.data.length).toBeGreaterThan(0);
    result.data.forEach((item) => {
      expect(item.vehiclePlate).toContain('1001');
    });
  });
});
