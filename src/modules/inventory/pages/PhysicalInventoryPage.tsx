import { DiagnosticLogger } from '../../../core/services/DiagnosticLogger';
import React, { useState, useEffect } from 'react';
import { db } from '../../../core/db';
import { StatCard } from '../../../components/ui/StatCard';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { useToast } from '../../../components/ui/Toast';
import { PhysicalInventoryModal } from '../components/PhysicalInventoryModal';
import {
  ClipboardCheck,
  Plus,
  FileCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Eye,
  Warehouse,
} from 'lucide-react';
import type { PhysicalInventoryDoc } from '../../../types/models';

export const PhysicalInventoryPage: React.FC = () => {
  const { success, error } = useToast();

  const [piDocs, setPiDocs] = useState<PhysicalInventoryDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal control
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<PhysicalInventoryDoc | null>(null);

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const docs = await db.physicalInventoryDocs.reverse().toArray();
      setPiDocs(docs);
    } catch (err) {
      DiagnosticLogger.error('PhysicalInventoryPage', 'Error occurred', err);
      error('خطأ', 'تعذر تحميل مستندات الجرد الفعلي');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="approved">مكتمل ومُرحَّل (701/702)</Badge>;
      case 'in_review':
        return <Badge variant="in_review">قيد مراجعة الفروقات</Badge>;
      case 'draft':
      default:
        return <Badge variant="in_progress">مسودة بانتظار العد</Badge>;
    }
  };

  const handleOpenDoc = (doc: PhysicalInventoryDoc) => {
    setSelectedDoc(doc);
    setIsModalOpen(true);
  };

  const handleNewDoc = () => {
    setSelectedDoc(null);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 text-start p-6 max-w-7xl mx-auto" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#E5EAF2]">
        <div>
          <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-[#0FA37F]" />
            الجرد الفعلي ومطابقة الفروقات المخزنية (Physical Inventory - MI01 / MI04 / MI07)
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            دورة الجرد الدوري والمفاجئ، تسجيل العد الميداني، واعتماد ترحيل فوارق العجز والفائض المخزني
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={loadDocuments}>
            تحديث
          </Button>
          <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={handleNewDoc}>
            إنشاء دورة جرد جديدة (MI01)
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="دورات الجرد المكتملة"
          value={piDocs.filter((d) => d.status === 'completed').length}
          subtitle="تم ترحيل فروقاتها بنجاح"
          icon={<CheckCircle2 className="w-5 h-5 text-[#0FA37F]" />}
        />

        <StatCard
          label="دورات قيد العد والمراجعة"
          value={piDocs.filter((d) => d.status !== 'completed').length}
          subtitle="بانتظار إدخال العد أو الاعتماد"
          icon={<Clock className="w-5 h-5 text-[#F59E0B]" />}
        />

        <StatCard
          label="إجمالي دورات الجرد المنفذة"
          value={piDocs.length}
          subtitle="خلال السنة المالية FY-2026"
          icon={<ClipboardCheck className="w-5 h-5 text-[#2563EB]" />}
        />
      </div>

      {/* Documents Table */}
      <div className="bg-white rounded-2xl border border-[#E5EAF2] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E5EAF2]">
              <tr>
                <th className="p-3 text-start">رقم مستند الجرد</th>
                <th className="p-3 text-start">المحطة والمستودع</th>
                <th className="p-3 text-center">تاريخ الجرد</th>
                <th className="p-3 text-center">تجميد الحركات</th>
                <th className="p-3 text-center">عدد البنود</th>
                <th className="p-3 text-end">صافي قيمة الفروقات</th>
                <th className="p-3 text-center">الحالة</th>
                <th className="p-3 text-center">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EAF2]">
              {piDocs.length > 0 ? (
                piDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-mono font-bold text-[#0F172A]">{doc.docNumber}</td>
                    <td className="p-3">
                      <span className="font-mono font-bold text-[#0F172A]">{doc.storageLocation}</span>
                      <span className="text-[10px] text-[#64748B] block">فرع {doc.plantCode}</span>
                    </td>
                    <td className="p-3 text-center font-mono text-[#64748B]">{doc.countDate}</td>
                    <td className="p-3 text-center">
                      <Badge variant={doc.freezeMovements ? 'critical' : 'neutral'}>
                        {doc.freezeMovements ? 'مجمّد' : 'نشط'}
                      </Badge>
                    </td>
                    <td className="p-3 text-center font-bold font-mono">{doc.items.length}</td>
                    <td className="p-3 text-end font-mono font-bold">
                      <span
                        className={
                          (doc.totalVarianceValue || 0) >= 0 ? 'text-[#0FA37F]' : 'text-[#EF4444]'
                        }
                      >
                        {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(
                          doc.totalVarianceValue || 0
                        )}{' '}
                        ر.س
                      </span>
                    </td>
                    <td className="p-3 text-center">{getStatusBadge(doc.status)}</td>
                    <td className="p-3 text-center">
                      <Button
                        size="sm"
                        variant={doc.status === 'completed' ? 'secondary' : 'primary'}
                        icon={<Eye className="w-3.5 h-3.5" />}
                        onClick={() => handleOpenDoc(doc)}
                      >
                        {doc.status === 'completed' ? 'استعراض' : 'إكمال العد والترحيل'}
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-[#64748B]">
                    لا توجد مستندات جرد فعلي حالياً. انقر على "إنشاء دورة جرد جديدة" للبدء.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <PhysicalInventoryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => loadDocuments()}
        activeDoc={selectedDoc}
      />
    </div>
  );
};
