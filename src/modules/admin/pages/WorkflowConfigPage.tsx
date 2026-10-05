import React, { useState, useEffect } from 'react';
import {
  GitMerge,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  FileText,
  DollarSign,
  Users,
  Shield,
  ArrowDown,
  Info,
} from 'lucide-react';
import { Breadcrumbs } from '../../../components/ui/Breadcrumbs';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { useToast } from '../../../components/ui/Toast';
import { WorkflowService } from '../services/WorkflowService';
import { SYSTEM_ROLES } from '../../../core/services/RbacService';
import type {
  ApprovalRule,
  ApprovalRuleStep,
  WorkflowDocumentType,
} from '../../../types/models';

interface DocTypeOption {
  type: WorkflowDocumentType;
  label: string;
  sapCode: string;
  description: string;
}

const DOC_TYPES: DocTypeOption[] = [
  {
    type: 'PO',
    label: 'أوامر الشراء (Purchase Orders)',
    sapCode: 'ME21N / ME22N',
    description: 'سلسلة اعتماد أوامر التوريد الصادرة للموردين استناداً للقيمة الإجمالية',
  },
  {
    type: 'PR',
    label: 'طلبات الشراء الداخلية (Purchase Requisitions)',
    sapCode: 'ME51N',
    description: 'اعتماد الاحتياجات الداخلية للمواد وقطع الغيار قبل طرحها للمنافسة',
  },
  {
    type: 'CONTRACT',
    label: 'عقود التوريد الإطارية (Purchasing Contracts)',
    sapCode: 'ME31K',
    description: 'اعتماد العقود السنوية وتوريدات الوقود الاستراتيجية طويلة الأجل',
  },
  {
    type: 'DISPOSAL',
    label: 'استبعاد وتخريد الأصول (Asset Disposals)',
    sapCode: 'ABAVN',
    description: 'اعتماد الاستبعاد والتكهين الفني للمعدات والشاحنات المنتهية إنتاجياً',
  },
  {
    type: 'PAYMENT',
    label: 'أوامر وسندات الصرف المالي (Payment Vouchers)',
    sapCode: 'F110 / FB60',
    description: 'اعتماد المدفوعات والتحويلات البنكية للموردين والمقاولين',
  },
];

const AVAILABLE_ROLES = [
  { code: SYSTEM_ROLES.PROCUREMENT_OFFICER, name: 'مسؤول المشتريات' },
  { code: SYSTEM_ROLES.PROCUREMENT_MANAGER, name: 'مدير المشتريات' },
  { code: SYSTEM_ROLES.WAREHOUSE_OFFICER, name: 'أمين المستودع' },
  { code: SYSTEM_ROLES.ACCOUNTANT, name: 'المحاسب المالي' },
  { code: SYSTEM_ROLES.FINANCE_MANAGER, name: 'المدير المالي (CFO)' },
  { code: SYSTEM_ROLES.ASSET_MANAGER, name: 'مدير الأصول والمعدات' },
  { code: SYSTEM_ROLES.FLEET_MANAGER, name: 'مدير الأسطول والنقل' },
  { code: SYSTEM_ROLES.AUDITOR, name: 'مدقق الالتزام والرقابة' },
  { code: SYSTEM_ROLES.ADMIN, name: 'المدير العام / مدير النظام' },
];

