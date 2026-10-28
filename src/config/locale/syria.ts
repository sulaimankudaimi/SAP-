export interface GovernorateInfo {
  readonly code: string;
  readonly nameAr: string;
  readonly nameEn: string;
}

export interface LocalePlantInfo {
  readonly code: '1100' | '1200' | '1300';
  readonly nameAr: string;
  readonly nameEn: string;
  readonly city: string;
  readonly governorateCode: string;
  readonly isHQ: boolean;
  readonly latitude: number;
  readonly longitude: number;
}

export interface LocaleStorageLocationInfo {
  readonly code: string;
  readonly plantCode: '1100' | '1200' | '1300';
  readonly nameAr: string;
  readonly nameEn: string;
  readonly type: 'MAIN' | 'FUEL' | 'SPARE_PARTS' | 'CHEMICALS' | 'LUBRICANTS' | 'TERMINAL';
}

export type LocaleSiteType = 'FIELD' | 'REFINERY' | 'PORT' | 'DEPOT';

export interface LocaleSiteInfo {
  readonly code: string;
  readonly nameAr: string;
  readonly nameEn: string;
  readonly city: string;
  readonly governorateCode: string;
  readonly type: LocaleSiteType;
  readonly latitude: number;
  readonly longitude: number;
}

export interface LocalePack {
  readonly country: {
    readonly code: 'SY';
    readonly nameAr: string;
    readonly nameEn: string;
  };
  readonly brand: {
    readonly nameAr: 'شركة الشام للطاقة';
    readonly nameEn: 'Sham Energy';
    readonly productName: 'Sham Energy ERP';
  };
  readonly hqCity: 'دمشق';
  readonly currency: {
    readonly code: 'SYP';
    readonly symbolAr: 'ل.س';
    readonly symbolEn: 'SYP';
    readonly decimals: 2;
  };
  readonly secondaryCurrency: 'USD';
  readonly demoFx: {
    readonly sypPerUsd: 120;
    readonly label: 'تجريبي';
  };
  readonly timezone: 'Asia/Damascus';
  readonly dateLocale: 'ar-SY-u-ca-gregory-nu-latn';
  readonly numberLocale: 'en-US';
  readonly phone: {
    readonly countryCode: '+963';
  };
  readonly governorates: readonly GovernorateInfo[];
  readonly plateFormat: {
    readonly kind: 'governorate-number';
  };
  readonly tax: {
    readonly mode: 'configurable';
    readonly defaultRate: 0;
  };
  readonly namePools: {
    readonly firstNames: readonly string[];
    readonly lastNames: readonly string[];
  };
  readonly plants: readonly LocalePlantInfo[];
  readonly storageLocations: readonly LocaleStorageLocationInfo[];
  readonly sites: readonly LocaleSiteInfo[];
  readonly vendorNamePool: readonly string[];
  readonly customerNamePool: readonly string[];
}

