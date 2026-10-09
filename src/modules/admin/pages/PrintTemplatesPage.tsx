import { DiagnosticLogger } from '../../../core/services/DiagnosticLogger';
import React, { useState, useEffect } from 'react';
import {
  Printer,
  Save,
  RotateCcw,
  FileText,
  Building,
  CreditCard,
  CheckCircle2,
  FileCheck,
  Eye,
  Sliders,
  ShieldCheck,
} from 'lucide-react';
import { Breadcrumbs } from '../../../components/ui/Breadcrumbs';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { useToast } from '../../../components/ui/Toast';
import { PrintTemplateService } from '../services/PrintTemplateService';
import type { PrintTemplate, PrintDocumentType } from '../../../types/models';

interface DocTypeMeta {
  type: PrintDocumentType;
  titleArabic: string;
  sapTCode: string;
  sampleDocNumber: string;
  sampleItems: Array<{ code: string; desc: string; qty: number; unit: string; price: number }>;
}

const TEMPLATE_DOC_TYPES: DocTypeMeta[] = [
  {
    type: 'PO',
    titleArabic: 'أمر شراء معتمد (Purchase Order)',
    sapTCode: 'ME21N / ME23N',
    sampleDocNumber: 'PO-2026-000084',
    sampleItems: [
      { code: 'DSL-EURO5', desc: 'وقود ديزل منخفض الكبريت Euro 5 - محطة ينبع', qty: 45000, unit: 'LTR', price: 0.95 },
      { code: 'FLT-OIL-HYD', desc: 'فلاتر زيت هيدروليكي لمضخات الصهاريج', qty: 12, unit: 'EA', price: 340.0 },
    ],
  },
  {
    type: 'GR',
    titleArabic: 'إشعار استلام مواد مخزنية (Goods Receipt MIGO)',
    sapTCode: 'MIGO (101)',
    sampleDocNumber: 'MIGO-2026-001249',
    sampleItems: [
      { code: 'VLV-GATE-4IN', desc: 'صمام بوابة عالي الضغط 4 بوصة ANSI 600', qty: 6, unit: 'EA', price: 2150.0 },
      { code: 'GSK-FLG-4IN', desc: 'جوانات إحكام فلانجات حلزونية 4 بوصة', qty: 24, unit: 'EA', price: 45.0 },
    ],
  },
  {
    type: 'INVOICE',
    titleArabic: 'فاتورة ضريبية للمورد (Tax Vendor Invoice)',
    sapTCode: 'FB60 / MIRO',
    sampleDocNumber: 'INV-2026-000432',
    sampleItems: [
      { code: 'SRV-FLT-MAINT', desc: 'خدمات صيانة وقائية وعمرة محركات صهاريج الديزل', qty: 1, unit: 'JOB', price: 28500.0 },
    ],
  },
  {
    type: 'VOUCHER',
    titleArabic: 'سند صرف وحوالة مالية (Payment Voucher)',
    sapTCode: 'F110 / F-53',
    sampleDocNumber: 'VCH-2026-000198',
    sampleItems: [
      { code: 'PAY-VEND-SETTLE', desc: 'سداد مستحقات شركة أرامكو السعودية لتوزيع الوقود', qty: 1, unit: 'ACT', price: 185400.0 },
    ],
  },
];

