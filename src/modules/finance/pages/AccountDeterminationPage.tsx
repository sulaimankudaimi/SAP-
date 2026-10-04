import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { Breadcrumbs } from '../../../components/ui/Breadcrumbs';
import { useToast } from '../../../components/ui/Toast';
import { t } from '../../../i18n/ar';
import { db } from '../../../core/db';
import { AutomaticPostingEngine } from '../services/AutomaticPostingEngine';
import type { AccountDeterminationRule, GLAccount } from '../../../types/models';
import { Sliders, Save, CheckCircle2, RotateCcw } from 'lucide-react';

export const AccountDeterminationPage: React.FC = () => {
  const { showToast } = useToast();
  const [rules, setRules] = useState<AccountDeterminationRule[]>([]);
  const [glAccounts, setGlAccounts] = useState<GLAccount[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    try {
      await AutomaticPostingEngine.initAccountDeterminations();
      const rList = await db.accountDeterminations.toArray();
      const aList = await db.glAccounts.filter((a) => !a.isDeleted).toArray();
      setRules(rList);
      setGlAccounts(aList);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'فشل تحميل قواعد التوجيه المحاسبي', 'error');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAccountChange = (ruleId: string, side: 'debit' | 'credit', accNumber: string) => {
    const acc = glAccounts.find((a) => a.accountNumber === accNumber);
    setRules((prev) =>
      prev.map((r) => {
        if (r.id !== ruleId) return r;
        if (side === 'debit') {
          return {
            ...r,
            debitAccountNumber: accNumber,
            debitAccountName: acc ? acc.name : r.debitAccountName,
          };
        } else {
          return {
            ...r,
            creditAccountNumber: accNumber,
            creditAccountName: acc ? acc.name : r.creditAccountName,
          };
        }
      })
    );
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await db.transaction('rw', db.accountDeterminations, async () => {
        for (const r of rules) {
          await db.accountDeterminations.put(r);
        }
      });
      showToast('تم حفظ وتحديث قواعد التوجيه المحاسبي الآلي بنجاح.', 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'فشل حفظ القواعد', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumbs
            items={[
              { label: t('nav_home'), path: '/' },
              { label: t('nav_finance'), path: '/finance' },
              { label: 'قواعد التوجيه المحاسبي الآلي (OBYC)' },
            ]}
          />
          <h1 className="text-2xl font-black text-[#0B2545] tracking-tight mt-1">
            {t('fi_rules_title')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            تحديد حسابات الأستاذ العام المدينة والدائنة ومفاتيح الترحيل لجميع حركات المستودعات، المشتريات، المبيعات، والأسطول
          </p>
        </div>

        <Button
          onClick={handleSaveAll}
          disabled={isSaving}
          className="bg-[#0FA37F] hover:bg-[#0c8a6c] gap-2 font-bold shadow-sm"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'جاري الحفظ...' : 'حفظ تعديلات التوجيه المحاسبي'}</span>
        </Button>
      </div>

      {/* Rules Table */}
      <Card className="overflow-hidden border border-slate-200">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-800">جدول تحديد الحسابات التلقائي (Account Determination Table)</h3>
            <p className="text-xs text-slate-500">
              يقوم محرك الترحيل الآلي بالرجوع إلى هذه القواعد عند استلام البضائع، الفواتير، الصرف للمراكز، أو السداد البنكي
            </p>
          </div>
          <Badge variant="approved">نشط ومرتبط بالمحرك الآلي</Badge>
        </div>

        <table className="w-full text-xs text-start">
          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3 text-start w-28">مفتاح الحركة</th>
              <th className="py-2.5 px-3 text-start w-72">العملية الإجرائية</th>
              <th className="py-2.5 px-3 text-start">حساب الطرف المدين (Debit GL)</th>
              <th className="py-2.5 px-3 text-start">حساب الطرف الدائن (Credit GL)</th>
              <th className="py-2.5 px-3 text-start">التوصيف المحاسبي</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {rules.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/70">
                <td className="py-3 px-3 font-mono font-bold text-blue-900">
                  <span className="px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg">
                    {r.transactionKey}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <span className="font-bold text-slate-900 block">{r.title}</span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Keys: Dr [{r.postingKeyDebit}] / Cr [{r.postingKeyCredit}]
                  </span>
                </td>
                <td className="py-3 px-3">
                  <select
                    value={r.debitAccountNumber}
                    onChange={(e) => handleAccountChange(r.id, 'debit', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-emerald-500"
                  >
                    {glAccounts.map((acc) => (
                      <option key={acc.id} value={acc.accountNumber}>
                        {acc.accountNumber} - {acc.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-3 px-3">
                  <select
                    value={r.creditAccountNumber}
                    onChange={(e) => handleAccountChange(r.id, 'credit', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-emerald-500"
                  >
                    {glAccounts.map((acc) => (
                      <option key={acc.id} value={acc.accountNumber}>
                        {acc.accountNumber} - {acc.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-3 px-3 text-slate-500 text-[11px]">{r.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};
