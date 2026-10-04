import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useToast } from '../../../components/ui/Toast';
import { db } from '../../../core/db';
import { ControllingService } from '../services/ControllingService';
import type { CostCenter } from '../../../types/models';
import { Layers, Plus, Trash2 } from 'lucide-react';

interface CostAllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CostAllocationModal: React.FC<CostAllocationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [cycleCode, setCycleCode] = useState('CYC-CORP-01');
  const [cycleName, setCycleName] = useState('توزيع نفقات الإدارة العامة والخدمات المركزية المشتركة');
  const [fiscalYear, setFiscalYear] = useState('2026');
  const [period, setPeriod] = useState(new Date().getMonth() + 1);
  const [senderCostCenter, setSenderCostCenter] = useState('CC-1010');
  const [totalAmount, setTotalAmount] = useState('120000');
  const [segments, setSegments] = useState([
    { receiverCostCenter: 'CC-1001', percentage: 40, allocatedAmount: 48000 },
    { receiverCostCenter: 'CC-1002', percentage: 35, allocatedAmount: 42000 },
    { receiverCostCenter: 'CC-1003', percentage: 25, allocatedAmount: 30000 },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadCostCenters() {
      const data = await db.costCenters.filter((c) => !c.isDeleted).toArray();
      setCostCenters(data);
    }
    if (isOpen) {
      loadCostCenters();
    }
  }, [isOpen]);

  const handleTotalChange = (val: string) => {
    setTotalAmount(val);
    const num = parseFloat(val) || 0;
    setSegments(
      segments.map((s) => ({
        ...s,
        allocatedAmount: Math.round((num * (s.percentage / 100)) * 100) / 100,
      }))
    );
  };

  const updateSegmentPct = (index: number, pct: number) => {
    const numTotal = parseFloat(totalAmount) || 0;
    const updated = [...segments];
    updated[index].percentage = pct;
    updated[index].allocatedAmount = Math.round((numTotal * (pct / 100)) * 100) / 100;
    setSegments(updated);
  };

  const updateSegmentReceiver = (index: number, cc: string) => {
    const updated = [...segments];
    updated[index].receiverCostCenter = cc;
    setSegments(updated);
  };

  const addSegment = () => {
    setSegments([
      ...segments,
      { receiverCostCenter: 'CC-1004', percentage: 10, allocatedAmount: 0 },
    ]);
  };

  const removeSegment = (index: number) => {
    if (segments.length <= 1) return;
    setSegments(segments.filter((_, i) => i !== index));
  };

  const totalPercentage = segments.reduce((acc, s) => acc + (Number(s.percentage) || 0), 0);
  const is100Percent = Math.abs(totalPercentage - 100) < 0.1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!is100Percent) {
      showToast(`مجموع نسب التوزيع يجب أن يساوي 100% بدقة (المجموع الحالي: ${totalPercentage}%).`, 'warning');
      return;
    }

    const numTotal = parseFloat(totalAmount);
    if (!numTotal || numTotal <= 0) {
      showToast('يرجى إدخال مبلغ صحيح للتوزيع.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await ControllingService.executeAllocationCycle({
        cycleCode,
        name: cycleName,
        fiscalYear,
        period: Number(period),
        senderCostCenter,
        totalAmount: numTotal,
        segments,
        createdBy: 'usr-admin-1',
      });

      showToast(`تم بنجاح تشغيل دورة التوزيع وترحيل القيد للأستاذ العام برقم ${res.jeDocNumber}`, 'success');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'فشل تنفيذ دورة توزيع التكاليف', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="تشغيل دورة توزيع الأعباء والتكاليف المشتركة (SAP KSU5 - Cost Assessment Cycle)"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-800">
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-3 gap-3">
          <div>
            <label className="text-slate-500 font-bold block mb-1">رمز الدورة (Cycle Code)</label>
            <Input value={cycleCode} onChange={(e) => setCycleCode(e.target.value)} className="font-mono" required />
          </div>
          <div className="col-span-2">
            <label className="text-slate-500 font-bold block mb-1">اسم الدورة</label>
            <Input value={cycleName} onChange={(e) => setCycleName(e.target.value)} required />
          </div>
          <div>
            <label className="text-slate-500 font-bold block mb-1">السنة المالية</label>
            <Input value={fiscalYear} onChange={(e) => setFiscalYear(e.target.value)} className="font-mono" />
          </div>
          <div>
            <label className="text-slate-500 font-bold block mb-1">الفترة المالية</label>
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
            <label className="text-slate-500 font-bold block mb-1">مركز التكلفة المُرسل (Sender)</label>
            <select
              value={senderCostCenter}
              onChange={(e) => setSenderCostCenter(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-2 py-2 text-xs font-semibold"
            >
              {costCenters.map((cc) => (
                <option key={cc.id} value={cc.code}>
                  {cc.code} - {cc.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-3">
            <label className="text-slate-500 font-bold block mb-1">المبلغ الإجمالي المراد توزيعه (SAR)</label>
            <Input
              type="number"
              value={totalAmount}
              onChange={(e) => handleTotalChange(e.target.value)}
              className="font-mono text-end font-bold text-emerald-700 text-sm"
              required
            />
          </div>
        </div>

        {/* Segments Table */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
          <div className="p-3 bg-slate-100 flex items-center justify-between border-b border-slate-200">
            <h4 className="font-bold text-slate-800">مراكز التكلفة المستلمة وقواعد النسب</h4>
            <Button size="sm" type="button" onClick={addSegment} variant="secondary" className="gap-1 border-slate-300 h-7 text-xs">
              <Plus className="w-3.5 h-3.5" />
              إضافة مركز مستلم
            </Button>
          </div>

          <table className="w-full text-start text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2 px-3">مركز التكلفة المستلم (Receiver)</th>
                <th className="py-2 px-3 w-28 text-center">النسبة المئوية (%)</th>
                <th className="py-2 px-3 w-36 text-end">المبلغ المحمَّل (ر.س)</th>
                <th className="py-2 px-2 text-center w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {segments.map((s, idx) => (
                <tr key={idx}>
                  <td className="py-2 px-3">
                    <select
                      value={s.receiverCostCenter}
                      onChange={(e) => updateSegmentReceiver(idx, e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-semibold"
                    >
                      {costCenters.map((cc) => (
                        <option key={cc.id} value={cc.code}>
                          {cc.code} - {cc.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-3">
                    <Input
                      type="number"
                      step="0.1"
                      value={s.percentage}
                      onChange={(e) => updateSegmentPct(idx, parseFloat(e.target.value) || 0)}
                      className="font-mono text-center font-bold h-8 text-xs"
                      required
                    />
                  </td>
                  <td className="py-2 px-3 text-end font-mono font-bold text-slate-900">
                    {s.allocatedAmount.toLocaleString('en-US')} ر.س
                  </td>
                  <td className="py-2 px-2 text-center">
                    <button type="button" onClick={() => removeSegment(idx)} className="text-slate-400 hover:text-rose-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Validation Bar */}
        <div className="flex items-center justify-between p-3 rounded-xl border font-mono text-xs bg-slate-50">
          <span>
            إجمالي النسب: <strong className={is100Percent ? 'text-emerald-700' : 'text-rose-700'}>{totalPercentage}%</strong>
          </span>
          <span>
            {is100Percent ? '✓ النسب مطابقة تماماً (100%)' : '⚠ يجب أن يكون مجموع النسب 100%'}
          </span>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button variant="secondary" type="button" onClick={onClose} disabled={isSubmitting}>
            إلغاء
          </Button>
          <Button type="submit" disabled={isSubmitting || !is100Percent} className="bg-[#0FA37F] hover:bg-[#0c8a6c] gap-2 font-bold">
            <Layers className="w-4 h-4" />
            <span>{isSubmitting ? 'جاري التوزيع والترحيل...' : 'تشغيل دورة التوزيع وترحيل القيد'}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
};
