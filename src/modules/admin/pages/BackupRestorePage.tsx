import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Lock,
  Eye,
  EyeOff,
  Database,
  Calendar,
  Layers,
  ArrowRight,
  HardDriveDownload,
  RotateCcw,
} from 'lucide-react';
import { Breadcrumbs } from '../../../components/ui/Breadcrumbs';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { useToast } from '../../../components/ui/Toast';
import {
  BackupService,
  type RestorePreview,
} from '../services/BackupService';
import { db } from '../../../core/db';

export const BackupRestorePage: React.FC = () => {
  const { success, error, info } = useToast();

  // Export State
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [showExportPass, setShowExportPass] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [lastExportResult, setLastExportResult] = useState<{
    filename: string;
    totalRecords: number;
    tablesCount: number;
    checksum: string;
  } | null>(null);

  // Restore State
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreFileContent, setRestoreFileContent] = useState<string>('');
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [showRestorePass, setShowRestorePass] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [previewData, setPreviewData] = useState<RestorePreview | null>(null);
  const [decryptedPayload, setDecryptedPayload] = useState<Record<string, Record<string, unknown>[]> | null>(null);
  const [restoreComplete, setRestoreComplete] = useState(false);

  // Reminder Settings State
  const [reminderDays, setReminderDays] = useState<number>(7);
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(null);
  const [daysSince, setDaysSince] = useState<number | null>(null);
  const [needsReminder, setNeedsReminder] = useState<boolean>(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Initial Status
  const loadStatus = async () => {
    try {
      const reminder = await BackupService.checkBackupReminder();
      setNeedsReminder(reminder.needsReminder);
      setDaysSince(reminder.daysSinceLastBackup);
      setReminderDays(reminder.reminderDays);
      setLastBackupDate(reminder.lastBackupDate);
    } catch (e) {
      console.error('Failed to load backup status', e);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  // Handle Export
  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exportPassphrase || exportPassphrase.length < 8) {
      error('كلمة المرور قصيرة', 'يجب أن لا تقل كلمة المرور عن 8 خانات لتأمين مفتاح التشفير.');
      return;
    }
    if (exportPassphrase !== confirmPassphrase) {
      error('عدم تطابق كلمة المرور', 'كلمة المرور وتأكيدها غير متطابقين.');
      return;
    }

    setIsExporting(true);
    try {
      const res = await BackupService.createEncryptedBackup(exportPassphrase);
      setLastExportResult({
        filename: res.filename,
        totalRecords: res.totalRecords,
        tablesCount: Object.keys(res.tableCounts).length,
        checksum: res.container.header.checksumSha256,
      });
      setExportPassphrase('');
      setConfirmPassphrase('');
      success(
        'تم تصدير النسخة الاحتياطية بنجاح',
        `تم حفظ الملف المشفر ${res.filename} وحفظ ${res.totalRecords} سجلاً عبر ${Object.keys(res.tableCounts).length} جدولاً.`
      );
      await loadStatus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشلت عملية إنشاء النسخة الاحتياطية';
      error('خطأ في النسخ الاحتياطي', msg);
    } finally {
      setIsExporting(false);
    }
  };

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreFile(file);
    setPreviewData(null);
    setDecryptedPayload(null);
    setRestoreComplete(false);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRestoreFileContent(content);
      info('تم تحميل الملف', `تم قراءة ملف النسخة الاحتياطية (${(file.size / 1024).toFixed(1)} KB). أدخل كلمة المرور لمعاينة المحتوى.`);
    };
    reader.onerror = () => {
      error('خطأ قراءة الملف', 'تعذر قراءة محتوى الملف المحدد.');
    };
    reader.readAsText(file);
  };

  // Handle Decrypt & Preview
  const handlePreview = async () => {
    if (!restoreFileContent) {
      error('لم يتم تحديد ملف', 'يرجى اختيار ملف النسخة الاحتياطية المشفر أولاً.');
      return;
    }
    if (!restorePassphrase) {
      error('كلمة المرور مطلوبة', 'يرجى إدخال كلمة المرور المستخدمة أثناء تشفير النسخة.');
      return;
    }

    setIsPreviewing(true);
    try {
      const { preview, decryptedPayload: payload } = await BackupService.previewBackup(
        restoreFileContent,
        restorePassphrase
      );
      setPreviewData(preview);
      setDecryptedPayload(payload);
      setRestoreComplete(false);
      success(
        'تم فك التشفير والتحقق بنجاح',
        `تم التحقق من البصمة الرقمية والترويسة. إجمالي السجلات بالنسخة: ${preview.totalBackupRecords} سجلاً.`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل فك التشفير أو التحقق من النسخة الاحتياطية';
      error('خطأ فك التشفير', msg);
      setPreviewData(null);
      setDecryptedPayload(null);
    } finally {
      setIsPreviewing(false);
    }
  };

  // Handle Execute Restore
  const handleExecuteRestore = async () => {
    if (!decryptedPayload || !previewData) {
      error('لا توجد بيانات للمعاينة', 'يرجى فك تشفير النسخة ومعاينتها قبل التأكيد.');
      return;
    }

    const confirmMsg =
      'تنبيه فائق الأهمية: سيتم استبدال بيانات النظام الحالية بالبيانات المسترجعة من النسخة الاحتياطية. سيتم أخذ لقطة سريعة تلقائياً قبل البدء مع ضمان التراجع التلقائي في حال أي خطأ. هل تود المتابعة بالتأكيد؟';
    if (!window.confirm(confirmMsg)) {
      return;
    }

    setIsRestoring(true);
    try {
      const result = await BackupService.executeRestore(
        decryptedPayload,
        previewData.backupDate
      );
      setRestoreComplete(true);
      success(
        'اكتملت الاستعادة بنجاح',
        `تمت استعادة ${result.restoredRecords} سجلاً في ${result.restoredTables} جدولاً بنجاح وأمان.`
      );
      await loadStatus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشلت عملية الاستعادة';
      error('فشل الاستعادة', msg);
    } finally {
      setIsRestoring(false);
    }
  };

  // Save Reminder Settings
  const handleSaveReminderSettings = async () => {
    setIsSavingSettings(true);
    try {
      await db.settings.put({
        id: 'set-backup-reminder-days',
        key: 'BACKUP_REMINDER_DAYS',
        value: String(reminderDays),
        category: 'general',
        description: 'عدد الأيام المسموح بها قبل إظهار تحذير النسخ الاحتياطي في لوحة التحكم',
        updatedAt: new Date().toISOString(),
        isDeleted: false,
      });
      success('تم حفظ الإعداد', `تم تحديث مدة التذكير الدوري إلى ${reminderDays} يوماً.`);
      await loadStatus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل حفظ الإعدادات';
      error('خطأ', msg);
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Page Header */}
      <div>
        <Breadcrumbs
          items={[
            { label: 'الرئيسية', path: '/' },
            { label: 'الإدارة والنظام', path: '/admin' },
            { label: 'النسخ الاحتياطي والاستعادة المشفرة' },
          ]}
        />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-[#0F172A] flex items-center gap-2.5">
              <Database className="w-6 h-6 text-[#0FA37F]" />
              النسخ الاحتياطي المشفر والاستعادة (BR01 - Backup & Recovery)
            </h1>
            <p className="text-xs text-[#64748B] mt-1">
              تصدير قاعدة بيانات Dexie بالكامل مع تشفير AES-256-GCM واشتقاق المفاتيح بـ PBKDF2 (≥ 210,000 دورة)، مع فحص البصمة SHA-256 والتراجع التلقائي عند الاستعادة.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-[#0FA37F] border border-emerald-200 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4" />
              تشفير AES-256-GCM معتمد
            </span>
          </div>
        </div>
      </div>

      {/* Reminder Overdue Alert */}
      {needsReminder && (
        <div className="bg-amber-50 border-s-4 border-amber-500 p-4 rounded-xl flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-amber-900">
                تنبيه أمان البيانات: لم يتم إنشاء نسخة احتياطية مشفرة مؤخراً!
              </h4>
              <p className="text-xs text-amber-800 leading-relaxed">
                {daysSince === null
                  ? 'لم يتم إنشاء أي نسخة احتياطية مشفرة للنظام حتى الآن. يوصى بإنشاء نسخة فوراً لحفظ السجلات المحاسبية والعمليات.'
                  : `مرت ${daysSince} يوماً منذ آخر عملية نسخ احتياطي (${lastBackupDate?.slice(0, 10)}). الحد الأقصى المسموح به هو ${reminderDays} أيام.`}
              </p>
            </div>
          </div>
          <Badge variant="pending">تحذير أمان</Badge>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E5EAF2] rounded-[16px] p-4 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#64748B]">
            <span>معيار التشفير</span>
            <Lock className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg font-bold text-[#0F172A] font-mono">AES-256-GCM</div>
          <div className="text-[11px] text-[#64748B]">اشتقاق PBKDF2 (210,000 دورة)</div>
        </div>

        <div className="bg-white border border-[#E5EAF2] rounded-[16px] p-4 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#64748B]">
            <span>آخر نسخة احتياطية</span>
            <Calendar className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-lg font-bold text-[#0F172A] font-mono">
            {lastBackupDate ? lastBackupDate.slice(0, 10) : 'لا يوجد سجل'}
          </div>
          <div className="text-[11px] text-[#64748B]">
            {daysSince !== null ? `منذ ${daysSince} يوم` : 'يوصى بأخذ نسخة الآن'}
          </div>
        </div>

        <div className="bg-white border border-[#E5EAF2] rounded-[16px] p-4 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#64748B]">
            <span>فترة التذكير الدوري</span>
            <RefreshCw className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-lg font-bold text-[#0F172A]">كل {reminderDays} أيام</div>
          <div className="text-[11px] text-[#64748B]">تنبيه في لوحة التحكم عند التأخر</div>
        </div>

        <div className="bg-white border border-[#E5EAF2] rounded-[16px] p-4 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#64748B]">
            <span>أمان الاستعادة</span>
            <RotateCcw className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-lg font-bold text-emerald-600">Atomic Rollback</div>
          <div className="text-[11px] text-[#64748B]">لقطة تلقائية وتراجع فوري عند أي خطأ</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: Create Backup */}
        <Card
          header={
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDriveDownload className="w-5 h-5 text-[#0FA37F]" />
                <h3 className="text-sm font-bold text-[#0F172A]">إنشاء وتصدير نسخة مشفرة</h3>
              </div>
              <Badge variant="approved">AES-256-GCM</Badge>
            </div>
          }
        >
          <form onSubmit={handleExport} className="space-y-4">
            <p className="text-xs text-[#64748B] leading-relaxed">
              يقوم النظام بتصدير كافة جداول قاعدة بيانات Dexie (بما في ذلك مرفقات BLOB بعد تحويلها لـ Base64)، ثم تشفيرها بالكامل بكلمة مرور خاصة بك.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  كلمة مرور التشفير (Passphrase) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Input
                    type={showExportPass ? 'text' : 'password'}
                    value={exportPassphrase}
                    onChange={(e) => setExportPassphrase(e.target.value)}
                    placeholder="أدخل كلمة مرور قوية (8 خانات على الأقل)..."
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowExportPass(!showExportPass)}
                    className="absolute end-3 top-2.5 text-[#64748B] hover:text-[#0F172A]"
                  >
                    {showExportPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  تأكيد كلمة المرور <span className="text-red-500">*</span>
                </label>
                <Input
                  type={showExportPass ? 'text' : 'password'}
                  value={confirmPassphrase}
                  onChange={(e) => setConfirmPassphrase(e.target.value)}
                  placeholder="أعد إدخال كلمة المرور للتأكيد..."
                  required
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-[#E5EAF2] rounded-xl text-[11px] text-[#64748B] space-y-1">
              <div className="font-semibold text-[#0F172A]">ملاحظات أمنية معيارية:</div>
              <ul className="list-disc list-inside space-y-0.5">
                <li>لا يتم تخزين كلمة المرور في أي مكان نهائياً.</li>
                <li>فقدان كلمة المرور يعني استحالة استعادة محتوى الملف المشفر.</li>
                <li>يتم حساب بصمة رقمية SHA-256 للملف لضمان سلامته التامة من أي عبث.</li>
                <li>تحتوي النسخة الاحتياطية على جدول المستخدمين وتجزئات بيانات الاعتماد (Credential Hashes) ويجب حفظ وتخزين الملف المشفر في بيئة آمنة ومحمية.</li>
              </ul>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={isExporting}
            >
              {isExporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin me-2" />
                  جارٍ التشفير وتوليد الملف (PBKDF2 210,000)...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 me-2" />
                  تشفير وتنزيل النسخة الاحتياطية (.gerp)
                </>
              )}
            </Button>

            {lastExportResult && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1.5 animate-in fade-in-50">
                <div className="flex items-center gap-1.5 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>اكتمل التصدير بنجاح</span>
                </div>
                <div className="text-[11px] font-mono text-emerald-800 break-all">
                  الملف: {lastExportResult.filename}
                </div>
                <div className="flex items-center gap-4 text-[11px]">
                  <span>السجلات: {lastExportResult.totalRecords}</span>
                  <span>الجداول: {lastExportResult.tablesCount}</span>
                </div>
                <div className="text-[10px] font-mono text-slate-500 break-all">
                  البصمة (SHA-256): {lastExportResult.checksum}
                </div>
              </div>
            )}
          </form>
        </Card>

        {/* Section 2: Restore from Backup */}
        <Card
          header={
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-[#0F172A]">استعادة البيانات من نسخة مشفرة</h3>
              </div>
              <Badge variant="in_progress">Rollback Protected</Badge>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-[#64748B] leading-relaxed">
              اختر ملف النسخة الاحتياطية المشفرة (.gerp / .json / .bak) وأدخل كلمة المرور لمعاينة محتواه ومطابقة عدد السجلات قبل التنفيذ.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  اختيار ملف النسخة الاحتياطية <span className="text-red-500">*</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".gerp,.bak,.json"
                  onChange={handleFileChange}
                  className="block w-full text-xs text-slate-500 file:me-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer border border-[#E5EAF2] rounded-xl p-1"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  كلمة المرور لفك التشفير <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Input
                    type={showRestorePass ? 'text' : 'password'}
                    value={restorePassphrase}
                    onChange={(e) => setRestorePassphrase(e.target.value)}
                    placeholder="أدخل كلمة المرور التي تم التشفير بها..."
                  />
                  <button
                    type="button"
                    onClick={() => setShowRestorePass(!showRestorePass)}
                    className="absolute end-3 top-2.5 text-[#64748B] hover:text-[#0F172A]"
                  >
                    {showRestorePass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={handlePreview}
              disabled={isPreviewing || !restoreFileContent || !restorePassphrase}
            >
              {isPreviewing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin me-2" />
                  جارٍ فك التشفير والتحقق من البصمة الرقمية...
                </>
              ) : (
                <>
                  <Layers className="w-4 h-4 me-2" />
                  فك التشفير ومعاينة السجلات
                </>
              )}
            </Button>

            {previewData && (
              <div className="space-y-3 p-3 bg-[#F4F7FB] border border-[#E5EAF2] rounded-xl text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#0F172A]">نتائج فحص النسخة الاحتياطية</span>
                  <Badge variant="approved">بصمة SHA-256 متطابقة</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-[#64748B]">تاريخ النسخة: </span>
                    <span className="font-mono font-semibold">{previewData.backupDate.slice(0, 19).replace('T', ' ')}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B]">إصدار التنسيق: </span>
                    <span className="font-mono font-semibold">{previewData.backupVersion}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B]">سجلات النسخة: </span>
                    <span className="font-mono font-bold text-emerald-600">{previewData.totalBackupRecords}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B]">سجلات النظام الحالية: </span>
                    <span className="font-mono font-bold text-[#0F172A]">{previewData.totalCurrentRecords}</span>
                  </div>
                </div>

                {/* Table Comparison Snippet */}
                <div className="max-h-48 overflow-y-auto rounded-lg border border-[#E5EAF2] bg-white divide-y divide-[#E5EAF2]">
                  {Object.entries(previewData.tableCounts).map(([tableName, counts]) => (
                    <div key={tableName} className="p-2 flex items-center justify-between text-[11px]">
                      <span className="font-mono text-[#0F172A] font-medium">{tableName}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[#64748B]">حالي: {counts.current}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className="font-bold text-emerald-700">نسخة: {counts.backup}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    عند الضغط على استعادة، سيتم استبدال البيانات الحالية بالكامل في عملية ذرية (Single Atomic Transaction). في حال حدوث أي عطل، سيتم التراجع التلقائي للقطة الحالية فوراً.
                  </span>
                </div>

                <Button
                  type="button"
                  variant="danger"
                  className="w-full"
                  onClick={handleExecuteRestore}
                  disabled={isRestoring || restoreComplete}
                >
                  {isRestoring ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin me-2" />
                      جارٍ استعادة الجداول (مع خيار التراجع التلقائي)...
                    </>
                  ) : restoreComplete ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 me-2" />
                      تمت الاستعادة بنجاح
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4 me-2" />
                      تأكيد استعادة البيانات واستبدال الجداول
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Section 3: Backup Reminder Settings */}
      <Card
        header={
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-bold text-[#0F172A]">إعدادات التذكير الدوري بالنسخ الاحتياطي</h3>
            </div>
            <span className="text-xs text-[#64748B]">إعدادات النظام العامة</span>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-[#64748B]">
            حدد الفاصل الزمني الأقصى (بالأيام) بين عمليات النسخ الاحتياطي. إذا تجاوزت المدة منذ آخر نسخة هذا العدد، سيظهر شريط تحذيري بارز في لوحة التحكم ينبه المسؤولين.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-full sm:w-64">
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                تنبيه بعد مرور (أيام):
              </label>
              <Input
                type="number"
                min={1}
                max={90}
                value={reminderDays}
                onChange={(e) => setReminderDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
              />
            </div>
            <div className="pt-5 w-full sm:w-auto">
              <Button
                type="button"
                variant="primary"
                onClick={handleSaveReminderSettings}
                disabled={isSavingSettings}
              >
                {isSavingSettings ? 'جارٍ الحفظ...' : 'حفظ مدة التذكير'}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