export const PrintTemplatesPage: React.FC = () => {
  const { success, error, info } = useToast();

  const [activeDocType, setActiveDocType] = useState<PrintDocumentType>('PO');
  const [template, setTemplate] = useState<PrintTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadTemplate = async (docType: PrintDocumentType) => {
    setIsLoading(true);
    try {
      const data = await PrintTemplateService.getTemplate(docType);
      setTemplate(data);
    } catch (err) {
      DiagnosticLogger.error('PrintTemplatesPage', 'Error occurred', err);
      error('خطأ', 'تعذر تحميل قالب الطباعة.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTemplate(activeDocType);
  }, [activeDocType]);

  const handleFieldChange = <K extends keyof PrintTemplate>(field: K, value: PrintTemplate[K]) => {
    if (!template) return;
    setTemplate({
      ...template,
      [field]: value,
    });
  };

  const handleSave = async () => {
    if (!template) return;
    setIsSaving(true);
    try {
      await PrintTemplateService.saveTemplate(template);
      success('تم حفظ القالب بنجاح', `تم حفظ وتحديث قالب الطباعة الرسمي لنوع المستند [${activeDocType}].`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل حفظ القالب';
      error('خطأ في الحفظ', msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintTest = () => {
    window.print();
  };

  const currentMeta = TEMPLATE_DOC_TYPES.find((d) => d.type === activeDocType) || TEMPLATE_DOC_TYPES[0];

  const subtotal = currentMeta.sampleItems.reduce((acc, item) => acc + item.qty * item.price, 0);
  const vat = subtotal * 0.15;
  const grandTotal = subtotal + vat;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Page Header */}
      <div className="print:hidden">
        <Breadcrumbs
          items={[
            { label: 'الرئيسية', path: '/' },
            { label: 'الإدارة والنظام', path: '/admin' },
            { label: 'محرر قوالب المطبوعات الرسمية (PRT01)' },
          ]}
        />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-[#0F172A] flex items-center gap-2.5">
              <Printer className="w-6 h-6 text-[#0FA37F]" />
              محرر قوالب المطبوعات الرسمية (Print Layouts Engine - PRT01)
            </h1>
            <p className="text-xs text-[#64748B] mt-1">
              تخصيص الترويسات الرسمية، الأرقام الضريبية، السجل التجاري، الشروط والأحكام، وتذييل الصفحات لكافة نماذج النظام.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handlePrintTest}>
              <Printer className="w-4 h-4 me-1.5" />
              طباعة تجريبية
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={isSaving}>
              <Save className="w-4 h-4 me-1.5" />
              {isSaving ? 'جارٍ الحفظ...' : 'حفظ القالب'}
            </Button>
          </div>
        </div>
      </div>

      {/* Doc Type Selector */}
      <div className="print:hidden flex items-center gap-2 overflow-x-auto pb-1 border-b border-[#E5EAF2]">
        {TEMPLATE_DOC_TYPES.map((dt) => {
          const isSelected = activeDocType === dt.type;
          return (
            <button
              key={dt.type}
              onClick={() => setActiveDocType(dt.type)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                isSelected
                  ? 'bg-[#0FA37F] text-white shadow-xs'
                  : 'bg-white border border-[#E5EAF2] text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>{dt.titleArabic}</span>
              <span className={`text-[10px] font-mono ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                ({dt.sapTCode})
              </span>
            </button>
          );
        })}
      </div>

      {/* Editor & Live Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left/Editor Column */}
        <div className="lg:col-span-5 space-y-4 print:hidden">
          <Card header="بيانات الترويسة والشركة">
            {isLoading || !template ? (
              <div className="p-8 text-center text-xs text-[#64748B]">جارٍ تحميل القالب...</div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">
                    اسم المنشأة بالعربية
                  </label>
                  <Input
                    value={template.companyNameArabic}
                    onChange={(e) => handleFieldChange('companyNameArabic', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">
                    اسم المنشأة بالإنجليزية
                  </label>
                  <Input
                    value={template.companyNameEnglish}
                    onChange={(e) => handleFieldChange('companyNameEnglish', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#0F172A] mb-1">
                      الرقم الضريبي (ZATCA)
                    </label>
                    <Input
                      value={template.taxNumber}
                      onChange={(e) => handleFieldChange('taxNumber', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#0F172A] mb-1">
                      السجل التجاري (CR)
                    </label>
                    <Input
                      value={template.commercialRecord}
                      onChange={(e) => handleFieldChange('commercialRecord', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">
                    سطر العنوان والاتصال في الترويسة
                  </label>
                  <Input
                    value={template.headerText || ''}
                    onChange={(e) => handleFieldChange('headerText', e.target.value)}
                    placeholder="العنوان - المدينة - الهاتف..."
                  />
                </div>
              </div>
            )}
          </Card>

          <Card header="الشروط، التذييل، والتوقيعات">
            {template && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">
                    تذييل المستند (Footer Text)
                  </label>
                  <Input
                    value={template.footerText || ''}
                    onChange={(e) => handleFieldChange('footerText', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">
                    الشروط والأحكام الخاصة بالمستند
                  </label>
                  <textarea
                    value={template.termsAndConditions || ''}
                    onChange={(e) => handleFieldChange('termsAndConditions', e.target.value)}
                    rows={4}
                    className="w-full text-xs p-2 rounded-xl border border-[#E5EAF2] bg-white focus:outline-hidden focus:border-[#0FA37F]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">
                    البيانات المصرفية ورقم الآيبان (IBAN)
                  </label>
                  <Input
                    value={template.bankDetails || ''}
                    onChange={(e) => handleFieldChange('bankDetails', e.target.value)}
                  />
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-[#E5EAF2]">
                  <label className="flex items-center gap-2 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={template.showSignatureBlock ?? true}
                      onChange={(e) => handleFieldChange('showSignatureBlock', e.target.checked)}
                      className="rounded text-[#0FA37F]"
                    />
                    <span>إظهار مربعات التوقيع والاعتماد</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={template.showStampBlock ?? true}
                      onChange={(e) => handleFieldChange('showStampBlock', e.target.checked)}
                      className="rounded text-[#0FA37F]"
                    />
                    <span>إظهار موضع الختم الرسمي</span>
                  </label>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Right/Preview Column (A4 Paper Representation) */}
        <div className="lg:col-span-7">
          <div className="bg-slate-200/70 p-4 sm:p-6 rounded-2xl border border-[#E5EAF2] flex justify-center print:p-0 print:bg-white print:border-none">
            {/* A4 Sheet Container */}
            <div className="w-full max-w-[650px] bg-white text-[#0F172A] p-6 sm:p-8 rounded-xl shadow-lg border border-slate-300 print:shadow-none print:border-none print:w-full print:max-w-none space-y-6">
              {/* Document Header */}
              <div className="border-b-2 border-[#0B2545] pb-4 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5 text-start">
                    <h2 className="text-sm font-bold text-[#0B2545]">
                      {template?.companyNameArabic || 'شركة الخليج للطاقة والخدمات البترولية'}
                    </h2>
                    <h3 className="text-xs font-serif text-[#64748B]">
                      {template?.companyNameEnglish || 'Gulf Energy & Petroleum Services Co.'}
                    </h3>
                    <div className="text-[10px] text-slate-500 font-mono pt-1">
                      الرقم الضريبي: {template?.taxNumber || '300192834700003'} | س.ت: {template?.commercialRecord || '1010892744'}
                    </div>
                  </div>

                  {/* Corporate Logo Placeholder */}
                  <div className="w-14 h-14 rounded-xl bg-[#0B2545] text-white flex flex-col items-center justify-center font-bold text-[10px] shadow-xs">
                    <span>GULF</span>
                    <span className="text-[#0FA37F]">ERP</span>
                  </div>
                </div>

                {template?.headerText && (
                  <div className="text-[10px] text-slate-500 text-center pt-1 border-t border-slate-100">
                    {template.headerText}
                  </div>
                )}
              </div>

              {/* Document Title Banner */}
              <div className="bg-[#F4F7FB] border border-[#E5EAF2] rounded-xl p-3 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-[#0B2545]">{currentMeta.titleArabic}</h3>
                  <span className="text-[10px] text-[#64748B] font-mono">SAP Ref: {currentMeta.sapTCode}</span>
                </div>
                <div className="text-end">
                  <div className="text-xs font-mono font-bold text-[#0FA37F]">
                    {currentMeta.sampleDocNumber}
                  </div>
                  <div className="text-[10px] font-mono text-[#64748B]">
                    التاريخ: {new Date().toISOString().slice(0, 10)}
                  </div>
                </div>
              </div>

              {/* Sample Items Table */}
              <div className="border border-[#E5EAF2] rounded-xl overflow-hidden text-[11px]">
                <table className="w-full text-start">
                  <thead className="bg-[#0B2545] text-white">
                    <tr>
                      <th className="py-2 px-3 text-start">#</th>
                      <th className="py-2 px-3 text-start">رمز الصنف</th>
                      <th className="py-2 px-3 text-start">الوصف والمواصفات</th>
                      <th className="py-2 px-3 text-center">الكمية</th>
                      <th className="py-2 px-3 text-end">سعر الوحدة</th>
                      <th className="py-2 px-3 text-end">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5EAF2]">
                    {currentMeta.sampleItems.map((item, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono">{i + 1}</td>
                        <td className="py-2 px-3 font-mono font-semibold">{item.code}</td>
                        <td className="py-2 px-3">{item.desc}</td>
                        <td className="py-2 px-3 text-center font-mono">
                          {item.qty.toLocaleString()} {item.unit}
                        </td>
                        <td className="py-2 px-3 text-end font-mono">{item.price.toFixed(2)}</td>
                        <td className="py-2 px-3 text-end font-mono font-semibold">
                          {(item.qty * item.price).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Calculation Box */}
              <div className="flex justify-end text-xs">
                <div className="w-56 space-y-1.5 p-2.5 bg-[#F4F7FB] border border-[#E5EAF2] rounded-xl">
                  <div className="flex justify-between text-[#64748B]">
                    <span>المجموع قبل الضريبة:</span>
                    <span className="font-mono">{subtotal.toLocaleString()} ريال</span>
                  </div>
                  <div className="flex justify-between text-[#64748B]">
                    <span>ضريبة القيمة المضافة (15%):</span>
                    <span className="font-mono">{vat.toLocaleString()} ريال</span>
                  </div>
                  <div className="flex justify-between font-bold text-[#0B2545] pt-1 border-t border-[#E5EAF2]">
                    <span>الإجمالي المستحق:</span>
                    <span className="font-mono text-[#0FA37F]">{grandTotal.toLocaleString()} ريال</span>
                  </div>
                </div>
              </div>

              {/* Terms & Conditions & Bank Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[10px]">
                {template?.termsAndConditions && (
                  <div className="p-2.5 bg-slate-50 border border-[#E5EAF2] rounded-xl space-y-1">
                    <span className="font-bold text-[#0B2545] block">الشروط والأحكام:</span>
                    <p className="whitespace-pre-line text-slate-600 leading-relaxed">
                      {template.termsAndConditions}
                    </p>
                  </div>
                )}
                {template?.bankDetails && (
                  <div className="p-2.5 bg-slate-50 border border-[#E5EAF2] rounded-xl space-y-1">
                    <span className="font-bold text-[#0B2545] block">الحساب البنكي المعتمد:</span>
                    <p className="text-slate-600 font-mono">{template.bankDetails}</p>
                  </div>
                )}
              </div>

              {/* Signatures & Stamps */}
              {template?.showSignatureBlock && (
                <div className="pt-4 border-t border-slate-200 grid grid-cols-3 gap-4 text-center text-[10px]">
                  <div className="space-y-6">
                    <span className="font-bold text-[#0B2545] block">إعداد ومراجعة</span>
                    <div className="h-8 border-b border-dashed border-slate-300" />
                    <span className="text-slate-400">التوقيع والتاريخ</span>
                  </div>

                  <div className="space-y-6">
                    <span className="font-bold text-[#0B2545] block">الاعتماد المالي / الإداري</span>
                    <div className="h-8 border-b border-dashed border-slate-300" />
                    <span className="text-slate-400">التوقيع والتاريخ</span>
                  </div>

                  {template?.showStampBlock && (
                    <div className="space-y-2">
                      <span className="font-bold text-[#0B2545] block">الختم الرسمي للمنشأة</span>
                      <div className="w-16 h-16 border-2 border-dashed border-slate-300 rounded-full mx-auto flex items-center justify-center text-slate-400 text-[9px]">
                        موضع الختم
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="pt-4 border-t border-slate-200 text-center text-[9px] text-[#64748B]">
                {template?.footerText ||
                  'وثيقة رسمية صادرة آلياً من نظام الخليج لإدارة الموارد (Gulf Energy ERP).'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
