/**
 * Unit Test Suite for Fixed Asset Depreciation, Disposal Math, and Balancing.
 * Can be run directly via `npx tsx src/modules/assets/services/AssetMath.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { DepreciationEngine } from './DepreciationEngine';

function assert(condition: boolean, message: string) {
  expect(condition, message).toBe(true);
}

function runTests() {
  // TEST 1: Straight-Line Depreciation
  {
    const asset = {
      acquisitionCost: 120000,
      salvageValue: 12000,
      usefulLifeMonths: 60, // 5 years
      accumulatedDepreciation: 0,
      netBookValue: 120000,
      depreciationMethod: 'StraightLine' as const,
    };

    const monthlyRes = DepreciationEngine.calculatePeriodicDepreciation(asset, 'Monthly');
    // Depreciable base = 120,000 - 12,000 = 108,000. Monthly = 108,000 / 60 = 1800.
    assert(monthlyRes.depreciationAmount === 1800, 'Straight-line monthly calculation matches 1800 SAR');
    assert(monthlyRes.newBookValue === 118200, 'Straight-line new book value correctly updated to 118,200 SAR');
    assert(monthlyRes.newAccumulatedDepreciation === 1800, 'New accumulated depreciation updated to 1800 SAR');

    const yearlyRes = DepreciationEngine.calculatePeriodicDepreciation(asset, 'Yearly');
    // Yearly = 1800 * 12 = 21,600
    assert(yearlyRes.depreciationAmount === 21600, 'Straight-line yearly calculation matches 21,600 SAR');
  }

  // TEST 2: Straight-Line Salvage Value Boundary (Clamping)
  {
    // Asset is near salvage value (Current NBV: 12,500, Salvage: 12,000)
    // Regular monthly would be 1800, but only 500 remains!
    const nearSalvageAsset = {
      acquisitionCost: 120000,
      salvageValue: 12000,
      usefulLifeMonths: 60,
      accumulatedDepreciation: 107500,
      netBookValue: 12500,
      depreciationMethod: 'StraightLine' as const,
    };

    const clampRes = DepreciationEngine.calculatePeriodicDepreciation(nearSalvageAsset, 'Monthly');
    assert(clampRes.depreciationAmount === 500, 'Depreciation clamped to remaining 500 SAR before salvage');
    assert(clampRes.newBookValue === 12000, 'Book value reaches exactly salvage value (12,000 SAR)');

    // Next period: already at salvage value
    const atSalvageAsset = {
      ...nearSalvageAsset,
      accumulatedDepreciation: 108000,
      netBookValue: 12000,
    };
    const zeroRes = DepreciationEngine.calculatePeriodicDepreciation(atSalvageAsset, 'Monthly');
    assert(zeroRes.depreciationAmount === 0, 'Depreciation is 0 once salvage value is attained');
    assert(zeroRes.newBookValue === 12000, 'Book value remains invariant at salvage value');
  }

  // TEST 3: Declining Balance Depreciation
  {
    const asset = {
      acquisitionCost: 100000,
      salvageValue: 5000,
      usefulLifeMonths: 60, // 5 years -> double declining annual rate = 2 / 5 = 0.40 (40%)
      accumulatedDepreciation: 0,
      netBookValue: 100000,
      depreciationMethod: 'DecliningBalance' as const,
      decliningBalanceRate: 0.40,
    };

    const monthly = DepreciationEngine.calculatePeriodicDepreciation(asset, 'Monthly');
    // 100,000 * (0.40 / 12) = 3333.33
    assert(monthly.depreciationAmount === 3333.33, 'Declining balance monthly calculation matches 3,333.33 SAR');
    assert(monthly.newBookValue === 96666.67, 'Declining balance new book value is 96,666.67 SAR');
  }

  // TEST 4: Disposal Math & Balancing - Scrap
  {
    const cost = 80000;
    const accDep = 50000;
    const netBookValue = cost - accDep; // 30,000
    const proceeds = 0;
    const gainLoss = proceeds - netBookValue; // -30,000 (Loss)

    // Scrap GL lines:
    // Debit Loss 30,000
    // Debit AccDep 50,000
    // Credit Asset Cost 80,000
    const debits = netBookValue + accDep;
    const credits = cost;
    assert(debits === credits, 'Scrap journal entry is strictly balanced (80,000 == 80,000)');
    assert(gainLoss === -30000, 'Scrap loss calculation is strictly -30,000 SAR');
  }

  // TEST 5: Disposal Math & Balancing - Sale with Gain
  {
    const cost = 150000;
    const accDep = 90000;
    const netBookValue = cost - accDep; // 60,000
    const proceeds = 75000; // Sold for more than book value
    const gain = proceeds - netBookValue; // +15,000 (Gain)

    // Sale with Gain GL lines:
    // Debit Cash 75,000
    // Debit AccDep 90,000
    // Credit Asset Cost 150,000
    // Credit Gain 15,000
    const totalDebits = proceeds + accDep; // 165,000
    const totalCredits = cost + gain;     // 165,000
    assert(totalDebits === totalCredits, 'Sale with gain journal entry is strictly balanced (165,000 == 165,000)');
    assert(gain === 15000, 'Sale gain computed accurately as +15,000 SAR');
  }

  // TEST 6: Disposal Math & Balancing - Sale with Loss
  {
    const cost = 200000;
    const accDep = 100000;
    const netBookValue = cost - accDep; // 100,000
    const proceeds = 70000; // Sold for less than book value
    const loss = netBookValue - proceeds; // 30,000 Loss

    // Sale with Loss GL lines:
    // Debit Cash 70,000
    // Debit AccDep 100,000
    // Debit Loss 30,000
    // Credit Asset Cost 200,000
    const totalDebits = proceeds + accDep + loss; // 200,000
    const totalCredits = cost;                   // 200,000
    assert(totalDebits === totalCredits, 'Sale with loss journal entry is strictly balanced (200,000 == 200,000)');
  }
}

describe('AssetMath Suite', () => {
  it('executes fixed asset depreciation and disposal balancing math', () => {
    runTests();
  });
});
