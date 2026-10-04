import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { ReportCatalogService } from '../services/ReportCatalogService';
import { ExportService } from '../services/ExportService';
import { useToast } from '../../../components/ui/Toast';
import type { ReportSnapshot } from '../../../types/models';
import {
  Camera,
  FileSpreadsheet,
  Trash2,
  Calendar,
  Layers,
  ArrowRight,
  Eye,
  RefreshCw,
} from 'lucide-react';

interface SnapshotsListViewProps {
  onOpenReport: (reportId: string) => void;
}

export const SnapshotsListView: React.FC<SnapshotsListViewProps> = ({ onOpenReport }) => {
  const { toast } = useToast();
  const [snapshots, setSnapshots] = useState<ReportSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSnapshot, setSelectedSnapshot] = useState<ReportSnapshot | null>(null);

  const loadSnapshots = async () => {
    setIsLoading(true);
    try {
      const data = await ReportCatalogService.getSnapshots();
      setSnapshots(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSnapshots();
  }, []);

  const handleDelete = async (id: string, title: string) => {
    try {
      await ReportCatalogService.deleteSnapshot(id);
      toast({ title: `تم حذف لقطة التقرير "${title}"`, type: 'info' });
      loadSnapshots();
      if (selectedSnapshot?.id === id) {
        setSelectedSnapshot(null);
      }
    } catch {
      toast({ title: 'فشل حذف اللقطة', type: 'error' });
    }
  };

  const handleExportSnapshotExcel = (snap: ReportSnapshot) => {
    try {
      const rows = JSON.parse(snap.dataJson);
      const totals = snap.totalsJson ? JSON.parse(snap.totalsJson) : undefined;
      const catalog = ReportCatalogService.getCatalog();
      const reportDef = catalog.find((r) => r.id === snap.reportId);

      const columns =
        reportDef?.columns ||
        Object.keys(rows[0] || {}).map((k) => ({
          key: k,
          header: k,
          type: 'string' as const,
        }));

      ExportService.exportToExcel({
        fileName: `Snapshot_${snap.reportCode}_${snap.createdAt.substring(0, 10)}`,
        title: `لقطة محفوظة: ${snap.reportTitle} (${new Date(snap.createdAt).toLocaleString('ar-SA')})`,
        columns,
        data: rows,
        totals,
      });

      toast({ title: 'تم تصدير اللقطة المحفوظة إلى Excel بنجاح', type: 'success' });
    } catch (e: unknown) {
      toast({ title: 'فشل تصدير اللقطة', type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-sm font-bold text-[#0B2545]">
            سجل اللقطات الدورية المؤرشفة (Report Snapshots Archive)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            النسخ المحفوظة الثابتة من التقارير عند تواريخ الإقفال الدوري مع الحسابات والملاحظات.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={loadSnapshots}
          className="gap-1.5 text-xs font-bold"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>تحديث السجل</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-36 bg-slate-100 rounded-2xl animate-pulse"></div>
          ))}
        </div>
      ) : snapshots.length === 0 ? (
        <Card className="p-12 text-center text-slate-400 space-y-3 border-dashed border-2 border-slate-200">
          <Camera className="w-10 h-10 mx-auto text-slate-300" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-700">لا توجد لقطات محفوظة حتى الآن</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              يمكنك في أي وقت فتح أي تقرير من الكتالوج والنقر على زر "حفظ لقطة دورية" لأرشفة البيانات الحالية.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {snapshots.map((snap) => (
            <Card
              key={snap.id}
              className="p-5 border border-slate-200 hover:border-slate-300 shadow-sm space-y-4 bg-white flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 bg-[#0B2545] text-white rounded">
                    {snap.reportCode}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {new Date(snap.createdAt).toLocaleDateString('ar-SA')}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 leading-tight">
                  {snap.reportTitle}
                </h3>

                {snap.notes && (
                  <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg line-clamp-2 italic">
                    "{snap.notes}"
                  </p>
                )}

                <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                  <span>عدد السجلات: <span className="font-bold text-slate-800">{snap.rowCount}</span></span>
                  <span>المستخدم: <span className="font-bold text-slate-700">{snap.createdBy}</span></span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleExportSnapshotExcel(snap)}
                  className="text-xs gap-1.5 font-bold text-emerald-800 border-emerald-300 bg-emerald-50 hover:bg-emerald-100"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                  <span>تصدير Excel</span>
                </Button>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onOpenReport(snap.reportId)}
                    className="text-xs font-bold text-blue-700 hover:text-blue-900 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                  >
                    تشغيل التقرير
                  </button>
                  <button
                    onClick={() => handleDelete(snap.id, snap.reportTitle)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                    title="حذف اللقطة"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
