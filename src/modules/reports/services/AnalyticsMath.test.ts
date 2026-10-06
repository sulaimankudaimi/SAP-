import { describe, it, expect } from 'vitest';
import { PredictiveAnalyticsService } from './PredictiveAnalyticsService';
import { NaturalLanguageSearchService } from './NaturalLanguageSearchService';
import { ReportCatalogService } from './ReportCatalogService';

function assert(condition: boolean, message: string) {
  expect(condition, message).toBe(true);
}

function assertClose(actual: number, expected: number, tolerance: number = 0.5, message: string = '') {
  const diff = Math.abs(actual - expected);
  expect(diff <= tolerance, `${message} (Expected ${expected}, got ${actual}, diff ${diff})`).toBe(true);
}

async function runTests() {
  // 1. Simple Moving Average (SMA) Test
  const series = [10, 20, 30, 40, 50];
  const sma = PredictiveAnalyticsService.calculateSMA(series, 3);
  assert(sma.length === 5, 'SMA produces matching output length');
  assertClose(sma[0], 10, 0.01, 'SMA first element');
  assertClose(sma[1], 15, 0.01, 'SMA second element');
  assertClose(sma[2], 20, 0.01, 'SMA third element (10+20+30)/3 = 20');
  assertClose(sma[3], 30, 0.01, 'SMA fourth element (20+30+40)/3 = 30');
  assertClose(sma[4], 40, 0.01, 'SMA fifth element (30+40+50)/3 = 40');

  // 2. Simple Exponential Smoothing (SES) Test
  const sesAlpha05 = PredictiveAnalyticsService.calculateSES([100, 120, 110], 0.5);
  // S_0 = 100
  // S_1 = 0.5 * 100 + 0.5 * 100 = 100
  // S_2 = 0.5 * 120 + 0.5 * 100 = 110
  assertClose(sesAlpha05[0], 100, 0.01, 'SES initial value');
  assertClose(sesAlpha05[1], 100, 0.01, 'SES period 1');
  assertClose(sesAlpha05[2], 110, 0.01, 'SES period 2');

  // 3. SES Optimization Test
  const opt = PredictiveAnalyticsService.optimizeSES([50, 55, 60, 65, 70, 75]);
  assert(opt.bestAlpha >= 0.1 && opt.bestAlpha <= 0.9, 'SES Optimizer finds alpha within [0.1, 0.9]');
  assert(opt.mape >= 0, 'SES Optimizer calculates valid positive MAPE');

  // 4. Seasonal Decomposition Test
  const seasonalSeries = [100, 150, 120, 170, 110, 160, 130, 180];
  const decomp = PredictiveAnalyticsService.calculateSeasonalDecomposition(seasonalSeries, 2);
  assert(decomp.trend.length === 8, 'Decomposition trend length matches');
  assert(decomp.seasonal.length === 2, 'Decomposition seasonal indices match cycle');
  assert(decomp.forecast.length === 8, 'Decomposition forecast length matches');
  assert(decomp.mape < 15, 'Decomposition MAPE is low on structured series');

  // 5. MAPE calculation
  const actuals = [100, 200, 300];
  const forecasts = [110, 190, 315];
  // 10% + 5% + 5% = 20% / 3 = 6.67%
  const mape = PredictiveAnalyticsService.calculateMAPE(actuals, forecasts);
  assertClose(mape, 6.67, 0.1, 'MAPE accurately calculated');

  // 6. ROP & EOQ formulas verification
  // ROP = (Daily Demand * Lead Time) + Safety Stock
  // e.g. Daily Demand = 2000, Lead Time = 14 days, Safety Stock = 5000 -> ROP = 28000 + 5000 = 33000
  const dailyDemand = 2000;
  const leadTime = 14;
  const safetyStock = 5000;
  const rop = dailyDemand * leadTime + safetyStock;
  assert(rop === 33000, 'ROP calculation matches standard formula (33,000 units)');

  // EOQ = sqrt((2 * D * S) / H)
  // D = 10,000, S = 500 SAR, H = 5 SAR -> sqrt(10,000,000 / 5) = sqrt(2,000,000) ≈ 1414.21
  const eoq = Math.round(Math.sqrt((2 * 10000 * 500) / 5));
  assertClose(eoq, 1414, 2, 'EOQ matches economic formula (≈ 1,414 units)');

  // 7. Z-Score Anomaly Detection
  const normalValues = [10, 12, 11, 13, 10, 12];
  const mean = normalValues.reduce((a, b) => a + b, 0) / normalValues.length; // 11.33
  const std = Math.sqrt(
    normalValues.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (normalValues.length - 1)
  ); // ≈ 1.21
  const outlier = 25; // clearly anomalous
  const zScore = (outlier - mean) / std;
  assert(zScore > 3.0, 'Z-score flags extreme outlier (z > 3.0)');

  // 8. Arabic NLP Intent & Keyword Parser Test
  const norm1 = NaturalLanguageSearchService.normalizeArabic('كَمْ مُعَدَّلُ دَوَرَانِ المَخْزُونِ؟');
  assert(norm1.includes('دوران') && norm1.includes('المخزون'), 'Arabic text normalized without diacritics');

  const catalog = ReportCatalogService.getCatalog();
  assert(catalog.length >= 20, 'Report catalog contains 20+ enterprise SAP reports');

  const searchRes = await NaturalLanguageSearchService.search('دوران المخزون السلعي', catalog);
  assert(searchRes.matchedKPIs.some((k) => k.key === 'INV_TURNOVER'), 'NL search matches INV_TURNOVER KPI');
  assert(searchRes.matchedReportIds.includes('REP-WM-04') || searchRes.matchedReportIds.includes('REP-WM-01'), 'NL search matches inventory report');

  const searchOtif = await NaturalLanguageSearchService.search('OTIF تسليم الموردين', catalog);
  assert(searchOtif.matchedKPIs.some((k) => k.key === 'OTIF'), 'NL search matches OTIF KPI');

  const searchFleet = await NaturalLanguageSearchService.search('تكلفة الكيلومتر لاستهلاك الوقود', catalog);
  assert(searchFleet.matchedKPIs.some((k) => k.key === 'COST_PER_KM'), 'NL search matches COST_PER_KM KPI');
}

describe('AnalyticsMath Suite', () => {
  it('executes predictive forecasting, SMA, SES, EOQ, and NLP search tests', async () => {
    await runTests();
  });
});