export const WorkflowConfigPage: React.FC = () => {
  const { success, error, info } = useToast();

  const [selectedDocType, setSelectedDocType] = useState<WorkflowDocumentType>('PO');
  const [rules, setRules] = useState<ApprovalRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Modal state for editing/adding a rule
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);
  const [modalDescription, setModalDescription] = useState('');
  const [modalMinAmount, setModalMinAmount] = useState<number>(0);
  const [modalMaxAmount, setModalMaxAmount] = useState<number>(50000);
  const [modalSteps, setModalSteps] = useState<ApprovalRuleStep[]>([]);

  // Load rules for currently selected doc type
  const loadRules = async (docType: WorkflowDocumentType) => {
    setIsLoading(true);
    try {
      const data = await WorkflowService.getRules(docType);
      setRules(data);
      validate(data);
    } catch (err) {
      console.error(err);
      error('خطأ', 'تعذر جلب قواعد سير العمل من قاعدة البيانات.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRules(selectedDocType);
  }, [selectedDocType]);

  const validate = (currentRules: ApprovalRule[]) => {
    const result = WorkflowService.validateRules(currentRules);
    setValidationErrors(result.errors);
    return result.isValid;
  };

  const handleOpenAddModal = () => {
    setEditingRuleIndex(null);
    setModalDescription('');

    // Pre-calculate smart min amount from last rule's max + 0.01
    const lastRule = rules[rules.length - 1];
    const initialMin = lastRule ? Number((lastRule.maxAmount + 0.01).toFixed(2)) : 0;
    const initialMax = lastRule ? initialMin + 100000 : 50000;

    setModalMinAmount(initialMin);
    setModalMaxAmount(initialMax);
    setModalSteps([
      { stepNumber: 1, roleCode: SYSTEM_ROLES.PROCUREMENT_MANAGER, roleName: 'مدير المشتريات' },
    ]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (index: number) => {
    const r = rules[index];
    setEditingRuleIndex(index);
    setModalDescription(r.description || '');
    setModalMinAmount(r.minAmount);
    setModalMaxAmount(r.maxAmount);
    setModalSteps(r.steps ? [...r.steps] : []);
    setIsModalOpen(true);
  };

  const handleSaveModal = () => {
    if (modalMinAmount < 0) {
      error('خطأ في النطاق', 'الحد الأدنى لا يمكن أن يكون سالباً.');
      return;
    }
    if (modalMaxAmount <= modalMinAmount) {
      error('خطأ في النطاق', 'الحد الأقصى يجب أن يكون أكبر تماماً من الحد الأدنى.');
      return;
    }
    if (modalSteps.length === 0) {
      error('خطوات الاعتماد ناقصة', 'يجب تحديد مرحلة اعتماد ومسؤول واحد على الأقل.');
      return;
    }

    const updatedSteps: ApprovalRuleStep[] = modalSteps.map((st, i) => ({
      ...st,
      stepNumber: i + 1,
    }));

    const ruleData: ApprovalRule = {
      id: editingRuleIndex !== null ? rules[editingRuleIndex].id : `rule-custom-${Date.now()}`,
      documentType: selectedDocType,
      minAmount: modalMinAmount,
      maxAmount: modalMaxAmount,
      steps: updatedSteps,
      isActive: true,
      description: modalDescription || `اعتماد من ${modalMinAmount.toLocaleString()} إلى ${modalMaxAmount.toLocaleString()} ريال`,
      createdAt: editingRuleIndex !== null ? rules[editingRuleIndex].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false,
    };

    let updatedList: ApprovalRule[];
    if (editingRuleIndex !== null) {
      updatedList = [...rules];
      updatedList[editingRuleIndex] = ruleData;
    } else {
      updatedList = [...rules, ruleData];
    }

    // Sort ascending by minAmount
    updatedList.sort((a, b) => a.minAmount - b.minAmount);
    setRules(updatedList);
    validate(updatedList);
    setIsModalOpen(false);
  };

  const handleDeleteRule = (index: number) => {
    if (rules.length <= 1) {
      error('لا يمكن الحذف', 'يجب الإبقاء على قاعدة اعتماد واحدة على الأقل لكل مستند.');
      return;
    }
    const updated = rules.filter((_, i) => i !== index);
    setRules(updated);
    validate(updated);
  };

  const handleAddStepToModal = () => {
    const nextNum = modalSteps.length + 1;
    const defaultRole = AVAILABLE_ROLES[Math.min(nextNum, AVAILABLE_ROLES.length - 1)];
    setModalSteps([
      ...modalSteps,
      { stepNumber: nextNum, roleCode: defaultRole.code, roleName: defaultRole.name },
    ]);
  };

  const handleRemoveStepFromModal = (stepIndex: number) => {
    if (modalSteps.length <= 1) {
      error('تنبيه', 'يجب أن تحتوي القاعدة على مرحلة اعتماد واحدة على الأقل.');
      return;
    }
    const filtered = modalSteps.filter((_, i) => i !== stepIndex);
    const renumbered = filtered.map((s, idx) => ({ ...s, stepNumber: idx + 1 }));
    setModalSteps(renumbered);
  };

  const handleStepRoleChange = (stepIndex: number, roleCode: string) => {
    const roleObj = AVAILABLE_ROLES.find((r) => r.code === roleCode);
    const updated = [...modalSteps];
    updated[stepIndex] = {
      ...updated[stepIndex],
      roleCode,
      roleName: roleObj ? roleObj.name : roleCode,
    };
    setModalSteps(updated);
  };

  const handleSaveToDatabase = async () => {
    const isValid = validate(rules);
    if (!isValid) {
      error('فشل التحقق من المسار', 'يرجى تصحيح الفجوات والتداخلات المالية قبل الحفظ.');
      return;
    }

    setIsSaving(true);
    try {
      await WorkflowService.saveRules(selectedDocType, rules);
      success('تم الحفظ بنجاح', `تم حفظ وتفعيل مسارات الاعتماد لنوع المستند [${selectedDocType}].`);
      await loadRules(selectedDocType);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر حفظ القواعد في قاعدة البيانات';
      error('خطأ في الحفظ', msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefaults = async () => {
    if (!window.confirm('هل تود استعادة قواعد الاعتماد القياسية المعتمدة من SAP لنوع هذا المستند؟')) {
      return;
    }
    try {
      // Re-initialize default rules
      const defaultRules = WorkflowService['getDefaultRules']().filter(
        (r) => r.documentType === selectedDocType
      );
      await WorkflowService.saveRules(selectedDocType, defaultRules);
      success('تمت الاستعادة', 'تمت استعادة القواعد المعيارية بنجاح.');
      await loadRules(selectedDocType);
    } catch (err) {
      console.error(err);
      error('خطأ', 'فشلت استعادة القواعد الافتراضية.');
    }
  };

  const currentDocMeta = DOC_TYPES.find((d) => d.type === selectedDocType);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div>
        <Breadcrumbs
          items={[
            { label: 'الرئيسية', path: '/' },
            { label: 'الإدارة والنظام', path: '/admin' },
            { label: 'تهيئة مسارات وقواعد الاعتماد (SWDD)' },
          ]}
        />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-[#0F172A] flex items-center gap-2.5">
              <GitMerge className="w-6 h-6 text-[#0FA37F]" />
              تهيئة مسارات وسلاسل الاعتماد (Workflow Architecture - SWDD)
            </h1>
            <p className="text-xs text-[#64748B] mt-1">
              ضبط الشرائح المالية ومستويات التفويض التتابعي لكل نوع مستند مع فحص تلقائي يمنع أي فجوات (Gaps) أو تداخلات (Overlaps).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleResetToDefaults}>
              <RotateCcw className="w-4 h-4 me-1.5" />
              القيم الافتراضية
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveToDatabase}
              disabled={isSaving || validationErrors.length > 0}
            >
              <Save className="w-4 h-4 me-1.5" />
              {isSaving ? 'جارٍ الحفظ...' : 'حفظ القواعد وتطبيقها'}
            </Button>
          </div>
        </div>
      </div>

      {/* Document Type Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-[#E5EAF2]">
        {DOC_TYPES.map((dt) => {
          const isSelected = selectedDocType === dt.type;
          return (
            <button
              key={dt.type}
              onClick={() => setSelectedDocType(dt.type)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                isSelected
                  ? 'bg-[#0FA37F] text-white shadow-xs'
                  : 'bg-white border border-[#E5EAF2] text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
              }`}
            >
              <FileText className="w-4 h-4" />
              <div className="text-start">
                <div>{dt.label}</div>
                <div className={`text-[10px] font-mono ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                  {dt.sapCode}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Current Doc Type Info Banner */}
      <div className="bg-white border border-[#E5EAF2] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[#0F172A]">{currentDocMeta?.label}</h2>
            <Badge variant="blue">{currentDocMeta?.sapCode}</Badge>
          </div>
          <p className="text-xs text-[#64748B]">{currentDocMeta?.description}</p>
        </div>
        <Button variant="primary" onClick={handleOpenAddModal}>
          <Plus className="w-4 h-4 me-1.5" />
          إضافة شريحة مالية جديدة
        </Button>
      </div>

      {/* Validation Alert (Gaps or Overlaps) */}
      {validationErrors.length > 0 && (
        <div className="bg-red-50 border-s-4 border-red-500 p-4 rounded-xl space-y-2 animate-in fade-in-50">
          <div className="flex items-center gap-2 text-xs font-bold text-red-900">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span>تنبيه فحص سلامة المسار: توجد أخطاء في تكوين الشرائح تمنع اعتماد المستندات!</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-xs text-red-800">
            {validationErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {validationErrors.length === 0 && rules.length > 0 && (
        <div className="bg-emerald-50 border-s-4 border-emerald-500 p-3 rounded-xl flex items-center justify-between text-xs text-emerald-900">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>المسار متصل تماماً: لا توجد أي فجوات مالية أو تداخلات (Zero Gaps & Overlaps).</span>
          </div>
          <Badge variant="green">{rules.length} شرائح محكمة</Badge>
        </div>
      )}

      {/* Rules List Grid */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-[#64748B] bg-white rounded-2xl border border-[#E5EAF2]">
            جارٍ تحميل قواعد الاعتماد...
          </div>
        ) : rules.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#64748B] bg-white rounded-2xl border border-[#E5EAF2] space-y-3">
            <Info className="w-8 h-8 text-slate-400 mx-auto" />
            <p>لا توجد قواعد اعتماد مسجلة لنوع المستند هذا.</p>
            <Button variant="primary" onClick={handleOpenAddModal}>
              <Plus className="w-4 h-4 me-1.5" />
              إنشاء أول شريحة
            </Button>
          </div>
        ) : (
          rules.map((rule, idx) => (
            <Card
              key={rule.id || idx}
              header={
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-xl bg-[#0B2545] text-white flex items-center justify-center font-bold text-xs font-mono">
                      {idx + 1}
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-[#0F172A]">
                        {rule.description || `الشريحة المالية رقم ${idx + 1}`}
                      </h4>
                      <div className="text-[11px] font-mono text-[#0FA37F] font-semibold mt-0.5">
                        من {rule.minAmount.toLocaleString()} ريال إلى{' '}
                        {rule.maxAmount >= 999999999 ? 'ما فوق (بلا حد)' : `${rule.maxAmount.toLocaleString()} ريال`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleOpenEditModal(idx)}>
                      تعديل الشريحة
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDeleteRule(idx)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              }
            >
              <div className="space-y-3">
                <div className="text-xs font-semibold text-[#64748B]">
                  تسلسل خطوات الاعتماد الإلزامية ({rule.steps?.length || 0} مراحل):
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {rule.steps?.map((step) => (
                    <div
                      key={step.stepNumber}
                      className="p-3 bg-[#F4F7FB] border border-[#E5EAF2] rounded-xl space-y-1 relative"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 font-mono">
                          المرحلة {step.stepNumber}
                        </span>
                        <Shield className="w-3.5 h-3.5 text-[#0FA37F]" />
                      </div>
                      <div className="text-xs font-bold text-[#0F172A]">{step.roleName}</div>
                      <div className="text-[10px] font-mono text-[#64748B]">{step.roleCode}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Modal for Add / Edit Rule */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingRuleIndex !== null ? 'تعديل شريحة الاعتماد' : 'إضافة شريحة اعتماد جديدة'}
        size="lg"
      >
        <div className="space-y-4" dir="rtl">
          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">
              وصف الشريحة (Description)
            </label>
            <Input
              value={modalDescription}
              onChange={(e) => setModalDescription(e.target.value)}
              placeholder="مثال: أوامر الشراء حتى 50,000 ريال (اعتماد مدير المشتريات)..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                الحد الأدنى للمبلغ (ريال) <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={modalMinAmount}
                onChange={(e) => setModalMinAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                الحد الأقصى للمبلغ (ريال) <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={modalMaxAmount}
                onChange={(e) => setModalMaxAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Ordered Approver Steps */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#0FA37F]" />
                <span>أدوار ومسؤولو مراحل الاعتماد (بالترتيب التتابعي)</span>
              </label>
              <Button variant="outline" size="sm" onClick={handleAddStepToModal}>
                <Plus className="w-3.5 h-3.5 me-1" />
                إضافة مرحلة تالية
              </Button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {modalSteps.map((step, sIdx) => (
                <div
                  key={sIdx}
                  className="p-3 bg-slate-50 border border-[#E5EAF2] rounded-xl flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-[#0FA37F] text-white font-mono font-bold text-xs flex items-center justify-center">
                      {sIdx + 1}
                    </span>
                    <span className="text-xs font-semibold text-[#0F172A]">المرحلة {sIdx + 1}:</span>
                  </div>

                  <div className="flex-1 max-w-xs">
                    <select
                      value={step.roleCode}
                      onChange={(e) => handleStepRoleChange(sIdx, e.target.value)}
                      className="w-full text-xs py-1.5 px-2.5 rounded-xl border border-[#E5EAF2] bg-white font-medium"
                    >
                      {AVAILABLE_ROLES.map((r) => (
                        <option key={r.code} value={r.code}>
                          {r.name} ({r.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveStepFromModal(sIdx)}
                    disabled={modalSteps.length <= 1}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 disabled:opacity-30 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-[#E5EAF2]">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              إلغاء
            </Button>
            <Button variant="primary" onClick={handleSaveModal}>
              حفظ الشريحة
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
