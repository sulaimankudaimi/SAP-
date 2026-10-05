import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { useToast } from '../ui/Toast';
import { db } from '../../core/db';
import type { Material, Vendor, CostCenter, Plant, GLAccount } from '../../types/models';
import { Search, Copy, Check, Package, Users, Building, MapPin, BookOpen } from 'lucide-react';

interface ValueHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: 'materials' | 'vendors' | 'costCenters' | 'plants' | 'glAccounts';
  onSelect?: (code: string) => void;
}

export const ValueHelpModal: React.FC<ValueHelpModalProps> = ({
  isOpen,
  onClose,
  initialCategory = 'materials',
  onSelect,
}) => {
  const { success } = useToast();
  const [activeTab, setActiveTab] = useState<'materials' | 'vendors' | 'costCenters' | 'plants' | 'glAccounts'>(
    initialCategory
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Data states
  const [materials, setMaterials] = useState<Material[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [glAccounts, setGlAccounts] = useState<GLAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
      setActiveTab(initialCategory);
      setSearchQuery('');
    }
  }, [isOpen, initialCategory]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [mats, vends, ccs, plts, gls] = await Promise.all([
        db.materials.filter((m) => !m.isDeleted).toArray(),
        db.vendors.filter((v) => !v.isDeleted).toArray(),
        db.costCenters.filter((c) => !c.isDeleted).toArray(),
        db.plants.filter((p) => !p.isDeleted).toArray(),
        db.glAccounts.filter((g) => !g.isDeleted).toArray(),
      ]);
      setMaterials(mats);
      setVendors(vends);
      setCostCenters(ccs);
      setPlants(plts);
      setGlAccounts(gls);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (code: string, name: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    success('تم نسخ الرمز', `تم نسخ الكود [${code} - ${name}] إلى الحافظة.`);
    if (onSelect) {
      onSelect(code);
    }
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Filtered lists
  const filteredMaterials = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return materials;
    return materials.filter(
      (m) =>
        m.materialCode.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        m.groupCode?.toLowerCase().includes(q)
    );
  }, [materials, searchQuery]);

  const filteredVendors = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return vendors;
    return vendors.filter(
      (v) =>
        v.vendorCode.toLowerCase().includes(q) ||
        v.name.toLowerCase().includes(q) ||
        v.category?.toLowerCase().includes(q)
    );
  }, [vendors, searchQuery]);

  const filteredCostCenters = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return costCenters;
    return costCenters.filter(
      (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    );
  }, [costCenters, searchQuery]);

  const filteredPlants = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return plants;
    return plants.filter(
      (p) => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.city?.toLowerCase().includes(q)
    );
  }, [plants, searchQuery]);

  const filteredGlAccounts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return glAccounts;
    return glAccounts.filter(
      (g) => g.accountNumber.toLowerCase().includes(q) || g.name.toLowerCase().includes(q)
    );
  }, [glAccounts, searchQuery]);

  const tabs = [
    { id: 'materials', label: 'الأصناف والمواد', count: materials.length, icon: Package },
    { id: 'vendors', label: 'الموردين', count: vendors.length, icon: Users },
    { id: 'costCenters', label: 'مراكز التكلفة', count: costCenters.length, icon: Building },
    { id: 'plants', label: 'الفروع والمحطات', count: plants.length, icon: MapPin },
    { id: 'glAccounts', label: 'حسابات الأستاذ', count: glAccounts.length, icon: BookOpen },
  ] as const;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="مساعد القيم والبحث السريع (SAP Value Help - F4)"
      size="lg"
    >
      <div className="space-y-4" dir="rtl">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[#E5EAF2]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSearchQuery('');
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#0FA37F] text-white shadow-xs'
                    : 'bg-[#F4F7FB] text-[#64748B] hover:text-[#0F172A] hover:bg-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    active ? 'bg-white/25 text-white' : 'bg-[#E5EAF2] text-[#64748B]'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Input
            placeholder={`بحث سريع في ${tabs.find((t) => t.id === activeTab)?.label}... (اضغط للنسخ)`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            startIcon={<Search className="w-4 h-4 text-[#64748B]" />}
            autoFocus
          />
        </div>

        {/* Results Container */}
        <div className="max-h-80 overflow-y-auto rounded-xl border border-[#E5EAF2] bg-white divide-y divide-[#E5EAF2]">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-[#64748B]">جارٍ تحميل البيانات...</div>
          ) : activeTab === 'materials' ? (
            filteredMaterials.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#64748B]">لا توجد أصناف مطابقة</div>
            ) : (
              filteredMaterials.map((m) => (
                <div
                  key={m.id}
                  onClick={() => handleCopy(m.materialCode, m.name)}
                  className="p-3 hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer group"
                >
                  <div className="space-y-0.5 text-start">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-[#0B2545]">{m.materialCode}</span>
                      <Badge variant="blue">{m.groupCode || 'GRP'}</Badge>
                      {m.abcClass && <Badge variant="neutral">فئة {m.abcClass}</Badge>}
                    </div>
                    <p className="text-xs text-[#0F172A] font-semibold">{m.name}</p>
                    <p className="text-[11px] text-[#64748B]">
                      الوحدة: {m.baseUnit} | السعر المعياري: {m.standardPrice?.toLocaleString()} ر.س
                    </p>
                  </div>
                  <button
                    type="button"
                    className="p-1.5 rounded-lg border border-[#E5EAF2] group-hover:border-[#0FA37F] group-hover:text-[#0FA37F] text-[#64748B] transition-colors"
                  >
                    {copiedCode === m.materialCode ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ))
            )
          ) : activeTab === 'vendors' ? (
            filteredVendors.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#64748B]">لا يوجد موردين مطابقين</div>
            ) : (
              filteredVendors.map((v) => (
                <div
                  key={v.id}
                  onClick={() => handleCopy(v.vendorCode, v.name)}
                  className="p-3 hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer group"
                >
                  <div className="space-y-0.5 text-start">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-[#0B2545]">{v.vendorCode}</span>
                      <Badge variant="emerald">{v.category || 'مورد عام'}</Badge>
                    </div>
                    <p className="text-xs text-[#0F172A] font-semibold">{v.name}</p>
                    <p className="text-[11px] text-[#64748B]">
                      سجل تجاري: {v.commercialRecord || '—'} | هاتف: {v.phone || '—'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="p-1.5 rounded-lg border border-[#E5EAF2] group-hover:border-[#0FA37F] group-hover:text-[#0FA37F] text-[#64748B] transition-colors"
                  >
                    {copiedCode === v.vendorCode ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ))
            )
          ) : activeTab === 'costCenters' ? (
            filteredCostCenters.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#64748B]">لا توجد مراكز تكلفة مطابقة</div>
            ) : (
              filteredCostCenters.map((c) => (
                <div
                  key={c.id}
                  onClick={() => handleCopy(c.code, c.name)}
                  className="p-3 hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer group"
                >
                  <div className="space-y-0.5 text-start">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-[#0B2545]">{c.code}</span>
                      <Badge variant="amber">مركز تكلفة</Badge>
                    </div>
                    <p className="text-xs text-[#0F172A] font-semibold">{c.name}</p>
                    <p className="text-[11px] text-[#64748B]">المسؤول: {c.manager || 'الإدارة المالية'}</p>
                  </div>
                  <button
                    type="button"
                    className="p-1.5 rounded-lg border border-[#E5EAF2] group-hover:border-[#0FA37F] group-hover:text-[#0FA37F] text-[#64748B] transition-colors"
                  >
                    {copiedCode === c.code ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ))
            ) : activeTab === 'plants' ? (
            filteredPlants.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#64748B]">لا توجد محطات مطابقة</div>
            ) : (
              filteredPlants.map((p) => (
                <div
                  key={p.id}
                  onClick={() => handleCopy(p.code, p.name)}
                  className="p-3 hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer group"
                >
                  <div className="space-y-0.5 text-start">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-[#0B2545]">{p.code}</span>
                      <Badge variant="blue">محطة / فرع</Badge>
                    </div>
                    <p className="text-xs text-[#0F172A] font-semibold">{p.name}</p>
                    <p className="text-[11px] text-[#64748B]">المدينة: {p.city || '—'}</p>
                  </div>
                  <button
                    type="button"
                    className="p-1.5 rounded-lg border border-[#E5EAF2] group-hover:border-[#0FA37F] group-hover:text-[#0FA37F] text-[#64748B] transition-colors"
                  >
                    {copiedCode === p.code ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ))
            ) : (
            filteredGlAccounts.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#64748B]">لا توجد حسابات أستاذ مطابقة</div>
            ) : (
              filteredGlAccounts.map((g) => (
                <div
                  key={g.id}
                  onClick={() => handleCopy(g.accountNumber, g.name)}
                  className="p-3 hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer group"
                >
                  <div className="space-y-0.5 text-start">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-[#0B2545]">{g.accountNumber}</span>
                      <Badge variant="neutral">{g.category || 'GL'}</Badge>
                    </div>
                    <p className="text-xs text-[#0F172A] font-semibold">{g.name}</p>
                  </div>
                  <button
                    type="button"
                    className="p-1.5 rounded-lg border border-[#E5EAF2] group-hover:border-[#0FA37F] group-hover:text-[#0FA37F] text-[#64748B] transition-colors"
                  >
                    {copiedCode === g.accountNumber ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ))
            )
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-[#64748B] pt-2 border-t border-[#E5EAF2]">
          <span>اضغط على أي عنصر لنسخ رمزه تلقائياً للاستخدام في الحقول والشاشات.</span>
          <kbd className="px-2 py-0.5 bg-[#F4F7FB] border border-[#E5EAF2] rounded font-mono text-[10px]">
            F4
          </kbd>
        </div>
      </div>
    </Modal>
  );
};
