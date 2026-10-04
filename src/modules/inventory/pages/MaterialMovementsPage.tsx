import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../core/db';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { Drawer } from '../../../components/ui/Drawer';
import { useToast } from '../../../components/ui/Toast';
import { exportToCsv } from '../../../core/utils/importExport';
import {
  Activity,
  Search,
  Filter,
  Download,
  FileText,
  Boxes,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  Trash2,
  Calendar,
  Layers,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import type { StockLedgerEntry, MaterialDocument, MovementTypeCode } from '../../../types/models';

export const MaterialMovementsPage: React.FC = () => {
  const { success, error } = useToast();

  const [ledgerEntries, setLedgerEntries] = useState<StockLedgerEntry[]>([]);
  const [materialDocs, setMaterialDocs] = useState<MaterialDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMovementType, setSelectedMovementType] = useState('ALL');
  const [selectedPlant, setSelectedPlant] = useState('ALL');

  // Selected doc for drawer
  const [selectedDoc, setSelectedDoc] = useState<MaterialDocument | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const loadMovements = async () => {
    setIsLoading(true);
    try {
      const [ledger, docs] = await Promise.all([
        db.stockLedger.reverse().toArray(),
        db.materialDocuments.reverse().toArray(),
      ]);
      setLedgerEntries(ledger);
      setMaterialDocs(docs);
    } catch (err) {
      console.error(err);
      error('خطأ', 'تعذر تحميل حركات المواد');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMovements();
  }, []);

  const getMovementBadge = (type: string) => {
    switch (type) {
      case '101':
        return <Badge variant="approved">101 استلام بأمر شراء</Badge>;
      case '102':
        return <Badge variant="critical">102 عكس استلام</Badge>;
      case '201':
        return <Badge variant="in_progress">201 صرف لمركز تكلفة</Badge>;
      case '261':
        return <Badge variant="in_review">261 صرف لأمر صيانة</Badge>;
      case '301':
        return <Badge variant="neutral">301 نقل بين المحطات</Badge>;
      case '311':
        return <Badge variant="in_progress">311 نقل بين المستودعات</Badge>;
      case '501':
        return <Badge variant="approved">501 استلام بدون أمر</Badge>;
      case '551':
        return <Badge variant="critical">551 تخريد وإتلاف</Badge>;
      case '701':
        return <Badge variant="approved">701 تسوية جرد (فائض)</Badge>;
      case '702':
        return <Badge variant="critical">702 تسوية جرد (عجز)</Badge>;
      default:
        return <Badge variant="neutral">{type}</Badge>;
    }
  };

  const filteredEntries = useMemo(() => {
    return ledgerEntries.filter((entry) => {
      if (selectedMovementType !== 'ALL' && entry.movementType !== selectedMovementType) return false;
      if (selectedPlant !== 'ALL' && entry.plantCode !== selectedPlant) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const codeMatch = entry.materialCode.toLowerCase().includes(q);
        const refMatch = entry.referenceDocNumber?.toLowerCase().includes(q) || false;
        const slocMatch = entry.storageLocation?.toLowerCase().includes(q) || false;
        if (!codeMatch && !refMatch && !slocMatch) return false;
      }
      return true;
    });
  }, [ledgerEntries, selectedMovementType, selectedPlant, searchQuery]);

  const handleOpenDoc = (refNumber: string) => {
    const doc = materialDocs.find((d) => d.docNumber === refNumber || d.poNumber === refNumber);
    if (doc) {
      setSelectedDoc(doc);
      setIsDrawerOpen(true);
    }
  };

  const handleExportCsv = () => {
    const data = filteredEntries.map((e) => ({
      'المعرف': e.id,
      'رمز الصنف': e.materialCode,
      'نوع الحركة': e.movementType,
      'المحطة': e.plantCode,
      'المستودع': e.storageLocation,
      'الكمية': e.quantity,
      'الوحدة': e.unit,
      'القيمة الإجمالية (SAR)': e.amount,
      'المستند المرجعي': e.referenceDocNumber,
      'تاريخ الترحيل': e.postingDate,
      'المستخدم': e.createdBy,
    }));
    exportToCsv(data, `Gulf_Energy_Movements_${new Date().toISOString().split('T')[0]}`);
    success('تم التصدير بنجاح', 'تم تنزيل سجل حركات المواد.');
  };

  return (
    <div className="space-y-6 text-start p-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#E5EAF2]">
        <div>
          <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <Activity className="w-6 h-6 text-[#2563EB]" />
            سجل حركات المواد الفعلي (Material Movements Ledger - MB51)
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            سجل التدقيق الشامل لكافة حركات الاستلام، الصرف، النقل، والتسويات المخزنية
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<Download className="w-4 h-4" />} onClick={handleExportCsv}>
            تصدير CSV
          </Button>
          <Button variant="secondary" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={loadMovements}>
            تحديث
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 bg-white rounded-2xl border border-[#E5EAF2] shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            placeholder="بحث برمز الصنف، رقم المستند المرجعي، أو المستودع..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            startIcon={<Search className="w-4 h-4 text-[#64748B]" />}
          />

          <Select
            label="نوع الحركة (SAP Movement Type):"
            value={selectedMovementType}
            onChange={(e) => setSelectedMovementType(e.target.value)}
            options={[
              { label: 'كافة أنواع الحركات (الكل)', value: 'ALL' },
              { label: '101 - استلام بضائع مقابل أمر شراء', value: '101' },
              { label: '102 - عكس استلام بضائع', value: '102' },
              { label: '201 - صرف لمركز تكلفة تشغيلي', value: '201' },
              { label: '261 - صرف لأمر صيانة أو أسطول', value: '261' },
              { label: '301 - نقل بين المحطات والفروع', value: '301' },
              { label: '311 - نقل بين مستودعات المنشأة', value: '311' },
              { label: '501 - استلام بضائع بدون أمر شراء', value: '501' },
              { label: '551 - تخريد وإتلاف مخزني', value: '551' },
              { label: '701 - تسوية جرد فعلي (فائض)', value: '701' },
              { label: '702 - تسوية جرد فعلي (عجز)', value: '702' },
            ]}
          />

          <Select
            label="المحطة:"
            value={selectedPlant}
            onChange={(e) => setSelectedPlant(e.target.value)}
            options={[
              { label: 'كافة المحطات (الكل)', value: 'ALL' },
              { label: '1100 - مركز الرياض اللوجستي', value: '1100' },
              { label: '1200 - محطة ينبع البترولية', value: '1200' },
              { label: '1300 - مجمع الدمام التشغيلي', value: '1300' },
            ]}
          />
        </div>
      </div>

      {/* Movements Table */}
      <div className="bg-white rounded-2xl border border-[#E5EAF2] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E5EAF2]">
              <tr>
                <th className="p-3 text-start">نوع الحركة</th>
                <th className="p-3 text-start">رمز الصنف</th>
                <th className="p-3 text-start">المحطة والمستودع</th>
                <th className="p-3 text-center">الكمية</th>
                <th className="p-3 text-end">القيمة الإجمالية</th>
                <th className="p-3 text-start">المستند المرجعي</th>
                <th className="p-3 text-start">تاريخ الترحيل</th>
                <th className="p-3 text-start">المستخدم</th>
                <th className="p-3 text-center">المستند</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EAF2]">
              {filteredEntries.length > 0 ? (
                filteredEntries.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3">{getMovementBadge(e.movementType)}</td>
                    <td className="p-3 font-mono font-bold text-[#0F172A]">{e.materialCode}</td>
                    <td className="p-3">
                      <span className="font-mono font-bold text-[#0F172A]">{e.storageLocation}</span>
                      <span className="text-[10px] text-[#64748B] block">فرع {e.plantCode}</span>
                    </td>
                    <td className="p-3 text-center font-mono font-bold">
                      <span className={e.quantity > 0 ? 'text-[#0FA37F]' : 'text-[#EF4444]'}>
                        {e.quantity > 0 ? `+${new Intl.NumberFormat('en-US').format(e.quantity)}` : new Intl.NumberFormat('en-US').format(e.quantity)}{' '}
                        {e.unit}
                      </span>
                    </td>
                    <td className="p-3 text-end font-mono font-bold text-[#0B2545]">
                      {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(Math.abs(e.amount))} ر.س
                    </td>
                    <td className="p-3 font-mono text-[#64748B]">{e.referenceDocNumber || '-'}</td>
                    <td className="p-3 font-mono text-[#64748B]">{e.postingDate}</td>
                    <td className="p-3 text-[#64748B]">{e.createdBy}</td>
                    <td className="p-3 text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<FileText className="w-3.5 h-3.5" />}
                        onClick={() => handleOpenDoc(e.referenceDocNumber)}
                      >
                        عرض
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-[#64748B]">
                    لا توجد حركات مطابقة لشروط البحث والتصفية.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Material Document Details Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={selectedDoc ? `مستند المواد: ${selectedDoc.docNumber}` : 'تفاصيل المستند'}
        size="md"
      >
        {selectedDoc && (
          <div className="space-y-4 text-start text-xs" dir="rtl">
            <div className="p-4 bg-[#F8FAFC] rounded-2xl border border-[#E5EAF2] space-y-2">
              <div className="flex justify-between">
                <span className="text-[#64748B]">رقم مستند المواد (MBLNR):</span>
                <span className="font-mono font-bold text-[#0F172A]">{selectedDoc.docNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">نوع الحركة:</span>
                <span>{getMovementBadge(selectedDoc.movementType)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">تاريخ الترحيل:</span>
                <span className="font-mono">{selectedDoc.postingDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">أمر الشراء / المرجع:</span>
                <span className="font-mono text-[#2563EB]">{selectedDoc.poNumber || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">القيد المحاسبي المرتبط:</span>
                <span className="font-mono font-bold text-[#0FA37F]">
                  {selectedDoc.accountingDocNumber || 'JE-2026-AUTO'}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-[#0F172A]">بنود مستند المواد:</h4>
              <div className="space-y-2">
                {selectedDoc.items.map((it) => (
                  <div key={it.lineItem} className="p-3 bg-white rounded-xl border border-[#E5EAF2] space-y-1">
                    <div className="flex justify-between font-bold text-[#0F172A]">
                      <span>{it.materialName}</span>
                      <span className="font-mono text-[#0FA37F]">
                        {it.quantity} {it.unit}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-[#64748B]">
                      <span>رمز الصنف: {it.materialCode}</span>
                      <span>موقع: {it.storageLocation}</span>
                    </div>
                    {it.costCenter && (
                      <div className="text-[10px] text-blue-600 font-semibold">
                        مركز التكلفة: {it.costCenter}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
