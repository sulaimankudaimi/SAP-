import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Printer, X, FileText, CheckCircle2 } from 'lucide-react';
import { PrintTemplateService } from '../../modules/admin/services/PrintTemplateService';
import type { PrintTemplate, PrintDocumentType } from '../../types/models';

export interface PrintItemLine {
  code: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface PrintDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: PrintDocumentType;
  documentNumber: string;
  date?: string;
  partyName?: string;
  items?: PrintItemLine[];
  subtotal?: number;
  tax?: number;
  total?: number;
  currency?: string;
  notes?: string;
}

export const PrintDocumentModal: React.FC<PrintDocumentModalProps> = ({
  isOpen,
  onClose,
  documentType,
  documentNumber,
  date,
  partyName,
  items = [],
  subtotal,
  tax,
  total,
  currency = 'SAR',
  notes,
}) => {
  const [template, setTemplate] = useState<PrintTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      PrintTemplateService.getTemplate(documentType)
        .then((tmpl) => setTemplate(tmpl))
        .catch((e) => console.error('Failed to load print template', e))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, documentType]);

  const handlePrint = () => {
    window.print();
  };

  const calculatedSubtotal =
    subtotal !== undefined
      ? subtotal
      : items.reduce((sum, item) => sum + (item.total || item.quantity * item.unitPrice), 0);
  const calculatedTax = tax !== undefined ? tax : calculatedSubtotal * 0.15;
  const calculatedTotal = total !== undefined ? total : calculatedSubtotal + calculatedTax;
  const formattedDate = date || new Date().toISOString().slice(0, 10);

  const getDocTypeTitle = () => {
    switch (documentType) {
      case 'PO':
        return 'أمر شراء معتمد (Purchase Order - ME21N)';
      case 'GR':
        return 'إشعار استلام مواد مخزنية (Goods Receipt - MIGO 101)';
      case 'INVOICE':
        return 'فاتورة ضريبية رسمية (Tax Invoice - MIRO/FB60)';
      case 'VOUCHER':
        return 'سند صرف وحوالة مالية (Payment Voucher - F110)';
      default:
        return 'وثيقة رسمية معتمدة';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`معاينة الطباعة الرسمية: ${documentNumber}`}
      size="xl"
    >
      <div className="space-y-4" dir="rtl">
        {/* Controls bar */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E5EAF2] print:hidden">
          <div className="flex items-center gap-2">
            <Badge variant="in_progress">{documentType}</Badge>
            <span className="text-xs text-[#64748B]">
              يتم تطبيق ترويسة وتذييل وشروط القالب الرسمي المعتمد في إعدادات النظام (PRT01)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              إلغاء
            </Button>
            <Button variant="primary" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 me-1.5" />
              طباعة المستند
            </Button>
          </div>
        </div>

        {/* Printable Document Paper */}
        {isLoading || !template ? (
          <div className="p-12 text-center text-xs text-[#64748B]">جارٍ تجهيز القالب والبيانات...</div>
        ) : (
          <div className="bg-slate-100 p-4 sm:p-6 rounded-2xl flex justify-center print:p-0 print:bg-white">
            <div className="w-full max-w-[700px] bg-white text-[#0F172A] p-6 sm:p-8 rounded-xl shadow-md border border-slate-300 print:shadow-none print:border-none print:w-full print:max-w-none space-y-6">
              {/* Header block from Template */}
              <div className="border-b-2 border-[#0B2545] pb-4 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5 text-start">
                    <h2 className="text-sm font-bold text-[#0B2545]">
                      {template.companyNameArabic}
                    </h2>
                    <h3 className="text-xs font-serif text-[#64748B]">
                      {template.companyNameEnglish}
                    </h3>
                    <div className="text-[10px] text-slate-500 font-mono pt-1">
                      الرقم الضريبي: {template.taxNumber} | س.ت: {template.commercialRecord}
                    </div>
                  </div>

                  {/* Company Logo Badge */}
                  <div className="w-14 h-14 rounded-xl bg-[#0B2545] text-white flex flex-col items-center justify-center font-bold text-[10px] shadow-xs">
                    <span>GULF</span>
                    <span className="text-[#0FA37F]">ERP</span>
                  </div>
                </div>

                {template.headerText && (
                  <div className="text-[10px] text-slate-500 text-center pt-1 border-t border-slate-100">
                    {template.headerText}
                  </div>
                )}
              </div>

              {/* Title & Document Meta */}
              <div className="bg-[#F4F7FB] border border-[#E5EAF2] rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-[#0B2545]">{getDocTypeTitle()}</h3>
                  {partyName && (
                    <span className="text-[11px] text-[#0F172A] font-semibold mt-0.5 block">
                      الطرف المعني: {partyName}
                    </span>
                  )}
                </div>
                <div className="text-start sm:text-end">
                  <div className="text-xs font-mono font-bold text-[#0FA37F]">{documentNumber}</div>
                  <div className="text-[10px] font-mono text-[#64748B]">التاريخ: {formattedDate}</div>
                </div>
              </div>

              {/* Items Table */}
              {items.length > 0 ? (
                <div className="border border-[#E5EAF2] rounded-xl overflow-hidden text-[11px]">
                  <table className="w-full text-start">
                    <thead className="bg-[#0B2545] text-white">
                      <tr>
                        <th className="py-2 px-3 text-start">#</th>
                        <th className="py-2 px-3 text-start">رمز الصنف</th>
                        <th className="py-2 px-3 text-start">الوصف والبيان</th>
                        <th className="py-2 px-3 text-center">الكمية</th>
                        <th className="py-2 px-3 text-end">سعر الوحدة</th>
                        <th className="py-2 px-3 text-end">الإجمالي ({currency})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5EAF2]">
                      {items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono">{idx + 1}</td>
                          <td className="py-2 px-3 font-mono font-semibold">{item.code}</td>
                          <td className="py-2 px-3">{item.description}</td>
                          <td className="py-2 px-3 text-center font-mono">
                            {item.quantity.toLocaleString()} {item.unit}
                          </td>
                          <td className="py-2 px-3 text-end font-mono">
                            {item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-end font-mono font-semibold">
                            {(item.total || item.quantity * item.unitPrice).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border border-[#E5EAF2] rounded-xl text-center text-xs text-[#64748B]">
                  بيانات بنود المستند معتمدة بموجب السجل المحاسبي الأصلي.
                </div>
              )}

              {/* Calculation Summary */}
              <div className="flex justify-end text-xs">
                <div className="w-60 space-y-1.5 p-2.5 bg-[#F4F7FB] border border-[#E5EAF2] rounded-xl">
                  <div className="flex justify-between text-[#64748B]">
                    <span>المجموع قبل الضريبة:</span>
                    <span className="font-mono">
                      {calculatedSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#64748B]">
                    <span>ضريبة القيمة المضافة (15%):</span>
                    <span className="font-mono">
                      {calculatedTax.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-[#0B2545] pt-1 border-t border-[#E5EAF2]">
                    <span>الإجمالي المستحق:</span>
                    <span className="font-mono text-[#0FA37F]">
                      {calculatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes / Remarks if present */}
              {notes && (
                <div className="p-2.5 bg-blue-50/60 border border-blue-200 rounded-xl text-[10px] text-blue-900">
                  <span className="font-bold block mb-0.5">ملاحظات المستند:</span>
                  <p>{notes}</p>
                </div>
              )}

              {/* Terms & Conditions & Bank Details from Template */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[10px]">
                {template.termsAndConditions && (
                  <div className="p-2.5 bg-slate-50 border border-[#E5EAF2] rounded-xl space-y-1">
                    <span className="font-bold text-[#0B2545] block">الشروط والأحكام الرسمية:</span>
                    <p className="whitespace-pre-line text-slate-600 leading-relaxed">
                      {template.termsAndConditions}
                    </p>
                  </div>
                )}
                {template.bankDetails && (
                  <div className="p-2.5 bg-slate-50 border border-[#E5EAF2] rounded-xl space-y-1">
                    <span className="font-bold text-[#0B2545] block">الحساب البنكي المعتمد:</span>
                    <p className="text-slate-600 font-mono">{template.bankDetails}</p>
                  </div>
                )}
              </div>

              {/* Signatures & Stamps from Template */}
              {template.showSignatureBlock && (
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

                  {template.showStampBlock && (
                    <div className="space-y-2">
                      <span className="font-bold text-[#0B2545] block">الختم الرسمي للمنشأة</span>
                      <div className="w-16 h-16 border-2 border-dashed border-slate-300 rounded-full mx-auto flex items-center justify-center text-slate-400 text-[9px]">
                        موضع الختم
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Footer text from Template */}
              <div className="pt-4 border-t border-slate-200 text-center text-[9px] text-[#64748B]">
                {template.footerText ||
                  'وثيقة رسمية صادرة آلياً من نظام الخليج لإدارة الموارد (Gulf Energy ERP).'}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
