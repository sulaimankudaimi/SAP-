import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { useToast } from '../../../components/ui/Toast';
import { t } from '../../../i18n/ar';
import { FinanceService } from '../services/FinanceService';
import type { JournalEntry } from '../../../types/models';
import { Printer, RotateCcw, AlertTriangle, FileText, CheckCircle2, ShieldCheck } from 'lucide-react';

interface JournalDetailModalProps {
  entry: JournalEntry | null;
  isOpen: boolean;
  onClose: () => void;
  onReversed?: () => void;
}

export const JournalDetailModal: React.FC<JournalDetailModalProps> = ({
  entry,
  isOpen,
  onClose,
  onReversed,
}) => {
  const { showToast } = useToast();
  const [isReversing, setIsReversing] = useState(false);
  const [reversalReason, setReversalReason] = useState('');
  const [showReverseConfirm, setShowReverseConfirm] = useState(false);

  if (!entry) return null;

  const handleReverse = async () => {
    if (!reversalReason.trim()) {
      showToast('يرجى كتابة سبب عكس القيد المحاسبي.', 'warning');
      return;
    }

    setIsReversing(true);
    try {
      const revDoc = await FinanceService.reverseJournalEntry(
        entry.docNumber,
        reversalReason,
        'usr-admin-1'
      );
      showToast(`تم عكس وإلغاء القيد بنجاح بموجب المستند المعاكس ${revDoc.docNumber}`, 'success');
      setShowReverseConfirm(false);
      if (onReversed) onReversed();
      onClose();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'فشل عكس القيد المحاسبي', 'error');
    } finally {
      setIsReversing(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`سند قيد محاسبي - ${entry.docNumber} (${entry.documentType})`}
      size="xl"
    >
      <div className="space-y-5 text-xs text-slate-800">
        {/* Document Header Details */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-4 gap-4">
          <div>
            <span className="text-slate-400 block text-[11px] font-bold">رقم المستند المحاسبي</span>
            <span className="font-mono text-sm font-bold text-blue-900">{entry.docNumber}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px] font-bold">نوع المستند (Doc Type)</span>
            <span className="font-bold text-slate-800 font-mono">{entry.documentType}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px] font-bold">السنة والفترة المالية</span>
            <span className="font-mono font-bold text-slate-800">
              {entry.fiscalYear} / فترة {entry.period}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px] font-bold">الحالة الإجرائية</span>
            <div className="mt-1">
              {entry.isReversed ? (
                <Badge variant="rejected">معكوس وملغي (Storno)</Badge>
              ) : entry.isParked ? (
                <Badge variant="in_progress">مسودة محفوظة (Parked)</Badge>
              ) : (
                <Badge variant="approved">مرحل رسمي (Posted)</Badge>
              )}
            </div>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px] font-bold">تاريخ الترحيل (Posting Date)</span>
            <span className="font-medium text-slate-700">{entry.postingDate}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px] font-bold">تاريخ المستند (Doc Date)</span>
            <span className="font-medium text-slate-700">{entry.documentDate}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px] font-bold">المرجع الخارجي</span>
            <span className="font-mono text-slate-700">{entry.reference || '—'}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px] font-bold">كود الشركة</span>
            <span className="font-mono text-slate-700">{entry.companyCode} (Gulf Energy)</span>
          </div>

          <div className="col-span-4 pt-2 border-t border-slate-200">
            <span className="text-slate-400 block text-[11px] font-bold">البيان التوضيحي العام</span>
            <span className="font-medium text-slate-900 text-sm">{entry.headerText}</span>
          </div>

          {entry.isReversed && (
            <div className="col-span-4 bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-800 flex items-center justify-between">
              <div>
                <span className="font-bold block">تم عكس هذا القيد بالمستند رقم: {entry.reversalDocNumber}</span>
                <span className="text-xs text-rose-600">السبب: {entry.reversalReason}</span>
              </div>
              <span className="text-[11px] text-rose-500 font-mono">{entry.reversedAt?.split('T')[0]}</span>
            </div>
          )}
        </div>

        {/* Lines Table */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
          <div className="p-3 bg-slate-100 border-b border-slate-200 font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-600" />
            سطور القيد المحاسبي وحسابات الأستاذ
          </div>

          <table className="w-full text-start text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 text-center w-8">#</th>
                <th className="py-2.5 px-3 w-24">مفتاح الترحيل</th>
                <th className="py-2.5 px-3 w-28">رقم الحساب</th>
                <th className="py-2.5 px-3">اسم الحساب</th>
                <th className="py-2.5 px-3 w-32 text-end">مدين (Debit)</th>
                <th className="py-2.5 px-3 w-32 text-end">دائن (Credit)</th>
                <th className="py-2.5 px-3 w-28">مركز التكلفة</th>
                <th className="py-2.5 px-3">البيان التفصيلي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {entry.lines.map((l, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70">
                  <td className="py-2 px-3 text-center font-mono text-slate-400 font-bold">{l.lineNumber}</td>
                  <td className="py-2 px-3 font-mono font-bold text-slate-600">
                    <span className="px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                      {l.postingKey || (l.debit > 0 ? '40' : '50')}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-mono font-bold text-blue-900">{l.accountNumber}</td>
                  <td className="py-2 px-3 font-semibold text-slate-800">{l.accountName}</td>
                  <td className="py-2 px-3 font-mono font-bold text-end text-emerald-700">
                    {l.debit > 0 ? `${l.debit.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س` : '—'}
                  </td>
                  <td className="py-2 px-3 font-mono font-bold text-end text-blue-700">
                    {l.credit > 0 ? `${l.credit.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س` : '—'}
                  </td>
                  <td className="py-2 px-3 font-mono text-slate-600">{l.costCenter || '—'}</td>
                  <td className="py-2 px-3 text-slate-600">{l.lineText || '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-200">
              <tr>
                <td colSpan={4} className="py-3 px-3 text-start text-slate-700">
                  الإجمالي المتطابق (Total Balanced):
                </td>
                <td className="py-3 px-3 text-end font-mono text-emerald-800 text-sm">
                  {entry.totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س
                </td>
                <td className="py-3 px-3 text-end font-mono text-blue-800 text-sm">
                  {entry.totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س
                </td>
                <td colSpan={2} className="py-3 px-3 text-center text-emerald-600 font-mono">
                  متوازن (0.00 ر.س)
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Reversal Confirmation Box */}
        {showReverseConfirm && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-900 font-bold">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span>تأكيد عكس القيد المحاسبي (Storno Reversal - FB08)</span>
            </div>
            <p className="text-xs text-amber-800">
              وفقاً لقواعد المحاسبة المالية، لا يتم حذف القيود؛ بل يتم إنشاء قيد عكسي تلقائي متوازن يعكس كافة أرصدة المدين والدائن في الفترة المفتوحة الحالية.
            </p>
            <input
              type="text"
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
              placeholder="اكتب سبب العكس (مثال: إلغاء فاتورة / قيد خاطئ)..."
              className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
              required
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button size="sm" variant="secondary" onClick={() => setShowReverseConfirm(false)}>
                إلغاء
              </Button>
              <Button
                size="sm"
                onClick={handleReverse}
                disabled={isReversing}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{isReversing ? 'جاري العكس...' : 'تأكيد العكس وترحيل القيد العكسي'}</span>
              </Button>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose}>
            {t('action_close')}
          </Button>

          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={handlePrint} className="gap-2 border-slate-300">
              <Printer className="w-4 h-4" />
              <span>طباعة سند القيد</span>
            </Button>

            {!entry.isReversed && !entry.isParked && !showReverseConfirm && (
              <Button
                variant="secondary"
                onClick={() => setShowReverseConfirm(true)}
                className="border-rose-200 text-rose-700 hover:bg-rose-50 gap-2 font-bold"
              >
                <RotateCcw className="w-4 h-4 text-rose-600" />
                <span>{t('fi_btn_reverse')}</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
