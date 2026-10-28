import { db } from '../../../core/db';
import { requirePermission } from '../../../core/security/SessionContext';
import { AuditService } from '../../../core/services/AuditService';
import { LOCALE } from '../../../config/locale';
import type { PrintTemplate, PrintDocumentType } from '../../../types/models';

export class PrintTemplateService {
  private static getDefaultTemplates(): PrintTemplate[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'tmpl-po',
        documentType: 'PO',
        companyNameArabic: LOCALE.brand.nameAr,
        companyNameEnglish: LOCALE.brand.nameEn,
        taxNumber: 'SY-TAX-100200',
        commercialRecord: 'DAM-CR-10984',
        headerText: `${LOCALE.country.nameAr} - ${LOCALE.hqCity} - المزة أوتوستراد - هاتف: +963 11 234 5678`,
        footerText: 'أمر شراء رسمي معتمد صادر من النظام الآلي الموحد - يعتبر ملزماً للمورد.',
        termsAndConditions: '1. يخضع التوريد للفحص الفني والمطابقة المخزنية.\n2. تطبق شروط السداد خلال 30 يوماً من استلام الفاتورة الرسمية.\n3. يتحمل المورد كافة أضرار النقل حتى التسليم بموقع المحطة.',
        showSignatureBlock: true,
        showStampBlock: true,
        bankDetails: 'المصرف التجاري السوري - فرع دمشق رقم 1 - حساب: CBS-DAM-00192837',
        updatedAt: now,
      },
      {
        id: 'tmpl-gr',
        documentType: 'GR',
        companyNameArabic: LOCALE.brand.nameAr,
        companyNameEnglish: LOCALE.brand.nameEn,
        taxNumber: 'SY-TAX-100200',
        commercialRecord: 'DAM-CR-10984',
        headerText: 'مستودعات المحطات المركزية - إشعار دخول واستلام مواد (MIGO 101)',
        footerText: 'تم فحص الشحنة ومطابقتها لأمر الشراء المعتمد ومواصفات السلامة المهنية.',
        termsAndConditions: 'تعتبر هذه المواد في عهدة أمين المستودع وتم قيدها دفترياً ومحاسبياً بالنظام.',
        showSignatureBlock: true,
        showStampBlock: true,
        updatedAt: now,
      },
      {
        id: 'tmpl-inv',
        documentType: 'INVOICE',
        companyNameArabic: LOCALE.brand.nameAr,
        companyNameEnglish: LOCALE.brand.nameEn,
        taxNumber: 'SY-TAX-100200',
        commercialRecord: 'DAM-CR-10984',
        headerText: 'فاتورة رسمية معتمدة وفق الأنظمة المالية والضريبية المعتمدة',
        footerText: 'تطبق الضريبة حسب رمز الضريبة المحدد في المستند.',
        termsAndConditions: 'الرجاء سداد المبلغ لحساب الشركة الرسمي الموضح أدناه مع ذكر رقم الفاتورة.',
        showSignatureBlock: true,
        showStampBlock: true,
        bankDetails: 'المصرف التجاري السوري - دمشق - حساب: CBS-DAM-00192837',
        updatedAt: now,
      },
      {
        id: 'tmpl-vouch',
        documentType: 'VOUCHER',
        companyNameArabic: LOCALE.brand.nameAr,
        companyNameEnglish: LOCALE.brand.nameEn,
        taxNumber: 'SY-TAX-100200',
        commercialRecord: 'DAM-CR-10984',
        headerText: 'الإدارة المالية - سند صرف / تحويل بنكي معتمد',
        footerText: 'صدر السند استناداً لأوامر الدفع والاعتماد المالي المرفقة بموجب دورة السداد F110.',
        termsAndConditions: 'يعتبر إشعار التحويل البنكي أو الشيك إبراءً للذمة بمقدار المبلغ المسدد.',
        showSignatureBlock: true,
        showStampBlock: true,
        bankDetails: 'المصرف التجاري السوري - الحساب الجاري للمدفوعات',
        updatedAt: now,
      },
      {
        id: 'tmpl-trip',
        documentType: 'TRIP',
        companyNameArabic: LOCALE.brand.nameAr,
        companyNameEnglish: LOCALE.brand.nameEn,
        taxNumber: 'SY-TAX-100200',
        commercialRecord: 'DAM-CR-10984',
        headerText: 'إدارة النقل واللوجستيات - بوليسة شحن وترحيل شاحنة نفطية معتمدة (Trip Dispatch Sheet)',
        footerText: 'تخضع الشحنة لمعايير السلامة المهنية الصارمة وأنظمة النقل البري المعتمدة.',
        termsAndConditions: '1. يلتزم السائق بمسار النقل المعتمد والسرعات المحددة نظاماً.\n2. يمنع تفريغ أي حمولة دون مطابقة الفحص المخبري وشهادة الجودة.\n3. السائق مسؤول عن سلامة أختام الصهريج وأرقام العدادات.',
        showSignatureBlock: true,
        showStampBlock: true,
        updatedAt: now,
      },
      {
        id: 'tmpl-maint',
        documentType: 'MAINTENANCE',
        companyNameArabic: LOCALE.brand.nameAr,
        companyNameEnglish: LOCALE.brand.nameEn,
        taxNumber: 'SY-TAX-100200',
        commercialRecord: 'DAM-CR-10984',
        headerText: 'ورشة الصيانة المركزية - أمر صيانة وإصلاح أسطول شاحنات الوقود (Maintenance Work Order)',
        footerText: 'تمت الصيانة وفحص الجودة وصرف قطع الغيار وفق مواصفات الصانع ومعايير SAP PM حركة 261.',
        termsAndConditions: '1. تخضع الشاحنة لاختبار السلامة والفحص الفني قبل تسليمها لإدارة الحركة.\n2. تقييد كافة قطع الغيار المصروفة على مركز تكلفة الشاحنة المعنية.\n3. فترة ضمان الأعمال والإصلاحات 30 يوماً من تاريخ الإغلاق.',
        showSignatureBlock: true,
        showStampBlock: true,
        updatedAt: now,
      },
    ];
  }

  static async initTemplatesIfEmpty(): Promise<void> {
    const count = await db.printTemplates.count();
    if (count === 0) {
      const defaults = this.getDefaultTemplates();
      await db.printTemplates.bulkAdd(defaults);
    }
  }

  static async getTemplate(documentType: PrintDocumentType): Promise<PrintTemplate> {
    await this.initTemplatesIfEmpty();
    const tmpl = await db.printTemplates.where('documentType').equals(documentType).first();
    if (tmpl) return tmpl;

    const defaultTmpl = this.getDefaultTemplates().find((t) => t.documentType === documentType);
    return defaultTmpl || this.getDefaultTemplates()[0];
  }

  static async getAllTemplates(): Promise<PrintTemplate[]> {
    await this.initTemplatesIfEmpty();
    return db.printTemplates.toArray();
  }

  static async saveTemplate(template: PrintTemplate): Promise<PrintTemplate> {
    requirePermission({ module: 'ADM', activity: 'create' });

    const updated: PrintTemplate = {
      ...template,
      updatedAt: new Date().toISOString(),
    };

    await db.printTemplates.put(updated);

    await AuditService.log({
      action: 'UPDATE',
      entity: 'PrintTemplate',
      entityId: template.documentType,
      after: {
        documentType: template.documentType,
        companyNameArabic: template.companyNameArabic,
        updatedAt: updated.updatedAt,
      },
    });

    return updated;
  }
}
