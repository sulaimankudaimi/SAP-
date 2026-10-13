import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Download,
  Printer,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Layers,
  Database,
  FileText,
  AlertOctagon,
  ChevronDown,
  ChevronUp,
  History,
  Terminal,
} from 'lucide-react';
import { useAuthStore } from '../../../core/auth/useAuthStore';
import { useToast } from '../../../components/ui/Toast';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { ScreenSkeleton } from '../../../components/ui/Skeleton';
import { IntegrityService } from '../../../core/services/IntegrityService';
import type {
  IntegrityReport,
  IntegrityRun,
  InvariantResult,
} from '../../../types/models';

export const IntegrityPage: React.FC = () => {
  const { user } = useAuthStore();
  const { success, error } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [history, setHistory] = useState<IntegrityRun[]>([]);
  const [expandedInvariants, setExpandedInvariants] = useState<Record<number, boolean>>({});

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { report: lastReport } = await IntegrityService.getLastRun();
      const pastRuns = await IntegrityService.getRunHistory(15);
      setHistory(pastRuns);

      if (lastReport) {
        setReport(lastReport);
      } else {
        // Run report if no run has ever been saved
        const newReport = await IntegrityService.runIntegrityReport({
          executedBy: user?.username || 'مدير النظام',
        });
        setReport(newReport);
        const updatedRuns = await IntegrityService.getRunHistory(15);
        setHistory(updatedRuns);
      }
    } catch (err) {
      console.error('Failed to load integrity report:', err);
      error('تعذر استرجاع تقرير سلامة البيانات ومحددات ADR');
    } finally {
      setIsLoading(false);
    }
  }, [user, error]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRunNow = async () => {
    setIsRunning(true);
    try {
      const newReport = await IntegrityService.runIntegrityReport({
        executedBy: user?.username || 'مدير النظام',
      });
      setReport(newReport);
      const updatedRuns = await IntegrityService.getRunHistory(15);
      setHistory(updatedRuns);
      if (newReport.status === 'PASS') {
        success('اكتمل فحص سلامة البيانات: جميع المحددات الـ 7 سليمة تماماً ومطابقة!');
      } else {
        error(`اكتمل الفحص مع رصد (${newReport.totalViolations}) مخالفة/شبهة! يرجى المراجعة.`);
      }
    } catch (err) {
      console.error('Run integrity check failed:', err);
      error('فشل تشغيل فحص سلامة البيانات');
    } finally {
      setIsRunning(false);
    }
  };

  const handleExportJson = () => {
    if (!report) {
      error('لا يوجد تقرير متاح للتصدير');
      return;
    }
    IntegrityService.exportReportJson(report);
    success('تم تصدير تقرير سلامة البيانات بصيغة JSON بنجاح');
  };

  const handlePrint = () => {
    window.print();
  };

  const toggleExpand = (invNum: number) => {
    setExpandedInvariants((prev) => ({
      ...prev,
      [invNum]: !prev[invNum],
    }));
  };

  if (isLoading) {
    return <ScreenSkeleton />;
  }

  const passedCount = report?.invariants.filter((i) => i.status === 'PASS').length ?? 0;
  const totalInvariants = report?.invariants.length ?? 7;
  const isAllGreen = report?.status === 'PASS';
  const isAuditChainValid = report?.auditChain.isValid ?? true;
  const stuckOutboxCount = report?.stuckOutbox.count ?? 0;

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return '—';
    try {
      return new Date(isoStr).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div dir="rtl" className="space-y-6 print:m-0 print:p-0">
      {/* Header & Actions */}
      <div className="bg-white rounded-[16px] border border-[#E5EAF2] p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex flex-col md:flex-row md:items-center justify-between gap-4 print:border-b-2 print:shadow-none">
        <div className="space-y-1 text-start">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                isAllGreen ? 'bg-emerald-50 text-[#0FA37F]' : 'bg-red-50 text-[#EF4444]'
              }`}
            >
              {isAllGreen ? (
                <ShieldCheck className="w-6 h-6" />
              ) : (
                <ShieldAlert className="w-6 h-6" />
              )}
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-[#0B2545] tracking-tight">
                فاحص سلامة البيانات ومحددات ADR (Data Integrity Checker)
              </h1>
              <p className="text-xs text-[#64748B] mt-0.5">
                التحقق الآلي المستمر من محددات السلامة السبعة، سلسلة التدقيق الرقمية، وصندوق العمليات المعلقة
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons (Hidden on Print) */}
        <div className="flex items-center gap-2.5 shrink-0 print:hidden flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="w-4 h-4 text-[#2563EB]" />}
            onClick={handleExportJson}
            title="تصدير تقرير JSON مؤرخ"
          >
            تصدير JSON
          </Button>

          <Button
            variant="secondary"
            size="sm"
            icon={<Printer className="w-4 h-4 text-[#64748B]" />}
            onClick={handlePrint}
            title="طباعة تقرير السلامة أو حفظه كـ PDF"
          >
            طباعة التقرير
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={<RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />}
            disabled={isRunning}
            onClick={() => void handleRunNow()}
            title="تشغيل الفحص الفوري الآن"
          >
            {isRunning ? 'جارِ الفحص...' : 'تشغيل الفحص الآن'}
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Overall Status */}
        <Card className="p-4 border border-[#E5EAF2] rounded-[16px] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">الحالة الإجمالية</span>
            <span
              className={`p-1.5 rounded-lg ${
                isAllGreen ? 'bg-emerald-50 text-[#0FA37F]' : 'bg-red-50 text-[#EF4444]'
              }`}
            >
              {isAllGreen ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            </span>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span
                className={`text-2xl font-black ${
                  isAllGreen ? 'text-[#0FA37F]' : 'text-[#EF4444]'
                }`}
              >
                {isAllGreen ? 'سليم (PASS)' : 'مخالفات (FAIL)'}
              </span>
            </div>
            <p className="text-[11px] text-[#64748B] mt-1">
              {isAllGreen
                ? 'كافة محددات ADR متوافقة بنسبة 100%'
                : `تم رصد ${report?.totalViolations} مخالفة تتطلب المراجعة`}
            </p>
          </div>
        </Card>

        {/* Card 2: Invariants Pass Rate */}
        <Card className="p-4 border border-[#E5EAF2] rounded-[16px] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">محددات ADR المستوفاة</span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-[#2563EB]">
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-[#0B2545]">
                {passedCount} / {totalInvariants}
              </span>
              <span className="text-xs text-[#64748B]">محددات</span>
            </div>
            <p className="text-[11px] text-[#64748B] mt-1">
              المحددة في القرار المعماري ADR وقواعد التشغيل
            </p>
          </div>
        </Card>

        {/* Card 3: Cryptographic Audit Chain */}
        <Card className="p-4 border border-[#E5EAF2] rounded-[16px] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">سلسلة التدقيق الرقمي</span>
            <span
              className={`p-1.5 rounded-lg ${
                isAuditChainValid ? 'bg-emerald-50 text-[#0FA37F]' : 'bg-red-50 text-[#EF4444]'
              }`}
            >
              <FileText className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span
                className={`text-2xl font-black ${
                  isAuditChainValid ? 'text-[#0FA37F]' : 'text-[#EF4444]'
                }`}
              >
                {isAuditChainValid ? 'مترابطة' : 'منقطعة'}
              </span>
            </div>
            <p className="text-[11px] text-[#64748B] mt-1">
              {report?.auditChain.totalRecords ?? 0} سجل تدقيق مشفر تم التحقق منه
            </p>
          </div>
        </Card>

        {/* Card 4: Stuck Outbox Items (> 24h) */}
        <Card className="p-4 border border-[#E5EAF2] rounded-[16px] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">عمليات Outbox العالقة (&gt; 24h)</span>
            <span
              className={`p-1.5 rounded-lg ${
                stuckOutboxCount === 0 ? 'bg-emerald-50 text-[#0FA37F]' : 'bg-amber-50 text-[#F59E0B]'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span
                className={`text-2xl font-black ${
                  stuckOutboxCount === 0 ? 'text-[#0FA37F]' : 'text-[#F59E0B]'
                }`}
              >
                {stuckOutboxCount}
              </span>
              <span className="text-xs text-[#64748B]">أوامر</span>
            </div>
            <p className="text-[11px] text-[#64748B] mt-1">
              {stuckOutboxCount === 0
                ? 'لا توجد أي عمليات عالقة تتجاوز 24 ساعة'
                : 'تتطلب معالجة وإفراغ قبل إغلاق اليوم التجريبي'}
            </p>
          </div>
        </Card>
      </div>

      {/* Execution Context Banner */}
      <div className="bg-[#F4F7FB] border border-[#E5EAF2] rounded-[16px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#0F172A]">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#2563EB]" />
            <span className="text-[#64748B]">توقيت الفحص:</span>
            <strong className="font-mono">{formatDate(report?.timestamp)}</strong>
          </div>
          <div className="flex items-center gap-1.5">
            <Database className="w-4 h-4 text-[#0FA37F]" />
            <span className="text-[#64748B]">بيئة التنفيذ:</span>
            <span className="px-2 py-0.5 rounded-md bg-white border border-[#E5EAF2] font-semibold">
              {report?.mode === 'server' ? 'خادم مركزي (Supabase RPC)' : 'محلي معزول (Dexie IndexedDB)'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Terminal className="w-4 h-4 text-[#F59E0B]" />
            <span className="text-[#64748B]">المنفذ:</span>
            <span className="font-semibold">{report?.executedBy || 'النظام التلقائي'}</span>
          </div>
        </div>
        <div className="text-[11px] text-[#64748B]">
          معيار الإطلاق التجريبي: 14 يوماً متتالياً بدون حوادث S1/S2 مع فحص أخضر يومياً
        </div>
      </div>

      {/* ADR Invariants Breakdown */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-[#0B2545] flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#2563EB]" />
            <span>محددات السلامة السبعة المعتمدة (ADR Invariants Audit)</span>
          </h2>
          <span className="text-xs text-[#64748B]">
            انقر على أي محدد لاستعراض العينات والتفاصيل
          </span>
        </div>

        <div className="space-y-3">
          {report?.invariants.map((inv) => {
            const isPass = inv.status === 'PASS';
            const isExpanded = Boolean(expandedInvariants[inv.invariantNumber]);

            return (
              <div
                key={inv.invariantNumber}
                className="bg-white rounded-[16px] border border-[#E5EAF2] overflow-hidden transition-all shadow-xs hover:border-slate-300"
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleExpand(inv.invariantNumber)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleExpand(inv.invariantNumber);
                    }
                  }}
                  className="p-4 sm:p-5 flex items-start sm:items-center justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex items-start gap-3.5">
                    <span
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 sm:mt-0 ${
                        isPass
                          ? 'bg-emerald-100 text-[#0FA37F]'
                          : 'bg-red-100 text-[#EF4444]'
                      }`}
                    >
                      {inv.invariantNumber}
                    </span>
                    <div className="text-start">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-[#0B2545]">
                          {inv.invariantName}
                        </h3>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            isPass
                              ? 'bg-emerald-50 text-[#0FA37F] border border-emerald-200'
                              : 'bg-red-50 text-[#EF4444] border border-red-200'
                          }`}
                        >
                          {isPass ? 'سليم (PASS)' : `مخالفة (${inv.violationsCount})`}
                        </span>
                      </div>
                      <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                        {inv.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-end hidden sm:block">
                      <div className="text-xs font-mono font-bold text-[#0F172A]">
                        {inv.violationsCount} مخالفات
                      </div>
                      <div className="text-[11px] text-[#64748B]">
                        {isPass ? 'صفر انحراف' : 'يتطلب معالجة'}
                      </div>
                    </div>
                    <div className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Collapsible Details */}
                {isExpanded && (
                  <div className="border-t border-[#E5EAF2] p-5 bg-[#F8FAFC] space-y-3">
                    <div className="flex items-center justify-between text-xs text-[#64748B]">
                      <span>تفاصيل العينات المرصودة (Sample Violation Identifiers):</span>
                      <span>الحد الأقصى للعرض: 10 عينات</span>
                    </div>

                    {inv.sampleIds && inv.sampleIds.length > 0 ? (
                      <div className="bg-white border border-red-200 rounded-xl p-3 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-red-800">
                          <AlertOctagon className="w-4 h-4 text-red-600" />
                          <span>المعرفات المخالفة المرصودة:</span>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {inv.sampleIds.map((sample, idx) => (
                            <span
                              key={idx}
                              className="font-mono text-xs px-2.5 py-1 bg-red-50 border border-red-200 text-red-900 rounded-lg"
                            >
                              {sample}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white border border-emerald-200 rounded-xl p-3 flex items-center gap-2 text-xs text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 text-[#0FA37F]" />
                        <span>
                          لم يتم رصد أي شذوذ أو تكرار أو انحراف. المحدد محقق بنسبة 100% وفق كود ADR.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Audit Chain & Outbox Detailed Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel 1: Audit Chain Details */}
        <div className="bg-white rounded-[16px] border border-[#E5EAF2] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E5EAF2] pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#2563EB]" />
              <h3 className="text-sm font-bold text-[#0B2545]">
                تفاصيل سلسلة التدقيق التشفيرية (verify_audit_chain)
              </h3>
            </div>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                isAuditChainValid
                  ? 'bg-emerald-50 text-[#0FA37F] border border-emerald-200'
                  : 'bg-red-50 text-[#EF4444] border border-red-200'
              }`}
            >
              {isAuditChainValid ? 'سلسلة متصلة وسليمة' : 'انقطاع تشفيري'}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-[#64748B]">إجمالي السجلات التي تم فحصها:</span>
              <strong className="font-mono text-[#0F172A]">
                {report?.auditChain.totalRecords ?? 0} سجل
              </strong>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-[#64748B]">حالة الهاش التشفيري (SHA-256):</span>
              <span className="font-semibold text-emerald-700">
                {isAuditChainValid ? 'سليم ومترابط مع Genesis Block' : 'فشل التحقق'}
              </span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-[#64748B]">رسالة الفحص:</span>
              <span className="text-slate-800">
                {report?.auditChain.errorMessage || 'سلسلة التدقيق مطابقة'}
              </span>
            </div>

            {!isAuditChainValid && report?.auditChain.brokenId && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1 text-red-900">
                <div className="font-bold">السجل المنقطع / المعدل:</div>
                <div className="font-mono text-[11px] break-all">
                  ID: {report.auditChain.brokenId} | التسلسل: {report.auditChain.brokenSeq}
                </div>
                {report.auditChain.expectedHash && (
                  <div className="font-mono text-[10px] text-red-700">
                    الهاش المتوقع: {report.auditChain.expectedHash}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Panel 2: Outbox Details */}
        <div className="bg-white rounded-[16px] border border-[#E5EAF2] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E5EAF2] pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />
              <h3 className="text-sm font-bold text-[#0B2545]">
                العمليات العالقة في Outbox (&gt; 24h)
              </h3>
            </div>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                stuckOutboxCount === 0
                  ? 'bg-emerald-50 text-[#0FA37F] border border-emerald-200'
                  : 'bg-amber-50 text-[#F59E0B] border border-amber-200'
              }`}
            >
              {stuckOutboxCount === 0 ? 'مفرغ تماماً' : `${stuckOutboxCount} عالقة`}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {stuckOutboxCount === 0 ? (
              <div className="p-6 text-center text-[#64748B] space-y-1">
                <CheckCircle2 className="w-8 h-8 text-[#0FA37F] mx-auto mb-2 opacity-80" />
                <p className="font-bold text-slate-800">صندوق الإرسال نظيف تماماً</p>
                <p className="text-[11px]">
                  لا توجد أي أوامر بانتظار المزامنة أو المراجعة تجاوزت مدة الـ 24 ساعة.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {report?.stuckOutbox.items.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-mono font-bold text-amber-950">{item.id}</div>
                      <div className="text-[11px] text-slate-600">
                        النوع: {item.type} | التاريخ: {formatDate(item.createdAt)}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded-md font-semibold text-[10px]">
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* History of Previous Integrity Runs */}
      <div className="bg-white rounded-[16px] border border-[#E5EAF2] p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#E5EAF2] pb-3">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#2563EB]" />
            <h3 className="text-sm font-bold text-[#0B2545]">
              سجل الفحوصات الدورية السابقة (integrity_runs)
            </h3>
          </div>
          <span className="text-xs text-[#64748B]">
            يُحفظ الفحص كل 6 ساعات وأوتوماتيكياً عند بدء تشغيل التطبيق
          </span>
        </div>

        {history.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#64748B]">
            لا توجد سجلات فحوصات سابقة مخزنة.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="border-b border-[#E5EAF2] text-[#64748B] bg-slate-50">
                  <th className="py-2.5 px-3 text-start font-semibold">رقم الفحص</th>
                  <th className="py-2.5 px-3 text-start font-semibold">تاريخ ووقت التشغيل</th>
                  <th className="py-2.5 px-3 text-start font-semibold">البيئة</th>
                  <th className="py-2.5 px-3 text-start font-semibold">المنفذ</th>
                  <th className="py-2.5 px-3 text-start font-semibold">عدد المخالفات</th>
                  <th className="py-2.5 px-3 text-start font-semibold">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF2]">
                {history.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-700">
                      {run.id}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-800">
                      {formatDate(run.timestamp)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                        {run.mode}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">
                      {run.executedBy}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold">
                      {run.totalViolations}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                          run.status === 'PASS'
                            ? 'bg-emerald-50 text-[#0FA37F]'
                            : 'bg-red-50 text-[#EF4444]'
                        }`}
                      >
                        {run.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Printable Report Footer (Only visible on print) */}
      <div className="hidden print:block pt-8 border-t border-slate-300 text-xs text-slate-600">
        <div className="flex justify-between items-center">
          <div>
            <strong>شركة الخليج للطاقة — نظام Gulf Energy ERP</strong>
            <div>تقرير الفحص الآلي لسلامة البيانات ومحددات ADR</div>
          </div>
          <div className="text-end">
            <div>التوقيت: {formatDate(report?.timestamp)}</div>
            <div>المسؤول: {report?.executedBy}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
