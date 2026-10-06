import React, { useState, useEffect, useMemo } from 'react';
import { FleetService } from '../services/FleetService';
import { StatCard } from '../../../components/ui/StatCard';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Modal } from '../../../components/ui/Modal';
import { Drawer } from '../../../components/ui/Drawer';
import { useToast } from '../../../components/ui/Toast';
import type { Driver } from '../../../types/models';
import { DiagnosticLogger } from '../../../core/services/DiagnosticLogger';
import { getErrorMessage } from '../../../core/utils';
import {
  Users,
  Search,
  ShieldCheck,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Phone,
  FileCheck,
  Star,
  Truck,
  Eye,
} from 'lucide-react';

type LicenseClass = 'عمومي ثقيل' | 'نقل مواد خطرة (HazMat)' | 'عمومي متوسط' | 'خصوصي';
const VALID_LICENSE_CLASSES: readonly LicenseClass[] = ['نقل مواد خطرة (HazMat)', 'عمومي ثقيل', 'عمومي متوسط', 'خصوصي'];

function parseLicenseClass(val: string): LicenseClass {
  return (VALID_LICENSE_CLASSES as readonly string[]).includes(val)
    ? (val as LicenseClass)
    : 'نقل مواد خطرة (HazMat)';
}

export const DriversListPage: React.FC = () => {
  const { success, error } = useToast();

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');

  // Drawer for driver detail
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Create Driver Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIqama, setNewIqama] = useState('');
  const [newLicenseNo, setNewLicenseNo] = useState('');
  const [newLicenseClass, setNewLicenseClass] = useState<'عمومي ثقيل' | 'نقل مواد خطرة (HazMat)' | 'عمومي متوسط' | 'خصوصي'>('نقل مواد خطرة (HazMat)');
  const [newLicenseExpiry, setNewLicenseExpiry] = useState('2028-12-31');
  const [newMobile, setNewMobile] = useState('0551234567');
  const [newSafetyRating, setNewSafetyRating] = useState(4.8);
  const [newCerts, setNewCerts] = useState('شهادة أرامكو لنقل المواد الخطرة، شهادة الدفاع المدني');

  const loadDrivers = async () => {
    setIsLoading(true);
    try {
      const list = await FleetService.getDrivers();
      setDrivers(list);
    } catch (err) {
      DiagnosticLogger.error('FleetModule', 'Failed to load drivers', err);
      error('خطأ', 'تعذر تحميل بيانات السائقين');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDrivers();
  }, []);

  const filteredDrivers = useMemo(() => {
    return drivers.filter((d) => {
      if (selectedClass !== 'ALL' && d.licenseClass !== selectedClass) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          d.name.toLowerCase().includes(q) ||
          d.code.toLowerCase().includes(q) ||
          d.licenseNumber.toLowerCase().includes(q) ||
          d.iqamaNumber.includes(q)
        );
      }
      return true;
    });
  }, [drivers, selectedClass, searchQuery]);

  const handleCreateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const code = `DRV-${String(drivers.length + 1).padStart(3, '0')}`;
      const certsArray = newCerts
        .split('،')
        .map((c) => c.trim())
        .filter(Boolean);

      await FleetService.createDriver({
        code,
        name: newName,
        iqamaNumber: newIqama,
        licenseNumber: newLicenseNo,
        licenseClass: newLicenseClass,
        licenseExpiry: newLicenseExpiry,
        mobile: newMobile,
        safetyRating: newSafetyRating,
        performanceScore: 92,
        certifications: certsArray.length > 0 ? certsArray : ['أرامكو لنقل المواد الخطرة (HazMat)'],
        status: 'available',
        totalTripsCompleted: 0,
        totalDistanceKm: 0,
      });

      success('تمت الإضافة بنجاح', `تم تسجيل السائق ${newName} بنجاح`);
      setIsCreateModalOpen(false);
      loadDrivers();
    } catch (err: unknown) {
      error('خطأ', getErrorMessage(err));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'on_trip':
        return <Badge variant="in_progress">في رحلة نقل</Badge>;
      case 'available':
        return <Badge variant="approved">متاح للجدولة</Badge>;
      case 'vacation':
      default:
        return <Badge variant="neutral">إجازة سنوية</Badge>;
    }
  };

  return (
    <div className="space-y-6 text-start p-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#E5EAF2]">
        <div>
          <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <Users className="w-6 h-6 text-[#0FA37F]" />
            سجل سائقي أسطول الوقود وتراخيص المواد الخطرة (Drivers & HSE Certifications)
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            إدارة كفاءة السائقين، فئات رخص القيادة المهنية، شهادات أرامكو والدفاع المدني، ومؤشرات السلامة
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={loadDrivers}>
            تحديث
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setIsCreateModalOpen(true)}
          >
            تسجيل سائق جديد
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          label="إجمالي السائقين المسجلين"
          value={drivers.length}
          subtitle="سائقو صهاريج وشاحنات بترولية"
          icon={<Users className="w-5 h-5 text-[#0FA37F]" />}
        />

        <StatCard
          label="مرخصون لنقل المواد الخطرة (HazMat)"
          value={drivers.filter((d) => d.licenseClass?.includes('خطرة')).length}
          subtitle="اعتماد أرامكو والدفاع المدني"
          icon={<ShieldCheck className="w-5 h-5 text-[#2563EB]" />}
        />

        <StatCard
          label="سائقون في رحلات نشطة"
          value={drivers.filter((d) => d.status === 'on_trip').length}
          subtitle="على مسارات التوزيع"
          icon={<Truck className="w-5 h-5 text-[#0FA37F]" />}
        />

        <StatCard
          label="متوسط تقييم السلامة والأمان"
          value="4.7 ★"
          subtitle="معدل خلو الحوادث 99.4%"
          icon={<Star className="w-5 h-5 text-[#F59E0B]" />}
        />
      </div>

      {/* Filters */}
      <div className="p-4 bg-white rounded-2xl border border-[#E5EAF2] shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            placeholder="بحث باسم السائق، الكود، رقم الإقامة، أو رقم الرخصة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            startIcon={<Search className="w-4 h-4 text-[#64748B]" />}
          />

          <Select
            label="فئة رخصة القيادة المهنية:"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            options={[
              { label: 'كافة فئات الرخص (الكل)', value: 'ALL' },
              { label: 'نقل مواد خطرة (HazMat)', value: 'نقل مواد خطرة (HazMat)' },
              { label: 'عمومي ثقيل', value: 'عمومي ثقيل' },
              { label: 'عمومي متوسط', value: 'عمومي متوسط' },
              { label: 'خصوصي', value: 'خصوصي' },
            ]}
          />
        </div>
      </div>

      {/* Drivers Table */}
      <div className="bg-white rounded-2xl border border-[#E5EAF2] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E5EAF2]">
              <tr>
                <th className="p-3 text-start">السائق والكود</th>
                <th className="p-3 text-start">فئة الرخصة</th>
                <th className="p-3 text-center">رقم الإقامة</th>
                <th className="p-3 text-center">انتهاء الرخصة</th>
                <th className="p-3 text-center">الهاتف</th>
                <th className="p-3 text-center">تقييم السلامة</th>
                <th className="p-3 text-center">الرحلات المنفذة</th>
                <th className="p-3 text-center">الحالة</th>
                <th className="p-3 text-center">الملف المهني</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EAF2]">
              {filteredDrivers.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3">
                    <span className="font-bold text-[#0F172A] block">{d.name}</span>
                    <span className="text-[10px] text-[#64748B] font-mono">{d.code}</span>
                  </td>
                  <td className="p-3">
                    <span className="font-semibold text-[#0B2545]">{d.licenseClass || 'عمومي ثقيل'}</span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {d.certifications?.slice(0, 1).map((cert, i) => (
                        <span key={i} className="text-[9px] px-1.5 py-0.2 bg-blue-50 text-blue-700 rounded border border-blue-200">
                          {cert}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 text-center font-mono text-[#64748B]">{d.iqamaNumber}</td>
                  <td className="p-3 text-center font-mono text-[#64748B]">{d.licenseExpiry}</td>
                  <td className="p-3 text-center font-mono" dir="ltr">{d.mobile}</td>
                  <td className="p-3 text-center">
                    <span className="font-bold text-[#0FA37F] flex items-center justify-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-[#0FA37F]" />
                      {d.safetyRating}
                    </span>
                  </td>
                  <td className="p-3 text-center font-mono font-bold text-[#0F172A]">
                    {d.totalTripsCompleted || 0} رحلة
                  </td>
                  <td className="p-3 text-center">
                    {getStatusBadge(d.status)}
                  </td>
                  <td className="p-3 text-center">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Eye className="w-3.5 h-3.5" />}
                      onClick={() => {
                        setSelectedDriver(d);
                        setIsDrawerOpen(true);
                      }}
                    >
                      استعراض
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Driver Detail Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={selectedDriver ? `الملف المهني للسائق [${selectedDriver.name}]` : 'ملف السائق'}
        size="md"
      >
        {selectedDriver && (
          <div className="space-y-6 text-start p-2" dir="rtl">
            <div className="p-4 bg-[#F8FAFC] rounded-2xl border border-[#E5EAF2] flex items-center justify-between">
              <div>
                <span className="text-base font-bold text-[#0F172A] block">{selectedDriver.name}</span>
                <span className="text-xs text-[#64748B] font-mono">الكود: {selectedDriver.code}</span>
              </div>
              {getStatusBadge(selectedDriver.status)}
            </div>

            {/* Performance Card */}
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <span className="text-[11px] text-[#0FA37F]">مؤشر الأداء والالتزام (Score):</span>
                <div className="text-2xl font-bold font-mono text-[#0FA37F] mt-1">
                  {selectedDriver.performanceScore || 95} / 100
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <span className="text-[11px] text-[#2563EB]">إجمالي المسافات المقطوعة:</span>
                <div className="text-2xl font-bold font-mono text-[#2563EB] mt-1">
                  {(selectedDriver.totalDistanceKm || 14500).toLocaleString()} كم
                </div>
              </div>
            </div>

            {/* Certifications List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#0FA37F]" />
                شهادات السلامة المهنية المعتمدة (HSE Certifications):
              </h4>
              <div className="space-y-2">
                {(selectedDriver.certifications || [
                  'شهادة أرامكو السعودية لنقل المواد البترولية والخطرة (HazMat Driver)',
                  'شهادة القيادة الوقائية المتقدمة (Defensive Driving Certification)',
                  'شهادة السلامة ومكافحة حرائق الصهاريج من الدفاع المدني',
                ]).map((cert, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white border border-[#E5EAF2] rounded-xl flex items-center gap-2.5 text-xs"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#0FA37F] shrink-0" />
                    <span className="font-semibold text-[#0F172A]">{cert}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* License details */}
            <div className="p-4 bg-white border border-[#E5EAF2] rounded-xl space-y-2 text-xs">
              <h4 className="font-bold text-[#0F172A]">بيانات رخصة القيادة المهنية:</h4>
              <div className="flex justify-between py-1 border-b border-[#F4F7FB]">
                <span className="text-[#64748B]">رقم الرخصة:</span>
                <span className="font-mono font-bold text-[#0F172A]">{selectedDriver.licenseNumber}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#F4F7FB]">
                <span className="text-[#64748B]">فئة الرخصة:</span>
                <span className="font-bold text-[#0F172A]">{selectedDriver.licenseClass}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#64748B]">تاريخ انتهاء الصلاحية:</span>
                <span className="font-mono font-bold text-[#0F172A]">{selectedDriver.licenseExpiry}</span>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Create Driver Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="تسجيل سائق صهريج / شاحنة جديد"
        size="md"
      >
        <form onSubmit={handleCreateDriver} className="space-y-4 text-start" dir="rtl">
          <Input
            label="اسم السائق الكامل:"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="مثال: صالح بن حمد المري"
            required
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="رقم الإقامة / الهوية الوطنية:"
              value={newIqama}
              onChange={(e) => setNewIqama(e.target.value)}
              placeholder="234XXXXXXXX"
              required
            />
            <Input
              label="رقم رخصة القيادة:"
              value={newLicenseNo}
              onChange={(e) => setNewLicenseNo(e.target.value)}
              placeholder="SA-DL-XXXXX"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="فئة رخصة القيادة:"
              value={newLicenseClass}
              onChange={(e) => setNewLicenseClass(parseLicenseClass(e.target.value))}
              options={[
                { label: 'نقل مواد خطرة (HazMat)', value: 'نقل مواد خطرة (HazMat)' },
                { label: 'عمومي ثقيل', value: 'عمومي ثقيل' },
                { label: 'عمومي متوسط', value: 'عمومي متوسط' },
                { label: 'خصوصي', value: 'خصوصي' },
              ]}
            />
            <Input
              label="تاريخ انتهاء الرخصة:"
              type="date"
              value={newLicenseExpiry}
              onChange={(e) => setNewLicenseExpiry(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="رقم الجوال:"
              value={newMobile}
              onChange={(e) => setNewMobile(e.target.value)}
              required
            />
            <Input
              label="تقييم السلامة المبدئي (من 5):"
              type="number"
              step="0.1"
              min="1"
              max="5"
              value={newSafetyRating}
              onChange={(e) => setNewSafetyRating(parseFloat(e.target.value) || 5)}
              required
            />
          </div>

          <Input
            label="شهادات السلامة المهنية (افصل بينها بفاصلة):"
            value={newCerts}
            onChange={(e) => setNewCerts(e.target.value)}
            placeholder="أرامكو لنقل المواد الخطرة، الدفاع المدني، OSHA"
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-[#E5EAF2]">
            <Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary" icon={<CheckCircle2 className="w-4 h-4" />}>
              حفظ واعتماد السائق
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
