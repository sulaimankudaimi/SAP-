import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useToast } from '../../../components/ui/Toast';
import { db } from '../../../core/db';
import { BudgetService } from '../services/BudgetService';
import type { CostCenter } from '../../../types/models';
import { CheckCircle2, DollarSign } from 'lucide-react';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialCostCenter?: string;
  initialAmount?: number;
}

export const BudgetModal: React.FC<BudgetModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialCostCenter,
  initialAmount,
}) => {
  const { showToast } = useToast();
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [costCenter, setCostCenter] = useState(initialCostCenter || 'CC-1001');
  const [fiscalYear, setFiscalYear] = useState('2026');
  const [allocatedAmount, setAllocatedAmount] = useState(
    initialAmount ? initialAmount.toString() : '500000'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      const data = await db.costCenters.filter((c) => !c.isDeleted).toArray();
      setCostCenters(data);
      if (initialCostCenter) {
        setCostCenter(initialCostCenter);
      }
    }
    if (isOpen) {
      loadData();
    }
  }, [isOpen, initialCostCenter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(allocatedAmount);
    if (!amount || amount <= 0) {
      showToast('يرجى إدخال مبلغ ميزانية تقديرية صحيح.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      await BudgetService.saveBudget(costCenter, fiscalYear, amount, 'usr-admin-1');
      showToast('تم حفظ واعتماد الميزانية التقديرية بنجاح.', 'success');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'فشل حفظ الميزانية', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="اعتماد وتخصيص ميزانية تقديرية لمركز تكلفة (SAP CO-OM Budgeting)"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-800">
        <div className="space-y-3">
          <div>
            <label className="text-slate-600 font-bold block mb-1">مركز التكلفة *</label>
            <select
              value={costCenter}
              onChange={(e) => setCostCenter(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
              required
            >
              {costCenters.map((cc) => (
                <option key={cc.id} value={cc.code}>
                  {cc.code} - {cc.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-600 font-bold block mb-1">السنة المالية *</label>
              <Input
                value={fiscalYear}
                onChange={(e) => setFiscalYear(e.target.value)}
                className="font-mono"
                required
              />
            </div>
            <div>
              <label className="text-slate-600 font-bold block mb-1">المبلغ المعتمد (ر.س) *</label>
              <Input
                type="number"
                step="1000"
                value={allocatedAmount}
                onChange={(e) => setAllocatedAmount(e.target.value)}
                className="font-mono text-end font-bold text-emerald-700"
                required
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button variant="secondary" type="button" onClick={onClose} disabled={isSubmitting}>
            إلغاء
          </Button>
          <Button type="submit" disabled={isSubmitting} className="bg-[#0FA37F] hover:bg-[#0c8a6c] gap-2 font-bold">
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSubmitting ? 'جاري الحفظ...' : 'اعتماد الميزانية'}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
};
