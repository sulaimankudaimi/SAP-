import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { useToast } from '../../../components/ui/Toast';
import { t } from '../../../i18n/ar';
import { db } from '../../../core/db';
import { FinanceService } from '../services/FinanceService';
import type { GLAccount, CostCenter, SAPDocumentType, PostingKey } from '../../../types/models';
import { Plus, Trash2, CheckCircle2, AlertCircle, FileText, Paperclip, Bookmark } from 'lucide-react';

interface JournalEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface LineItemState {
  postingKey: PostingKey;
  accountNumber: string;
  accountName: string;
  debit: string;
  credit: string;
  costCenter: string;
  internalOrder: string;
  lineText: string;
}

export const JournalEntryModal: React.FC<JournalEntryModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { showToast } = useToast();
  const [glAccounts, setGlAccounts] = useState<GLAccount[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Header State
  const [companyCode, setCompanyCode] = useState('1000');
  const [fiscalYear, setFiscalYear] = useState('2026');
  const [period, setPeriod] = useState(new Date().getMonth() + 1);
  const [postingDate, setPostingDate] = useState(new Date().toISOString().split('T')[0]);
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().split('T')[0]);
  const [documentType, setDocumentType] = useState<SAPDocumentType>('SA');
  const [headerText, setHeaderText] = useState('');
  const [reference, setReference] = useState('');
  const [attachmentName, setAttachmentName] = useState('');

  // Lines State (Minimum 2 lines)
  const [lines, setLines] = useState<LineItemState[]>([
    {
      postingKey: '40',
      accountNumber: '501010',
      accountName: 'تكلفة مشتريات الوقود الخام والمكرر',
      debit: '',
      credit: '',
      costCenter: 'CC-1001',
      internalOrder: '',
      lineText: '',
    },
    {
      postingKey: '50',
      accountNumber: '101010',
      accountName: 'النقدية بالبنوك المحلية (الراجحي / الأهلي)',
      debit: '',
      credit: '',
      costCenter: '',
      internalOrder: '',
      lineText: '',
    },
  ]);

  useEffect(() => {
    async function loadMasterData() {
      const accs = await db.glAccounts.filter((a) => !a.isDeleted).toArray();
      const ccs = await db.costCenters.filter((c) => !c.isDeleted).toArray();
      setGlAccounts(accs);
      setCostCenters(ccs);
    }
    if (isOpen) {
      loadMasterData();
    }
  }, [isOpen]);

  // Handle Account change and auto-populate name
  const handleAccountChange = (index: number, accNumber: string) => {
    const acc = glAccounts.find((a) => a.accountNumber === accNumber);
    const updated = [...lines];
    updated[index].accountNumber = accNumber;
    updated[index].accountName = acc ? acc.name : '';
    setLines(updated);
  };

  const handlePostingKeyChange = (index: number, key: PostingKey) => {
    const updated = [...lines];
    updated[index].postingKey = key;
    // Default debit vs credit depending on posting key
    if (key === '40' || key === '01') {
      updated[index].credit = '';
    } else if (key === '50' || key === '31' || key === '15') {
      updated[index].debit = '';
    }
    setLines(updated);
  };

  const handleLineValueChange = (index: number, field: keyof LineItemState, val: string) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: val };
    setLines(updated);
  };

  const addLine = () => {
    setLines([
      ...lines,
      {
        postingKey: '40',
        accountNumber: glAccounts[0]?.accountNumber || '101010',
        accountName: glAccounts[0]?.name || '',
        debit: '',
        credit: '',
        costCenter: '',
        internalOrder: '',
        lineText: '',
      },
    ]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 2) {
      showToast('يجب أن يحتوي القيد على سطرين على الأقل (مدين ودائن).', 'warning');
      return;
    }
    setLines(lines.filter((_, i) => i !== index));
  };

  // Math totals calculation
  const totalDebit = lines.reduce((acc, l) => acc + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((acc, l) => acc + (parseFloat(l.credit) || 0), 0);
  const difference = Math.round(Math.abs(totalDebit - totalCredit) * 100) / 100;
  const isBalanced = difference === 0 && totalDebit > 0;

  const handleSubmit = async (isParked: boolean) => {
    if (!headerText.trim()) {
      showToast('يرجى إدخال النص التوصيفي لرأس القيد (Header Text).', 'warning');
      return;
    }

    if (!isParked && !isBalanced) {
      showToast(`القيد غير متوازن! الفارق بين المدين والدائن هو ${difference.toFixed(2)} ر.س`, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const formattedLines = lines.map((l) => ({
        postingKey: l.postingKey,
        accountNumber: l.accountNumber,
        accountName: l.accountName,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
        costCenter: l.costCenter || undefined,
        internalOrder: l.internalOrder || undefined,
        lineText: l.lineText || headerText,
      }));

      const attachments = attachmentName
        ? [{ name: attachmentName, size: '1.2 MB', type: 'PDF' }]
        : undefined;

      const je = await FinanceService.createJournalEntry({
        companyCode,
        fiscalYear,
        period: Number(period),
        postingDate,
        documentDate,
        documentType,
        headerText,
        reference,
        lines: formattedLines,
        isParked,
        attachments,
        createdBy: 'usr-admin-1',
      });

      showToast(
        isParked
          ? `تم حفظ مسودة القيد برقم ${je.docNumber} (Parked FBV1)`
          : `تم ترحيل القيد بنجاح للأستاذ العام برقم ${je.docNumber} (Posted FB50)`,
        'success'
      );
      onSuccess();
      onClose();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'حدث خطأ أثناء حفظ القيد المحاسبي', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="إدخال قيد محاسبي في دفتر الأستاذ العام (SAP FB50 / F-02)"
      size="xl"
    >
      <div className="space-y-5 text-xs text-slate-800">
        {/* Document Header Section */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-4 gap-3">
          <div>
            <label className="text-slate-500 font-bold block mb-1">كود الشركة (Company Code)</label>
            <Input value={companyCode} onChange={(e) => setCompanyCode(e.target.value)} className="font-mono" />
          </div>
          <div>
            <label className="text-slate-500 font-bold block mb-1">السنة المالية (Fiscal Year)</label>
            <Input value={fiscalYear} onChange={(e) => setFiscalYear(e.target.value)} className="font-mono" />
          </div>
          <div>
            <label className="text-slate-500 font-bold block mb-1">الفترة المالية (Period)</label>
            <Input
              type="number"
              min={1}
              max={12}
              value={period}
              onChange={(e) => setPeriod(Number(e.target.value))}
              className="font-mono"
            />
          </div>
          <div>
            <label className="text-slate-500 font-bold block mb-1">نوع المستند (Doc Type)</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as SAPDocumentType)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="SA">SA - قيد حسابات عامة (G/L Document)</option>
              <option value="KR">KR - فاتورة مورد (Vendor Invoice)</option>
              <option value="KZ">KZ - سداد مورد (Vendor Payment)</option>
              <option value="DR">DR - فاتورة عميل (Customer Invoice)</option>
              <option value="DZ">DZ - تحصيل عميل (Customer Receipt)</option>
              <option value="AB">AB - تسوية ومقاصة (Clearing Document)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-500 font-bold block mb-1">تاريخ الترحيل (Posting Date)</label>
            <Input type="date" value={postingDate} onChange={(e) => setPostingDate(e.target.value)} />
          </div>
          <div>
            <label className="text-slate-500 font-bold block mb-1">تاريخ المستند (Doc Date)</label>
            <Input type="date" value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} />
          </div>
          <div>
            <label className="text-slate-500 font-bold block mb-1">المرجع (Reference)</label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="مثال: PO-1002 أو فواتير شهر 3" />
          </div>
          <div>
            <label className="text-slate-500 font-bold block mb-1">المرفق الإثباتي (PDF)</label>
            <Input
              value={attachmentName}
              onChange={(e) => setAttachmentName(e.target.value)}
              placeholder="مثال: كشف_تسوية_بنوك.pdf"
            />
          </div>

          <div className="col-span-4">
            <label className="text-slate-700 font-bold block mb-1">نص وتوصيف القيد العام (Header Text) *</label>
            <Input
              value={headerText}
              onChange={(e) => setHeaderText(e.target.value)}
              placeholder="مثال: تسوية فروقات تكلفة توريد ونقل وقود الديزل لمحطات التوزيع..."
              required
            />
          </div>
        </div>

        {/* Real-time Balancing Indicator */}
        <div
          className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-mono font-bold transition-all ${
            isBalanced
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {isBalanced ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-600" />
            )}
            <span className="font-sans font-bold">
              {isBalanced ? 'القيد متوازن وجاهز للترحيل الفعلي للأستاذ العام' : 'القيد غير متوازن، يجب أن يتطابق طرفا المدين والدائن'}
            </span>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <span className="font-sans text-slate-500 text-[11px] block">إجمالي المدين:</span>
              <span className="text-emerald-700 text-sm font-black">{totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س</span>
            </div>
            <div>
              <span className="font-sans text-slate-500 text-[11px] block">إجمالي الدائن:</span>
              <span className="text-blue-700 text-sm font-black">{totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س</span>
            </div>
            <div>
              <span className="font-sans text-slate-500 text-[11px] block">الفارق (Difference):</span>
              <span className={`text-sm font-black ${difference === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {difference.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س
              </span>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
          <div className="p-3 bg-slate-100 flex items-center justify-between border-b border-slate-200">
            <h4 className="font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              أطراف وحسابات القيد المحاسبي (Journal Lines)
            </h4>
            <Button size="sm" onClick={addLine} className="bg-white text-slate-700 hover:bg-slate-50 border border-slate-300 gap-1.5 font-bold shadow-xs">
              <Plus className="w-3.5 h-3.5 text-emerald-600" />
              إضافة سطر طرف قيد
            </Button>
          </div>

          <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="py-2 px-2 text-center w-8">#</th>
                  <th className="py-2 px-2 w-28">مفتاح الترحيل</th>
                  <th className="py-2 px-3 w-56">رقم واسم الحساب</th>
                  <th className="py-2 px-3 w-28 text-end">مدين (Debit)</th>
                  <th className="py-2 px-3 w-28 text-end">دائن (Credit)</th>
                  <th className="py-2 px-3 w-36">مركز التكلفة</th>
                  <th className="py-2 px-3">البيان التوضيحي للسطر</th>
                  <th className="py-2 px-2 text-center w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {lines.map((line, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2 px-2 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                    <td className="py-2 px-2">
                      <select
                        value={line.postingKey}
                        onChange={(e) => handlePostingKeyChange(idx, e.target.value as PostingKey)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 font-mono text-[11px] font-bold"
                      >
                        <option value="40">40 - مدين حساب عام</option>
                        <option value="50">50 - دائن حساب عام</option>
                        <option value="01">01 - مدين عميل</option>
                        <option value="15">15 - دائن عميل</option>
                        <option value="21">21 - مدين مورد</option>
                        <option value="31">31 - دائن مورد</option>
                      </select>
                    </td>
                    <td className="py-2 px-3">
                      <select
                        value={line.accountNumber}
                        onChange={(e) => handleAccountChange(idx, e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-semibold focus:ring-1 focus:ring-emerald-500"
                      >
                        {glAccounts.map((acc) => (
                          <option key={acc.id} value={acc.accountNumber}>
                            {acc.accountNumber} - {acc.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-3">
                      <Input
                        type="number"
                        step="0.01"
                        value={line.debit}
                        onChange={(e) => handleLineValueChange(idx, 'debit', e.target.value)}
                        placeholder="0.00"
                        className="font-mono text-end font-bold text-emerald-700 h-8"
                        disabled={line.postingKey === '50' || line.postingKey === '31' || line.postingKey === '15'}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <Input
                        type="number"
                        step="0.01"
                        value={line.credit}
                        onChange={(e) => handleLineValueChange(idx, 'credit', e.target.value)}
                        placeholder="0.00"
                        className="font-mono text-end font-bold text-blue-700 h-8"
                        disabled={line.postingKey === '40' || line.postingKey === '01' || line.postingKey === '21'}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <select
                        value={line.costCenter}
                        onChange={(e) => handleLineValueChange(idx, 'costCenter', e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs"
                      >
                        <option value="">بدون مركز تكلفة</option>
                        {costCenters.map((cc) => (
                          <option key={cc.id} value={cc.code}>
                            {cc.code} - {cc.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-3">
                      <Input
                        value={line.lineText}
                        onChange={(e) => handleLineValueChange(idx, 'lineText', e.target.value)}
                        placeholder="بيان تفصيلي اختياري..."
                        className="h-8 text-xs"
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                        title="حذف السطر"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            {t('action_cancel')}
          </Button>

          <div className="flex items-center gap-3">
            {/* Park Document button (FBV1) */}
            <Button
              variant="secondary"
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting}
              className="gap-2 font-bold border-slate-300 hover:bg-slate-100 text-slate-700"
            >
              <Bookmark className="w-4 h-4 text-amber-600" />
              <span>{t('fi_btn_park')}</span>
            </Button>

            {/* Post Document button (FB50) */}
            <Button
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting || !isBalanced}
              className="bg-[#0FA37F] hover:bg-[#0c8a6c] gap-2 font-bold shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'جاري الترحيل...' : t('fi_btn_post')}</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