export const SYRIA_LOCALE: LocalePack = {
  country: {
    code: 'SY',
    nameAr: 'الجمهورية العربية السورية',
    nameEn: 'Syria',
  },
  brand: {
    nameAr: 'شركة الشام للطاقة',
    nameEn: 'Sham Energy',
    productName: 'Sham Energy ERP',
  },
  hqCity: 'دمشق',
  currency: {
    code: 'SYP',
    symbolAr: 'ل.س',
    symbolEn: 'SYP',
    decimals: 2,
  },
  secondaryCurrency: 'USD',
  demoFx: {
    sypPerUsd: 120,
    label: 'تجريبي',
  },
  timezone: 'Asia/Damascus',
  dateLocale: 'ar-SY-u-ca-gregory-nu-latn',
  numberLocale: 'en-US',
  phone: {
    countryCode: '+963',
  },
  governorates: [
    { code: 'DAM', nameAr: 'دمشق', nameEn: 'Damascus' },
    { code: 'RIF', nameAr: 'ريف دمشق', nameEn: 'Rif Dimashq' },
    { code: 'ALP', nameAr: 'حلب', nameEn: 'Aleppo' },
    { code: 'HMS', nameAr: 'حمص', nameEn: 'Homs' },
    { code: 'HMA', nameAr: 'حماة', nameEn: 'Hama' },
    { code: 'LAT', nameAr: 'اللاذقية', nameEn: 'Latakia' },
    { code: 'TAR', nameAr: 'طرطوس', nameEn: 'Tartus' },
    { code: 'IDL', nameAr: 'إدلب', nameEn: 'Idlib' },
    { code: 'DAR', nameAr: 'درعا', nameEn: 'Daraa' },
    { code: 'SUW', nameAr: 'السويداء', nameEn: 'As-Suwayda' },
    { code: 'QUN', nameAr: 'القنيطرة', nameEn: 'Quneitra' },
    { code: 'DEZ', nameAr: 'دير الزور', nameEn: 'Deir ez-Zor' },
    { code: 'RAQ', nameAr: 'الرقة', nameEn: 'Raqqa' },
    { code: 'HAS', nameAr: 'الحسكة', nameEn: 'Al-Hasakah' },
  ],
  plateFormat: {
    kind: 'governorate-number',
  },
  tax: {
    mode: 'configurable',
    defaultRate: 0,
  },
  namePools: {
    firstNames: [
      'سامر',
      'طارق',
      'باسل',
      'مازن',
      'فادي',
      'غسان',
      'نبيل',
      'وليد',
      'رامي',
      'زياد',
      'عماد',
      'هشام',
      'مروان',
      'أنس',
      'وسيم',
      'لؤي',
      'عمار',
      'كرم',
      'بلال',
      'يامن',
      'ريما',
      'لينا',
      'ديما',
      'سوسن',
      'نور',
      'رنا',
      'هدى',
      'ربى',
      'ندى',
      'سمر',
    ],
    lastNames: [
      'الحلبي',
      'الشامي',
      'الحمصي',
      'الحموي',
      'اللاذقاني',
      'الدمشقي',
      'العسلي',
      'الميداني',
      'القابوني',
      'الكسواني',
      'الزبداني',
      'اليبرودي',
      'البانياسي',
      'الطرطوسي',
      'الإدلبي',
      'الحوراني',
      'الفراتي',
      'التدمري',
      'الجزائري',
      'الصباغ',
      'الحكيم',
      'الخطيب',
      'النجار',
      'الحداد',
      'العطار',
      'البيطار',
      'السمان',
      'الطحان',
      'الملاح',
      'البني',
    ],
  },
  plants: [
    {
      code: '1100',
      nameAr: 'محطة دمشق الرئيسية',
      nameEn: 'Damascus Main Plant',
      city: 'دمشق',
      governorateCode: 'DAM',
      isHQ: true,
      latitude: 33.5138,
      longitude: 36.2765,
    },
    {
      code: '1200',
      nameAr: 'مجمع حمص الصناعي',
      nameEn: 'Homs Industrial Complex',
      city: 'حمص',
      governorateCode: 'HMS',
      isHQ: false,
      latitude: 34.7324,
      longitude: 36.7137,
    },
    {
      code: '1300',
      nameAr: 'محطة بانياس الساحلية',
      nameEn: 'Baniyas Coastal Terminal',
      city: 'بانياس',
      governorateCode: 'TAR',
      isHQ: false,
      latitude: 35.1819,
      longitude: 35.9487,
    },
  ],
  storageLocations: [
    {
      code: 'SL01',
      plantCode: '1100',
      nameAr: 'المستودع المركزي - دمشق',
      nameEn: 'Central Warehouse - Damascus',
      type: 'MAIN',
    },
    {
      code: 'SL02',
      plantCode: '1100',
      nameAr: 'مستودع قطع الغيار - عدرا',
      nameEn: 'Spare Parts Warehouse - Adra',
      type: 'SPARE_PARTS',
    },
    {
      code: 'SL03',
      plantCode: '1200',
      nameAr: 'خزانات الوقود الخام - حمص',
      nameEn: 'Crude & Fuel Tanks - Homs',
      type: 'FUEL',
    },
    {
      code: 'SL04',
      plantCode: '1200',
      nameAr: 'مستودع الكيماويات والزيوت - حمص',
      nameEn: 'Chemicals & Lubricants - Homs',
      type: 'CHEMICALS',
    },
    {
      code: 'SL05',
      plantCode: '1300',
      nameAr: 'ساحة الخزانات الساحلية - بانياس',
      nameEn: 'Coastal Tank Farm - Baniyas',
      type: 'TERMINAL',
    },
    {
      code: 'SL06',
      plantCode: '1300',
      nameAr: 'مستودع التوريدات البحرية - طرطوس',
      nameEn: 'Marine Supply Depot - Tartus',
      type: 'MAIN',
    },
  ],
  sites: [
    {
      code: 'SITE-DEZ',
      nameAr: 'حقل الفرات – دير الزور',
      nameEn: 'Euphrates Field - Deir ez-Zor',
      city: 'دير الزور',
      governorateCode: 'DEZ',
      type: 'FIELD',
      latitude: 35.3359,
      longitude: 40.1408,
    },
    {
      code: 'SITE-HAS',
      nameAr: 'حقل الجزيرة – الحسكة',
      nameEn: 'Jazira Field - Al-Hasakah',
      city: 'الحسكة',
      governorateCode: 'HAS',
      type: 'FIELD',
      latitude: 36.5072,
      longitude: 40.7485,
    },
    {
      code: 'SITE-PAL',
      nameAr: 'حقل البادية – تدمر',
      nameEn: 'Badiya Field - Palmyra',
      city: 'تدمر',
      governorateCode: 'HMS',
      type: 'FIELD',
      latitude: 34.5624,
      longitude: 38.284,
    },
    {
      code: 'SITE-HMS-REF',
      nameAr: 'مصفاة حمص',
      nameEn: 'Homs Refinery',
      city: 'حمص',
      governorateCode: 'HMS',
      type: 'REFINERY',
      latitude: 34.7231,
      longitude: 36.6458,
    },
    {
      code: 'SITE-BAN-REF',
      nameAr: 'مصفاة بانياس',
      nameEn: 'Baniyas Refinery',
      city: 'بانياس',
      governorateCode: 'TAR',
      type: 'REFINERY',
      latitude: 35.2064,
      longitude: 35.9562,
    },
    {
      code: 'SITE-TAR-PRT',
      nameAr: 'مرفأ طرطوس',
      nameEn: 'Tartus Port',
      city: 'طرطوس',
      governorateCode: 'TAR',
      type: 'PORT',
      latitude: 34.9069,
      longitude: 35.8719,
    },
    {
      code: 'SITE-LAT-PRT',
      nameAr: 'مرفأ اللاذقية',
      nameEn: 'Latakia Port',
      city: 'اللاذقية',
      governorateCode: 'LAT',
      type: 'PORT',
      latitude: 35.5236,
      longitude: 35.7647,
    },
    {
      code: 'SITE-DAM-DEP',
      nameAr: 'مستودع دمشق',
      nameEn: 'Damascus Depot',
      city: 'دمشق',
      governorateCode: 'DAM',
      type: 'DEPOT',
      latitude: 33.5138,
      longitude: 36.2765,
    },
  ],
  vendorNamePool: [
    'شركة قاسيون للتوريدات الصناعية (خيالية)',
    'مؤسسة بردى للمعدات النفطية (خيالية)',
    'شركة العاصي للأنابيب والصمامات (خيالية)',
    'المجموعة الشامية للخدمات الهندسية (خيالية)',
    'شركة الفرات للتجهيزات الكهروميكانيكية (خيالية)',
    'مؤسسة الساحل للشحن والخدمات اللوجستية (خيالية)',
    'شركة الشهباء للكيماويات الصناعية (خيالية)',
    'شركة تدمر لحلول الطاقة والحفر (خيالية)',
    'مؤسسة أوغاريت لقطع الغيار الثقيلة (خيالية)',
    'شركة الغوطة لأنظمة السلامة والقياس (خيالية)',
  ],
  customerNamePool: [
    'شركة النور لتوزيع المحروقات (خيالية)',
    'مؤسسة الفيحاء للنقل والتموين (خيالية)',
    'شركة اليرموك للصناعات التحويلية (خيالية)',
    'مجموعة المشرق لمحطات الوقود (خيالية)',
    'شركة الجزيرة للإمداد الزراعي والصناعي (خيالية)',
    'مؤسسة القلمون للخدمات اللوجستية (خيالية)',
    'شركة الساحل السوري للملاحة والتخزين (خيالية)',
    'شركة الكرامة للمقاولات والطرق (خيالية)',
    'مؤسسة الزبداني للتدفئة والوقود (خيالية)',
    'شركة الخابور للتجارة والتوزيع (خيالية)',
  ],
} as const;
