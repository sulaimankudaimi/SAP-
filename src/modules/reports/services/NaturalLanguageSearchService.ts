import { KPIRegistryService } from './KPIRegistryService';
import type { KPIResult, ReportDefinition } from '../../../types/models';

export interface NLSearchResult {
  query: string;
  matchedKPIs: KPIResult[];
  matchedReportIds: string[];
  intentCategory?: 'procurement' | 'inventory' | 'fleet' | 'assets' | 'finance' | 'predictive';
  suggestedActionLabel?: string;
  suggestedActionTab?: string;
}

export class NaturalLanguageSearchService {
  /**
   * Normalizes Arabic text: strip accents, normalize alef, teh marbuta, etc.
   */
  static normalizeArabic(text: string): string {
    return text
      .trim()
      .toLowerCase()
      .replace(/[إأآا]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[ًٌٍَُِّْ]/g, '')
      .replace(/[؟?.,!:]/g, ' ')
      .replace(/\s+/g, ' ');
  }

  /**
   * Parses natural-language user query into matched KPIs and reports.
   */
  static async search(query: string, allReports: ReportDefinition[]): Promise<NLSearchResult> {
    const rawQuery = query.trim();
    if (!rawQuery) {
      return { query, matchedKPIs: [], matchedReportIds: [] };
    }

    const normQuery = this.normalizeArabic(rawQuery);
    const queryTokens = normQuery.split(' ').filter((w) => w.length > 1);

    // Stop words to skip in matching
    const stopWords = new Set([
      'كم',
      'ما',
      'ماذا',
      'كيف',
      'هل',
      'اين',
      'اريد',
      'اعرض',
      'تقرير',
      'تقريري',
      'كشف',
      'احصائيات',
      'مؤشر',
      'نسبه',
      'الخاص',
      'في',
      'عن',
      'الي',
      'مع',
    ]);
    const cleanTokens = queryTokens.filter((t) => !stopWords.has(t));
    const tokensToMatch = cleanTokens.length > 0 ? cleanTokens : queryTokens;

    // 1. Fetch calculated KPIs
    const allKPIs = await KPIRegistryService.getAllCalculatedKPIs();

    // Match KPIs by token presence in name, formula, or keywords
    const scoredKPIs: { kpi: KPIResult; score: number }[] = [];

    for (const kpi of allKPIs) {
      let score = 0;
      const normName = this.normalizeArabic(kpi.name);
      const normKey = kpi.key.toLowerCase();
      const normDesc = this.normalizeArabic(kpi.description);

      for (const token of tokensToMatch) {
        if (normName.includes(token)) score += 3;
        if (normKey.includes(token.toLowerCase())) score += 5;
        if (normDesc.includes(token)) score += 1;
        for (const kw of kpi.keywords) {
          const normKw = this.normalizeArabic(kw);
          if (normKw.includes(token) || token.includes(normKw)) score += 4;
        }
      }

      if (score > 0) {
        scoredKPIs.push({ kpi, score });
      }
    }

    scoredKPIs.sort((a, b) => b.score - a.score);
    const matchedKPIs = scoredKPIs.slice(0, 3).map((item) => item.kpi);

    // 2. Match Reports
    const scoredReports: { report: ReportDefinition; score: number }[] = [];
    for (const rep of allReports) {
      let score = 0;
      const normTitle = this.normalizeArabic(rep.title);
      const normDesc = this.normalizeArabic(rep.description);
      const normCode = rep.code.toLowerCase();

      for (const token of tokensToMatch) {
        if (normTitle.includes(token)) score += 3;
        if (normCode.includes(token.toLowerCase())) score += 4;
        if (normDesc.includes(token)) score += 1;
      }

      if (score > 0) {
        scoredReports.push({ report: rep, score });
      }
    }

    scoredReports.sort((a, b) => b.score - a.score);
    const matchedReportIds = scoredReports.slice(0, 4).map((item) => item.report.id);

    // Determine intent category
    let intentCategory: NLSearchResult['intentCategory'] = undefined;
    let suggestedActionLabel: string | undefined = undefined;
    let suggestedActionTab: string | undefined = undefined;

    if (
      normQuery.includes('تنبؤ') ||
      normQuery.includes('توقع') ||
      normQuery.includes('شذوذ') ||
      normQuery.includes('انحراف')
    ) {
      intentCategory = 'predictive';
      suggestedActionLabel = 'فتح مركز التحليلات التنبؤية وكشف الشذوذ الإحصائي';
      suggestedActionTab = 'predictive';
    } else if (normQuery.includes('شراء') || normQuery.includes('مورد') || normQuery.includes('عقد')) {
      intentCategory = 'procurement';
      suggestedActionLabel = 'عرض لوحة مؤشرات المشتريات والتوريدات';
      suggestedActionTab = 'dashboards';
    } else if (normQuery.includes('مخزون') || normQuery.includes('بضاع') || normQuery.includes('مستودع')) {
      intentCategory = 'inventory';
      suggestedActionLabel = 'عرض لوحة إدارة ومراقبة المخزون';
      suggestedActionTab = 'dashboards';
    } else if (normQuery.includes('اسطول') || normQuery.includes('شاحن') || normQuery.includes('وقود')) {
      intentCategory = 'fleet';
      suggestedActionLabel = 'عرض لوحة تشغيل الأسطول واستهلاك الوقود';
      suggestedActionTab = 'dashboards';
    } else if (normQuery.includes('اصل') || normQuery.includes('اهلاك') || normQuery.includes('عهده')) {
      intentCategory = 'assets';
      suggestedActionLabel = 'عرض لوحة الأصول الرأسمالية والاستهلاك';
      suggestedActionTab = 'dashboards';
    } else if (normQuery.includes('مالي') || normQuery.includes('قيد') || normQuery.includes('ميزان')) {
      intentCategory = 'finance';
      suggestedActionLabel = 'عرض لوحة الإدارة المالية والتكاليف';
      suggestedActionTab = 'dashboards';
    }

    return {
      query,
      matchedKPIs,
      matchedReportIds,
      intentCategory,
      suggestedActionLabel,
      suggestedActionTab,
    };
  }
}
