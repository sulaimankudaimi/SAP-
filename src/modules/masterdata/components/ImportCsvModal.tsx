import React, { useState, useRef } from 'react';
import {
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  ArrowRight,
  RefreshCw,
  Info,
} from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Select } from '../../../components/ui/Select';
import { MasterDataService } from '../services/MasterDataService';
import { ImportExportService, type ValidationResult } from '../../../core/utils/importExport';
import { useAuthStore } from '../../../core/auth/useAuthStore';
import { useToast } from '../../../components/ui/Toast';
import { exportToCsv } from '../../../core/utils';

export interface TargetFieldDef {
  key: string;
  label: string;
  required?: boolean;
  example?: string;
}

export interface ImportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  entityType: 'materials' | 'vendors' | 'customers' | 'costCenters' | 'glAccounts';
  entityTitle: string;
  targetFields: TargetFieldDef[];
}

export const ImportCsvModal: React.FC<ImportCsvModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  entityType,
  entityTitle,
  targetFields,
}) => {
  const [step, setStep] = useState<'upload' | 'mapping' | 'report'>('upload');
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [validationResult, setValidationResult] = useState<ValidationResult<Record<string, unknown>> | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { showToast } = useToast();
  const user = useAuthStore((s) => s.user);

  const handleDownloadTemplate = () => {
    const templateData = [
      targetFields.reduce((acc, field) => {
        acc[field.key] = field.example || field.label;
        return acc;
      }, {} as Record<string, string>),
    ];

    exportToCsv(
      `قالب_استيراد_${entityTitle}.csv`,
      templateData,
      targetFields.map((f) => ({ key: f.key, label: f.label }))
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const rows = ImportExportService.parseCSV(content);
      if (rows.length === 0) {
        showToast({
          title: 'ملف فارغ أو غير متوافق',
          message: 'لم يتم العثور على أسطر بيانات صالحة في الملف المختار.',
          type: 'error',
        });
        return;
      }

      const headers = Object.keys(rows[0]);
      setCsvHeaders(headers);
      setParsedRows(rows);

      // Auto-match headers to target fields
      const initialMapping: Record<string, string> = {};
      targetFields.forEach((tf) => {
        const found = headers.find(
          (h) =>
            h.trim().toLowerCase() === tf.key.toLowerCase() ||
            h.trim().toLowerCase() === tf.label.toLowerCase()
        );
        if (found) initialMapping[tf.key] = found;
      });

      setColumnMapping(initialMapping);
      setStep('mapping');
    };
    reader.readAsText(file);
  };

  const runDryRunValidation = async () => {
    try {
      setIsProcessing(true);
      const result = await MasterDataService.dryRunImport<Record<string, unknown>>(
        entityType,
        parsedRows,
        columnMapping
      );
      setValidationResult(result);
      setStep('report');
    } catch (err) {
      showToast({
        title: 'فشل الفحص التجريبي',
        message: err instanceof Error ? err.message : 'حدث خطأ أثناء فحص البيانات.',
        type: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCommitImport = async () => {
    if (!validationResult || validationResult.validRows.length === 0) return;

    try {
      setIsProcessing(true);
      const count = await MasterDataService.commitBulkImport(
        entityType,
        validationResult.validRows as { id: string }[],
        user?.id || 'admin',
        user?.fullName || 'مدير النظام'
      );

      showToast({
        title: 'نجاح الاستيراد الجماعي',
        message: `تم إدراج ${count} سجل بنجاح في قاعدة البيانات وتوثيق ذلك في سجل التدقيق.`,
        type: 'success',
      });

      onSuccess();
      handleClose();
    } catch (err) {
      showToast({
        title: 'فشل استيراد البيانات',
        message: err instanceof Error ? err.message : 'تعذر حفظ السجلات في قاعدة البيانات.',
        type: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setStep('upload');
    setParsedRows([]);
    setCsvHeaders([]);
    setColumnMapping({});
    setValidationResult(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`استيراد جماعي: ${entityTitle}`}
      size="xl"
    >
      <div className="space-y-6">
        {/* Step Indicator */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step === 'upload' ? 'bg-primary text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              1
            </span>
            <span className="text-xs font-semibold text-navy">اختيار الملف والقالب</span>
          </div>

          <ArrowRight className="w-4 h-4 text-slate-400 rotate-180" />

          <div className="flex items-center gap-2">
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step === 'mapping' ? 'bg-primary text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              2
            </span>
            <span className="text-xs font-semibold text-navy">مطابقة الأعمدة</span>
          </div>

          <ArrowRight className="w-4 h-4 text-slate-400 rotate-180" />

          <div className="flex items-center gap-2">
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step === 'report' ? 'bg-primary text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              3
            </span>
            <span className="text-xs font-semibold text-navy">تقرير الفحص (Dry Run) والاعتماد</span>
          </div>
        </div>

        {/* STEP 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-5">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-blue shrink-0 mt-0.5" />
              <div className="text-xs text-blue-900 leading-relaxed">
                <strong>تعليمات الاستيراد:</strong> يُنصح بتحميل القالب المعتمد المرمز بصيغة UTF-8 BOM لضمان دقة ترميز الحروف العربية. يمكنك رفع ملفات تحتوي على حتى 1000 سطر وسيتم إجراء فحص دقيق (Dry Run) لمنع تكرار الرموز والتحقق من صحة الحقول.
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-8 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 text-center">
              <div className="flex flex-col items-center">
                <FileSpreadsheet className="w-12 h-12 text-primary mb-3" />
                <h4 className="text-base font-bold text-navy mb-1">رفع ملف البيانات (CSV / Excel)</h4>
                <p className="text-xs text-slate-500 mb-4 max-w-sm">
                  اختر ملف CSV مفصولاً بفواصل، وسيقوم النظام تلقائياً بقراءة الأعمدة ومطابقتها.
                </p>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".csv,.txt"
                  className="hidden"
                />

                <div className="flex items-center gap-3">
                  <Button
                    variant="primary"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 me-1.5" />
                    اختيار ملف من جهازك
                  </Button>

                  <Button variant="secondary" onClick={handleDownloadTemplate}>
                    <Download className="w-4 h-4 me-1.5" />
                    تحميل القالب النموذجي
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Column Mapping */}
        {step === 'mapping' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-navy">مطابقة حقول النظام مع أعمدة ملف CSV</h4>
                <p className="text-xs text-slate-500">
                  تم اكتشاف {parsedRows.length} سطر في الملف. حدد العمود المناظر لكل حقل أساسي.
                </p>
              </div>

              <Button variant="ghost" size="sm" onClick={() => setStep('upload')}>
                تغيير الملف
              </Button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
              {targetFields.map((field) => (
                <div key={field.key} className="p-3 flex items-center justify-between gap-4 text-xs">
                  <div className="w-1/3">
                    <span className="font-semibold text-navy">{field.label}</span>
                    {field.required && <span className="text-red ms-1">*</span>}
                    <div className="text-[11px] text-slate-400 font-mono">{field.key}</div>
                  </div>

                  <div className="w-1/2">
                    <Select
                      value={columnMapping[field.key] || ''}
                      onChange={(e) =>
                        setColumnMapping({ ...columnMapping, [field.key]: e.target.value })
                      }
                      options={[
                        { value: '', label: '-- غير مرتبط (تخطي) --' },
                        ...csvHeaders.map((h) => ({ value: h, label: h })),
                      ]}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <Button variant="ghost" onClick={handleClose}>
                إلغاء
              </Button>
              <Button
                variant="primary"
                loading={isProcessing}
                onClick={runDryRunValidation}
              >
                <CheckCircle2 className="w-4 h-4 me-1.5" />
                بدء الفحص التجريبي (Dry Run)
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Dry-Run Report & Commit */}
        {step === 'report' && validationResult && (
          <div className="space-y-4">
            {/* Stats Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="p-3 bg-slate-50 border border-slate-200 text-center">
                <div className="text-xs text-slate-500 mb-1">إجمالي الأسطر بالملف</div>
                <div className="text-xl font-bold text-navy">{validationResult.totalRows}</div>
              </Card>

              <Card className="p-3 bg-emerald-50 border border-emerald-200 text-center">
                <div className="text-xs text-emerald-800 mb-1">سجلات سليمة جاهزة</div>
                <div className="text-xl font-bold text-emerald-600">
                  {validationResult.summary.validCount}
                </div>
              </Card>

              <Card className="p-3 bg-red-50 border border-red-200 text-center">
                <div className="text-xs text-red-800 mb-1">سجلات تحتوي على أخطاء</div>
                <div className="text-xl font-bold text-red-600">
                  {validationResult.summary.errorCount}
                </div>
              </Card>
            </div>

            {/* Error Report List */}
            {validationResult.invalidRows.length > 0 ? (
              <div className="border border-red-200 rounded-xl overflow-hidden">
                <div className="bg-red-50 p-2.5 text-xs font-bold text-red-900 border-b border-red-200 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-red" />
                  <span>تفاصيل أخطاء التحقق (سيتم استبعاد هذه الأسطر أثناء الاستيراد):</span>
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-red-100 text-xs bg-white">
                  {validationResult.invalidRows.map((errItem, idx) => (
                    <div key={idx} className="p-2.5 flex items-start gap-3">
                      <Badge variant="critical" className="shrink-0">
                        السطر {errItem.rowNumber}
                      </Badge>
                      <div className="space-y-0.5">
                        {errItem.errors.map((errMsg, eIdx) => (
                          <div key={eIdx} className="text-red-700 font-medium">
                            • {errMsg}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>
                  ممتاز! كافة الأسطر الواردة بالملف (
                  <strong>{validationResult.summary.validCount}</strong>) متوافقة تماماً ولا يوجد أي تكرار في الرموز الأساسية.
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <Button variant="ghost" size="sm" onClick={() => setStep('mapping')}>
                العودة لمطابقة الأعمدة
              </Button>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleClose}>
                  إلغاء
                </Button>
                <Button
                  variant="primary"
                  loading={isProcessing}
                  disabled={validationResult.summary.validCount === 0}
                  onClick={handleCommitImport}
                >
                  <Upload className="w-4 h-4 me-1.5" />
                  اعتماد استيراد {validationResult.summary.validCount} سجل صالح
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
