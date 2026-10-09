import React, { useState, useEffect } from 'react';
import {
  Activity,
  ShieldCheck,
  Database,
  Download,
  Trash2,
  AlertTriangle,
  Info,
  CheckCircle2,
  Bug,
  RefreshCw,
  HardDrive,
  Cpu,
} from 'lucide-react';
import { DiagnosticLogger, DiagnosticLogEntry } from '../core/services/DiagnosticLogger';
import { db } from '../core/db';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { StatCard } from '../components/ui/StatCard';
import { useToast } from '../components/ui/Toast';

import { downloadJsonFile } from '../core/utils/fileDownloader';

export const DiagnosticsPage: React.FC = () => {
  const { success, info } = useToast();
  const [logs, setLogs] = useState<DiagnosticLogEntry[]>(DiagnosticLogger.getLogs());
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [dbTableStats, setDbTableStats] = useState<{ name: string; count: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [triggerCrash, setTriggerCrash] = useState(false);

  useEffect(() => {
    const unsubscribe = DiagnosticLogger.subscribe(() => {
      setLogs(DiagnosticLogger.getLogs());
    });
    fetchDbStats();
    return () => unsubscribe();
  }, []);

  const fetchDbStats = async () => {
    setLoading(true);
    try {
      const stats = [
        { name: 'materials', count: await db.materials.count() },
        { name: 'purchaseOrders', count: await db.purchaseOrders.count() },
        { name: 'goodsReceipts', count: await db.goodsReceipts.count() },
        { name: 'stockBalances', count: await db.stockBalances.count() },
        { name: 'journalEntries', count: await db.journalEntries.count() },
        { name: 'assets', count: await db.assets.count() },
        { name: 'vehicles', count: await db.vehicles.count() },
        { name: 'auditLogs', count: await db.auditLogs.count() },
      ];
      setDbTableStats(stats);
    } catch (e) {
      DiagnosticLogger.error('DiagnosticsPage', 'Error occurred', e);
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = () => {
    DiagnosticLogger.clearLogs();
    info('تم تفريغ السجل', 'تم مسح جميع سجلات التشخيص بنجاح');
  };

  const handleExportJson = () => {
    const jsonStr = DiagnosticLogger.exportJson();
    const filename = `gulf_erp_diagnostics_${new Date().toISOString().slice(0, 10)}.json`;
    downloadJsonFile(filename, jsonStr)
      .then(() => success('تم التصدير', 'تم تصدير ملف تقرير التشخيص بنجاح'))
      .catch((e: unknown) => { DiagnosticLogger.error('DiagnosticsPage', 'Operation failed', e); });
  };

  const filteredLogs = logs.filter((log) => {
    if (filterLevel === 'all') return true;
    return log.level === filterLevel;
  });

  if (triggerCrash) {
    throw new Error('اختبار يدوي متعمد لمحاكاة استثناء غير متوقع واختبار ErrorBoundary');
  }

  const totalRecords = dbTableStats.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header and Breadcrumbs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Breadcrumbs
            items={[
              { label: 'الرئيسية', path: '/' },
              { label: 'إدارة النظام', path: '/admin/dev' },
              { label: 'سجلات التشخيص وصحة النظام' },
            ]}
          />
          <h1 className="text-xl md:text-2xl font-bold text-[#0F172A] mt-2 flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-[#0FA37F]" />
            سجلات التشخيص وصحة النظام (System Diagnostics & Health)
          </h1>
          <p className="text-xs text-[#64748B] mt-1">
            مراقبة سلامة العمليات المعزولة بنسبة 100% دون اتصال خارجي، وفحص استجابة قاعدة البيانات المحلية وسجلات الأخطاء.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchDbStats}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            تحديث المؤشرات
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportJson}
            icon={<Download className="w-3.5 h-3.5" />}
          >
            تصدير تقرير JSON
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearLogs}
            icon={<Trash2 className="w-3.5 h-3.5 text-[#EF4444]" />}
            className="text-[#EF4444] hover:bg-red-50"
          >
            مسح السجلات
          </Button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="حالة الشبكة الخارجية"
          value="100% بدون اتصال"
          icon={<ShieldCheck className="w-5 h-5 text-[#0FA37F]" />}
          subtitle="حظر كامل لأي طلب شبكي خارجي"
        />
        <StatCard
          label="محرك التخزين المحلي"
          value="Dexie IndexedDB"
          icon={<HardDrive className="w-5 h-5 text-[#2563EB]" />}
          subtitle="قاعدة بيانات محلية متوافقة مع SQLite"
        />
        <StatCard
          label="إجمالي السجلات المفهرسة"
          value={totalRecords.toLocaleString('en-US')}
          icon={<Database className="w-5 h-5 text-[#F59E0B]" />}
          subtitle="بيانات تشغيلية ومالية ومواد"
        />
        <StatCard
          label="سجلات التشخيص النشطة"
          value={logs.length.toString()}
          icon={<Cpu className="w-5 h-5 text-[#64748B]" />}
          subtitle="أحداث تشخيصية مخزنة بالذاكرة"
        />
      </div>

      {/* Database Tables Health Grid */}
      <Card
        header={
          <div>
            <div className="font-bold text-[#0F172A]">فهرس الجداول المحلية (IndexedDB Tables Health)</div>
            <div className="text-xs text-[#64748B] font-normal mt-0.5">مراقبة كثافة السجلات وسرعة استجابة الاستعلامات المفهرسة</div>
          </div>
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {dbTableStats.map((item) => (
            <div
              key={item.name}
              className="p-3 bg-[#F4F7FB] border border-[#E5EAF2] rounded-xl flex items-center justify-between"
            >
              <div className="space-y-0.5">
                <span className="text-[11px] font-mono text-[#64748B]">{item.name}</span>
                <div className="text-sm font-bold text-[#0F172A] font-mono">
                  {item.count.toLocaleString('en-US')}
                </div>
              </div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#0FA37F]" title="نشط وسليم" />
            </div>
          ))}
        </div>
      </Card>

      {/* Diagnostic Logs Panel */}
      <Card
        header={
          <div>
            <div className="font-bold text-[#0F172A]">سجل الأحداث والتشخيص الداخلي (Diagnostic Events Stream)</div>
            <div className="text-xs text-[#64748B] font-normal mt-0.5">سجل زمني حي لجميع الأحداث البرمجية والتحذيرات</div>
          </div>
        }
        action={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[#F4F7FB] p-1 rounded-lg text-xs">
              {(['all', 'error', 'warn', 'info'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setFilterLevel(lvl)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    filterLevel === lvl
                      ? 'bg-white text-[#0F172A] shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  {lvl === 'all'
                    ? 'الكل'
                    : lvl === 'error'
                    ? 'الأخطاء'
                    : lvl === 'warn'
                    ? 'التحذيرات'
                    : 'المعلومات'}
                </button>
              ))}
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setTriggerCrash(true)}
              icon={<Bug className="w-3.5 h-3.5 text-amber-500" />}
              className="text-amber-700 border-amber-200 hover:bg-amber-50"
            >
              اختبار عزل الخطأ (ErrorBoundary Test)
            </Button>
          </div>
        }
      >
        {filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-[#64748B] text-xs space-y-2">
            <CheckCircle2 className="w-8 h-8 text-[#0FA37F] mx-auto opacity-70" />
            <p>لا توجد سجلات تشخيص مطابقة للفلتر المحدد</p>
          </div>
        ) : (
          <div className="divide-y divide-[#E5EAF2] -mx-6 -mb-6 max-h-[460px] overflow-y-auto">
            {filteredLogs.map((entry) => (
              <div key={entry.id} className="p-3.5 hover:bg-[#F4F7FB]/50 transition-colors flex items-start gap-3 text-xs">
                <div className="mt-0.5 shrink-0">
                  {entry.level === 'error' || entry.level === 'fatal' ? (
                    <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
                  ) : entry.level === 'warn' ? (
                    <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
                  ) : (
                    <Info className="w-4 h-4 text-[#2563EB]" />
                  )}
                </div>

                <div className="flex-1 space-y-1 overflow-hidden">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[#0F172A]">{entry.message}</span>
                    <span className="text-[10px] text-[#64748B] font-mono shrink-0">
                      {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-[#64748B]">
                    <span className="bg-[#E5EAF2] px-1.5 py-0.5 rounded text-[#0F172A] font-mono text-[10px]">
                      {entry.module}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">{entry.id}</span>
                  </div>

                  {entry.stack && (
                    <div
                      className="mt-2 p-2 bg-[#0B2545] text-emerald-400 rounded-lg text-[10px] font-mono overflow-x-auto text-left"
                      dir="ltr"
                    >
                      {entry.stack}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
