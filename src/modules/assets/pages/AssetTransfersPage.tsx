import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Skeleton } from '../../../components/ui/Skeleton';
import { AssetService } from '../services/AssetService';
import { assetTransferRepository } from '../../../core/repositories';
import { useAuthStore } from '../../../core/auth/useAuthStore';
import { useToast } from '../../../components/ui/Toast';
import type { AssetTransfer } from '../../../types/models';
import {
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  Search,
  Building2,
  User,
  ShieldCheck,
  FileCheck,
} from 'lucide-react';
import { t } from '../../../i18n/ar';

export const AssetTransfersPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const { success, error } = useToast();

  const [loading, setLoading] = useState(true);
  const [transfers, setTransfers] = useState<AssetTransfer[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const loadTransfers = async () => {
    setLoading(true);
    try {
      const list = await assetTransferRepository.list();
      setTransfers(list.filter((t: AssetTransfer) => !t.isDeleted).reverse());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransfers();
  }, []);

  const handleApprove = async (transferId: string) => {
    if (!user) return;
    try {
      const result = await AssetService.approveTransfer(transferId, {
        id: user.id,
        fullName: user.fullName,
      });
      success(
        'تم اعتماد نقل العهدة',
        `تم نقل عهدة الأصل ${result.asset.assetNumber} رسمياً إلى ${result.transfer.toCustodian}`
      );
      loadTransfers();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل الاعتماد';
      error('خطأ', msg);
    }
  };

  const handleAcknowledge = async (transferId: string) => {
    if (!user) return;
    try {
      await AssetService.acknowledgeCustody(transferId, {
        id: user.id,
        fullName: user.fullName,
      });
      success(
        'تم توقيع إقرار استلام العهدة',
        'تم تسجيل إقرار الاستلام وحفظه بسجل التدقيق.'
      );
      loadTransfers();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل التوقيع';
      error('خطأ', msg);
    }
  };

  const filteredTransfers = transfers.filter((tr) => {
    if (statusFilter && tr.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchesNum = tr.docNumber.toLowerCase().includes(q);
      const matchesAsset = tr.assetNumber.toLowerCase().includes(q);
      const matchesTo = tr.toCustodian.toLowerCase().includes(q);
      const matchesFrom = tr.fromCustodian.toLowerCase().includes(q);
      if (!matchesNum && !matchesAsset && !matchesTo && !matchesFrom) return false;
    }
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-[#0FA37F]/10 text-emerald-800 border border-emerald-300">
            SAP Transaction ABT1N
          </span>
          <span className="text-xs text-slate-500 font-mono">Custody Transfers & Handover Log</span>
        </div>
        <h1 className="text-2xl font-black text-[#0B2545] tracking-tight mt-1">
          {t('asset_custody_history')}
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          إدارة ومتابعة طلبات مناقلة الأصول، تغيير مراكز التكلفة، وإقرارات استلام العهدة الرقمية
        </p>
      </div>

      {/* Filters */}
      <Card className="p-4 shadow-sm border border-slate-200">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute top-3 end-3" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث برقم المستند، رقم الأصل، أمين العهدة..."
              className="pe-9 text-xs"
            />
          </div>

          <div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: '', label: 'كافة حالات المناقلة' },
                { value: 'pending', label: 'معلق بانتظار الاعتماد' },
                { value: 'approved', label: 'معتمد رسمياً' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="p-0 shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : filteredTransfers.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            لا توجد سجلات مناقلة مطابقة لمعايير البحث.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 text-start">رقم المستند</th>
                  <th className="py-3 px-3 text-start">الأصل الرأسمالي</th>
                  <th className="py-3 px-3 text-start">تاريخ النقل</th>
                  <th className="py-3 px-3 text-start">من محطة / موقع</th>
                  <th className="py-3 px-3 text-start">إلى محطة / موقع</th>
                  <th className="py-3 px-3 text-start">أمين العهدة السابق</th>
                  <th className="py-3 px-3 text-start">أمين العهدة الجديد</th>
                  <th className="py-3 px-3 text-start">المبررات</th>
                  <th className="py-3 px-3 text-start">الحالة</th>
                  <th className="py-3 px-3 text-start">إقرار الاستلام</th>
                  <th className="py-3 px-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransfers.map((tr) => (
                  <tr key={tr.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-3 font-mono font-bold text-blue-900">{tr.docNumber}</td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-800">{tr.assetName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{tr.assetNumber}</div>
                    </td>
                    <td className="py-3 px-3 font-mono">{tr.transferDate}</td>
                    <td className="py-3 px-3 text-slate-600">
                      <div>{tr.fromPlant}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{tr.fromCostCenter}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-800 font-semibold">
                      <div>{tr.toPlant}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{tr.toCostCenter}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-600">{tr.fromCustodian}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{tr.toCustodian}</td>
                    <td className="py-3 px-3 text-slate-500 max-w-[150px] truncate" title={tr.reason}>
                      {tr.reason}
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant={tr.status === 'approved' ? 'completed' : 'pending'}>
                        {tr.status === 'approved' ? 'معتمد' : 'بانتظار الاعتماد'}
                      </Badge>
                    </td>
                    <td className="py-3 px-3">
                      {tr.acknowledgedByCustodian ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-1 text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          تم التسليم والإقرار
                        </span>
                      ) : (
                        <span className="text-amber-700 text-[11px] font-medium flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          بانتظار توقيع المستلم
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {tr.status !== 'approved' && (
                          <Button
                            size="sm"
                            onClick={() => handleApprove(tr.id)}
                            className="text-[11px] h-7 px-2.5 bg-[#0FA37F] hover:bg-[#0c8a6c] font-bold"
                          >
                            اعتماد النقل
                          </Button>
                        )}
                        {!tr.acknowledgedByCustodian && tr.status === 'approved' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleAcknowledge(tr.id)}
                            className="text-[11px] h-7 px-2.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-bold"
                          >
                            توقيع الاستلام
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
