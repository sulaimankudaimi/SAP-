import { db } from '../../../core/db';
import { requirePermission } from '../../../core/security/SessionContext';
import { AuditService } from '../../../core/services/AuditService';
import type { PrintTemplate, PrintDocumentType } from '../../../types/models';

export class PrintTemplateService {
  private static getDefaultTemplates(): PrintTemplate[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'tmpl-po',
        documentType: 'PO',
        companyNameArabic: 'شركة الخليج للطاقة والخدمات البترولية',
        companyNameEnglish: 'Gulf Energy & Petroleum Services Co.',
        taxNumber: '300192834700003',
        commercialRecord: '1010892744',
        headerText: 'المملكة العربية السعودية - الرياض - طريق الملك فهد - هاتف: 920088990',
        footerText: 'أمر شراء رسمي معتمد صادر من النظام الآلي الموحد (SAP S/4HANA ERP) - يعتبر ملزماً للمورد.',
        termsAndConditions: '1. يخضع التوريد للفحص الفني والمطابقة المخزنية.\n2. تطبق شروط السداد خلال 30 يوماً من استلام الفاتورة الضريبية.\n3. يتحمل المورد كافة أضرار النقل حتى التسليم بموقع المحطة.',
        showSignatureBlock: true,
        showStampBlock: true,
        bankDetails: 'مصرف الراجحي - IBAN: SA4480000456608010009988',
        updatedAt: now,
      },
      {
        id: 'tmpl-gr',
        documentType: 'GR',
        companyNameArabic: 'شركة الخليج للطاقة والخدمات البترولية',
        companyNameEnglish: 'Gulf Energy & Petroleum Services Co.',
        taxNumber: '300192834700003',
        commercialRecord: '1010892744',
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
        companyNameArabic: 'شركة الخليج للطاقة والخدمات البترولية',
        companyNameEnglish: 'Gulf Energy & Petroleum Services Co.',
        taxNumber: '300192834700003',
        commercialRecord: '1010892744',
        headerText: 'فاتورة ضريبية معتمدة وفق متطلبات هيئة الزكاة والضريبة والجمارك (ZATCA)',
        footerText: 'خاضعة لضريبة القيمة المضافة بنسبة 15%. الفاتورة صالحة لأغراض الخصم الضريبي.',
        termsAndConditions: 'الرجاء سداد المبلغ لحساب الشركة الرسمي الموضح أدناه مع ذكر رقم الفاتورة.',
        showSignatureBlock: true,
        showStampBlock: true,
        bankDetails: 'البنك الأهلي السعودي (SNB) - IBAN: SA9210000012345678901234',
        updatedAt: now,
      },
      {
        id: 'tmpl-vouch',
        documentType: 'VOUCHER',
        companyNameArabic: 'شركة الخليج للطاقة والخدمات البترولية',
        companyNameEnglish: 'Gulf Energy & Petroleum Services Co.',
        taxNumber: '300192834700003',
        commercialRecord: '1010892744',
        headerText: 'الإدارة المالية - سند صرف / تحويل بنكي معتمد',
        footerText: 'صدر السند استناداً لأوامر الدفع والاعتماد المالي المرفقة بموجب دورة السداد F110.',
        termsAndConditions: 'يعتبر إشعار التحويل البنكي أو الشيك إبراءً للذمة بمقدار المبلغ المسدد.',
        showSignatureBlock: true,
        showStampBlock: true,
        bankDetails: 'مصرف الراجحي - الحساب الجاري للمدفوعات',
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
