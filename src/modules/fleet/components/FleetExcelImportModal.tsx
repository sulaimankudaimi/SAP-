import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { useToast } from '../../../components/ui/Toast';
import { FleetService } from '../services/FleetService';
import { DiagnosticLogger } from '../../../core/services/DiagnosticLogger';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Upload,
  RefreshCw,
  Truck,
  Users,
  Play,
  Check,
  XCircle,
  FileText,
} from 'lucide-react';
import type { Vehicle, Driver, VehicleType } from '../../../types/models';

interface FleetExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialMode?: 'vehicles' | 'drivers';
}

interface ValidationError {
  rowNumber: number;
  identifier: string;
  field: string;
  value: string;
  reason: string;
}

interface ParsedVehicleRow {
  code: string;
  plateNumber: string;
  vin: string;
  type: VehicleType;
  fuelType: 'Diesel' | 'Gasoline95' | 'Gasoline91';
  capacityLiters: number;
  makeModel: string;
  year: number;
  currentOdometer: number;
  plantCode: string;
  insuranceExpiry: string;
  registrationExpiry: string;
}

interface ParsedDriverRow {
  code: string;
  name: string;
  nationalId: string;
  licenseNumber: string;
  licenseClass: 'عمومي ثقيل' | 'نقل مواد خطرة (HazMat)' | 'عمومي متوسط' | 'خصوصي';
  licenseExpiry: string;
  mobile: string;
  assignedPlant: string;
}

export const FleetExcelImportModal: React.FC<FleetExcelImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'vehicles',
}) => {
  const { success, error } = useToast();

  const [activeTab, setActiveTab] = useState<'vehicles' | 'drivers'>(initialMode);
  const [inputText, setInputText] = useState('');
  const [isDryRunDone, setIsDryRunDone] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Validation results
  const [validVehicles, setValidVehicles] = useState<ParsedVehicleRow[]>([]);
  const [validDrivers, setValidDrivers] = useState<ParsedDriverRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [totalParsedRows, setTotalParsedRows] = useState(0);

  // Reset state on open/tab change
  const handleTabChange = (tab: 'vehicles' | 'drivers') => {
    setActiveTab(tab);
    setInputText('');
    setIsDryRunDone(false);
    setValidationErrors([]);
    setValidVehicles([]);
    setValidDrivers([]);
    setTotalParsedRows(0);
  };

  // Sample data templates for quick verification
  const loadSampleData = () => {
    if (activeTab === 'vehicles') {
      setInputText(
        `كود_الشاحنة,رقم_اللوحة,رقم_الهيكل,نوع_المركبة,نوع_الوقود,السعة_لتر,الصانع_والموديل,السنة,العداد_كم,المحطة,انتهاء_التأمين,انتهاء_الاستمارة\n` +
          `TNK-801,أ ب ج 8801,SA-VIN-99881122,Tanker,Diesel,38000,مرسيدس أكتروس Actros 3340,2024,42000,1100,2027-08-15,2027-10-30\n` +
          `TNK-802,د هـ و 8802,SA-VIN-99881123,Tanker,Diesel,36000,فولفو FH 460 صهريج وقود,2023,89000,1200,2027-05-20,2027-09-15\n` +
          `TRK-803,ز ح ط 8803,SA-VIN-99881124,HeavyTruck,Diesel,25000,مان MAN TGS شاحنة ثقيلة,2024,31000,1300,2027-11-10,2028-01-25\n` +
          `ERR-804,,SA-VIN-99881125,InvalidType,Diesel,-500,شاحنة عشوائية,2020,12000,1100,2024-01-01,2025-01-01`
      );
    } else {
      setInputText(
        `كود_السائق,الاسم_الكامل,رقم_الهوية,رقم_الرخصة,فئة_الرخصة,انتهاء_الرخصة,رقم_الجوال,المحطة\n` +
          `DRV-701,خالد بن منصور العتيبي,1089274612,DL-994401,نقل مواد خطرة (HazMat),2028-06-30,0551122334,1100\n` +
          `DRV-702,ماجد سالم الدوسري,1078443918,DL-994402,عمومي ثقيل,2027-11-15,0552233445,1200\n` +
          `DRV-703,فهد ناصر القحطاني,1099384726,DL-994403,نقل مواد خطرة (HazMat),2028-09-20,0553344556,1300\n` +
          `ERR-704,سائق بدون رخصة,,DL-994404,عمومي ثقيل,2023-01-01,1234,1100`
      );
    }
    setIsDryRunDone(false);
  };

  // Dry-Run Validation Execution
  const handleDryRun = async () => {
    if (!inputText.trim()) {
      error('تنبيه', 'يرجى لصق بيانات CSV أو إدخال أسطر الجدول أولاً');
      return;
    }

    const lines = inputText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      error('تنبيه', 'الملف أو النص المدخل فارغ');
      return;
    }

    // Skip header line if detected
    const firstLine = lines[0];
    const hasHeader =
      firstLine.includes('كود') ||
      firstLine.includes('code') ||
      firstLine.includes('plate') ||
      firstLine.includes('اللوحة');

    const dataLines = hasHeader ? lines.slice(1) : lines;
    setTotalParsedRows(dataLines.length);

    const errors: ValidationError[] = [];

    if (activeTab === 'vehicles') {
      const existingVehicles = await FleetService.getVehicles();
      const existingCodes = new Set(existingVehicles.map((v) => v.code.toUpperCase()));
      const existingPlates = new Set(existingVehicles.map((v) => v.plateNumber.toUpperCase()));

      const parsed: ParsedVehicleRow[] = [];
      const seenFileCodes = new Set<string>();
      const seenFilePlates = new Set<string>();

      dataLines.forEach((line, idx) => {
        const rowNumber = hasHeader ? idx + 2 : idx + 1;
        // Split by comma or tab
        const cols = line.split(/[,\t]/).map((c) => c.trim());

        if (cols.length < 5) {
          errors.push({
            rowNumber,
            identifier: cols[0] || `سطر ${rowNumber}`,
            field: 'الصفوف',
            value: line,
            reason: 'عدد الأعمدة غير مكتمل (يجب توفير 5 أعمدة على الأقل)',
          });
          return;
        }

        const code = cols[0] || `TNK-IMP-${rowNumber}`;
        const plateNumber = cols[1];
        const vin = cols[2] || `VIN-IMP-${rowNumber}`;
        const rawType = cols[3] || 'Tanker';
        const rawFuel = cols[4] || 'Diesel';
        const capacityLiters = parseFloat(cols[5]) || 36000;
        const makeModel = cols[6] || 'مرسيدس أكتروس صهريج';
        const year = parseInt(cols[7]) || 2024;
        const currentOdometer = parseFloat(cols[8]) || 0;
        const plantCode = cols[9] || '1100';
        const insuranceExpiry = cols[10] || '2027-12-31';
        const registrationExpiry = cols[11] || '2027-12-31';

        // Validations
        if (!plateNumber) {
          errors.push({
            rowNumber,
            identifier: code,
            field: 'رقم اللوحة',
            value: '',
            reason: 'رقم اللوحة حقل إجباري لا يمكن تركه فارغاً',
          });
          return;
        }

        if (existingPlates.has(plateNumber.toUpperCase()) || seenFilePlates.has(plateNumber.toUpperCase())) {
          errors.push({
            rowNumber,
            identifier: code,
            field: 'رقم اللوحة',
            value: plateNumber,
            reason: 'رقم اللوحة مكرر ومسجل مسبقاً في النظام أو بالملف',
          });
          return;
        }

        if (existingCodes.has(code.toUpperCase()) || seenFileCodes.has(code.toUpperCase())) {
          errors.push({
            rowNumber,
            identifier: code,
            field: 'كود الشاحنة',
            value: code,
            reason: 'كود الشاحنة مكرر ومسجل مسبقاً في النظام',
          });
          return;
        }

        const validTypes: VehicleType[] = ['Tanker', 'HeavyTruck', 'LightTruck', 'Crane', 'Trailer'];
        if (!validTypes.includes(rawType as VehicleType)) {
          errors.push({
            rowNumber,
            identifier: code,
            field: 'نوع المركبة',
            value: rawType,
            reason: `نوع المركبة غير معتمد (المسموح: ${validTypes.join(', ')})`,
          });
          return;
        }

        if (capacityLiters <= 0) {
          errors.push({
            rowNumber,
            identifier: code,
            field: 'السعة اللترية',
            value: String(capacityLiters),
            reason: 'سعة الحمولة أو الخزان يجب أن تكون رقماً موجباً أكبر من الصفر',
          });
          return;
        }

        if (currentOdometer < 0) {
          errors.push({
            rowNumber,
            identifier: code,
            field: 'قراءة العداد',
            value: String(currentOdometer),
            reason: 'قراءة العداد لا يمكن أن تكون قيمة سالبة',
          });
          return;
        }

        seenFileCodes.add(code.toUpperCase());
        seenFilePlates.add(plateNumber.toUpperCase());

        parsed.push({
          code,
          plateNumber,
          vin,
          type: rawType as VehicleType,
          fuelType: (['Diesel', 'Gasoline95', 'Gasoline91'].includes(rawFuel) ? rawFuel : 'Diesel') as 'Diesel' | 'Gasoline95' | 'Gasoline91',
          capacityLiters,
          makeModel,
          year,
          currentOdometer,
          plantCode,
          insuranceExpiry,
          registrationExpiry,
        });
      });

      setValidVehicles(parsed);
      setValidationErrors(errors);
    } else {
      // Drivers Import Validation
      const existingDrivers = await FleetService.getDrivers();
      const existingCodes = new Set(existingDrivers.map((d) => d.code.toUpperCase()));
      const existingIqamas = new Set(existingDrivers.map((d) => d.iqamaNumber));

      const parsed: ParsedDriverRow[] = [];
      const seenFileCodes = new Set<string>();
      const seenFileIqamas = new Set<string>();

      dataLines.forEach((line, idx) => {
        const rowNumber = hasHeader ? idx + 2 : idx + 1;
        const cols = line.split(/[,\t]/).map((c) => c.trim());

        if (cols.length < 4) {
          errors.push({
            rowNumber,
            identifier: cols[0] || `سطر ${rowNumber}`,
            field: 'الصفوف',
            value: line,
            reason: 'بيانات السائق غير مكتملة الأعمدة',
          });
          return;
        }

        const code = cols[0] || `DRV-IMP-${rowNumber}`;
        const name = cols[1];
        const nationalId = cols[2];
        const licenseNumber = cols[3] || `DL-${rowNumber}`;
        const licenseClass = (cols[4] || 'نقل مواد خطرة (HazMat)') as ParsedDriverRow['licenseClass'];
        const licenseExpiry = cols[5] || '2028-12-31';
        const mobile = cols[6] || '0550000000';
        const assignedPlant = cols[7] || '1100';

        if (!name) {
          errors.push({
            rowNumber,
            identifier: code,
            field: 'اسم السائق',
            value: '',
            reason: 'اسم السائق حقل إجباري لا يمكن تركه فارغاً',
          });
          return;
        }

        if (!nationalId || nationalId.length < 10) {
          errors.push({
            rowNumber,
            identifier: code,
            field: 'رقم الهوية / الإقامة',
            value: nationalId || '',
            reason: 'رقم الهوية الوطنية أو الإقامة يجب ألا يقل عن 10 أرقام',
          });
          return;
        }

        if (existingIqamas.has(nationalId) || seenFileIqamas.has(nationalId)) {
          errors.push({
            rowNumber,
            identifier: code,
            field: 'رقم الهوية / الإقامة',
            value: nationalId,
            reason: 'رقم الهوية مسجل مسبقاً في النظام لسائق آخر',
          });
          return;
        }

        if (existingCodes.has(code.toUpperCase()) || seenFileCodes.has(code.toUpperCase())) {
          errors.push({
            rowNumber,
            identifier: code,
            field: 'كود السائق',
            value: code,
            reason: 'كود السائق مسجل مسبقاً في النظام',
          });
          return;
        }

        if (licenseExpiry && new Date(licenseExpiry) < new Date()) {
          errors.push({
            rowNumber,
            identifier: code,
            field: 'تاريخ انتهاء الرخصة',
            value: licenseExpiry,
            reason: 'رخصة القيادة منتهية الصلاحية ولا يمكن تسجيل سائق برخصة منتهية',
          });
          return;
        }

        seenFileCodes.add(code.toUpperCase());
        seenFileIqamas.add(nationalId);

        parsed.push({
          code,
          name,
          nationalId,
          licenseNumber,
          licenseClass,
          licenseExpiry,
          mobile,
          assignedPlant,
        });
      });

      setValidDrivers(parsed);
      setValidationErrors(errors);
    }

    setIsDryRunDone(true);
  };

  // Commit Import to Database
  const handleCommitImport = async () => {
    setIsImporting(true);
    try {
      if (activeTab === 'vehicles') {
        for (const v of validVehicles) {
          await FleetService.createVehicle({
            code: v.code,
            plateNumber: v.plateNumber,
            vin: v.vin,
            type: v.type,
            fuelType: v.fuelType,
            capacityLiters: v.capacityLiters,
            makeModel: v.makeModel,
            year: v.year,
            currentOdometer: v.currentOdometer,
            plantCode: v.plantCode,
            status: 'available',
            insuranceExpiry: v.insuranceExpiry,
            registrationExpiry: v.registrationExpiry,
          });
        }
        success('تم الاستيراد بنجاح', `تم استيراد ${validVehicles.length} شاحنة بنجاح في قاعدة البيانات`);
      } else {
        for (const d of validDrivers) {
          await FleetService.createDriver({
            code: d.code,
            name: d.name,
            iqamaNumber: d.nationalId,
            licenseNumber: d.licenseNumber,
            licenseClass: d.licenseClass,
            licenseExpiry: d.licenseExpiry,
            mobile: d.mobile,
            assignedPlant: d.assignedPlant,
            status: 'available',
            safetyRating: 4.8,
            certifications: ['شهادة السلامة لنقل المواد الخطرة'],
          });
        }
        success('تم الاستيراد بنجاح', `تم استيراد ${validDrivers.length} سائق بنجاح في قاعدة البيانات`);
      }

      onSuccess();
      onClose();
    } catch (err) {
      DiagnosticLogger.error('FleetExcelImportModal', 'Import commit error', err);
      error('فشل الاستيراد', err instanceof Error ? err.message : 'تعذر إتمام عملية الاستيراد');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="استيراد البيانات المجمعة من إكسل (Bulk Excel / CSV Import)"
      size="xl"
    >
      <div className="space-y-5 text-start select-none" dir="rtl">
        {/* Module Tab Selector */}
        <div className="flex border-b border-[#E5EAF2]">
          <button
            type="button"
            onClick={() => handleTabChange('vehicles')}
            className={`px-5 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'vehicles'
                ? 'border-[#0FA37F] text-[#0FA37F]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Truck className="w-4 h-4" />
            استيراد شاحنات ومركبات الأسطول
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('drivers')}
            className={`px-5 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'drivers'
                ? 'border-[#0FA37F] text-[#0FA37F]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Users className="w-4 h-4" />
            استيراد السائقين المعتمدين
          </button>
        </div>

        {/* Input instructions and template loader */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
          <div>
            <span className="font-bold text-[#0B2545] block">
              {activeTab === 'vehicles'
                ? 'الأعمدة المطلوبة: كود الشاحنة، اللوحة، الهيكل، النوع، الوقود، السعة، الموديل، السنة، العداد، المحطة'
                : 'الأعمدة المطلوبة: كود السائق، الاسم، الهوية، رقم الرخصة، الفئة، انتهاء الرخصة، الجوال، المحطة'}
            </span>
            <span className="text-[11px] text-[#64748B]">
              الصق البيانات مفصولة بفواصل (CSV) أو مسافات جدولة من ملف إكسل مباشرة.
            </span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            icon={<FileSpreadsheet className="w-4 h-4 text-[#0FA37F]" />}
            onClick={loadSampleData}
          >
            تعبئة نموذج تجريبي جاهز
          </Button>
        </div>

        {/* Data Input Area */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-[#0F172A] block">
            محتوى بيانات الملف (الصق هنا):
          </label>
          <textarea
            rows={7}
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              setIsDryRunDone(false);
            }}
            placeholder={
              activeTab === 'vehicles'
                ? 'TNK-801,أ ب ج 8801,VIN123,Tanker,Diesel,38000,مرسيدس أكتروس,2024,45000,1100,2027-08-15,2027-10-30'
                : 'DRV-701,خالد بن منصور العتيبي,1089274612,DL-994401,نقل مواد خطرة (HazMat),2028-06-30,0551122334,1100'
            }
            className="w-full font-mono text-xs p-3 rounded-xl border border-[#E5EAF2] focus:outline-none focus:ring-2 focus:ring-[#0FA37F] bg-white resize-none"
            dir="ltr"
          />
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="primary"
            size="sm"
            icon={<Play className="w-4 h-4" />}
            onClick={handleDryRun}
          >
            بدء الفحص المبدئي (Dry-Run Validation)
          </Button>

          {isDryRunDone && (
            <Button
              variant="primary"
              size="sm"
              icon={<CheckCircle2 className="w-4 h-4" />}
              disabled={
                isImporting ||
                (activeTab === 'vehicles' ? validVehicles.length === 0 : validDrivers.length === 0)
              }
              onClick={handleCommitImport}
            >
              {isImporting
                ? 'جاري الاستيراد في النظام...'
                : `تأكيد واستيراد (${
                    activeTab === 'vehicles' ? validVehicles.length : validDrivers.length
                  }) سجل سليم`}
            </Button>
          )}
        </div>

        {/* Dry-Run Validation Report Card */}
        {isDryRunDone && (
          <div className="space-y-4 pt-3 border-t border-[#E5EAF2]">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 block">إجمالي الصفوف المقروءة:</span>
                <span className="text-base font-bold font-mono text-[#0B2545]">{totalParsedRows}</span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-[10px] text-emerald-600 block">السجلات السليمة الجاهزة:</span>
                <span className="text-base font-bold font-mono text-[#0FA37F]">
                  {activeTab === 'vehicles' ? validVehicles.length : validDrivers.length}
                </span>
              </div>
              <div className="p-3 bg-red-50 rounded-xl border border-red-200">
                <span className="text-[10px] text-red-600 block">السجلات المرفوضة لوجود أخطاء:</span>
                <span className="text-base font-bold font-mono text-[#EF4444]">{validationErrors.length}</span>
              </div>
            </div>

            {/* Detailed Errors Table */}
            {validationErrors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#EF4444]">
                  <AlertTriangle className="w-4 h-4" />
                  تقرير تدقيق الأخطاء وموانع الاستيراد (Validation Errors Breakdown):
                </div>
                <div className="border border-red-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-start text-xs">
                    <thead className="bg-red-50 text-red-700 font-bold border-b border-red-200">
                      <tr>
                        <th className="p-2 text-center">السطر</th>
                        <th className="p-2 text-start">المعرّف</th>
                        <th className="p-2 text-start">الحقل المعيب</th>
                        <th className="p-2 text-start">القيمة المدخلة</th>
                        <th className="p-2 text-start">سبب الرفض والخلل</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-100 bg-white">
                      {validationErrors.map((err, i) => (
                        <tr key={i} className="hover:bg-red-50/50">
                          <td className="p-2 text-center font-mono font-bold text-slate-600">
                            {err.rowNumber}
                          </td>
                          <td className="p-2 font-mono font-semibold text-[#0B2545]">{err.identifier}</td>
                          <td className="p-2 font-bold text-[#EF4444]">{err.field}</td>
                          <td className="p-2 font-mono text-slate-500 max-w-xs truncate">{err.value || 'فارغ'}</td>
                          <td className="p-2 text-red-600 font-medium">{err.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {validationErrors.length === 0 && (
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 flex items-center gap-2 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 text-[#0FA37F]" />
                فحص مبدئي ناجح 100%! كافة السجلات مطابقة للقواعد والشروط ويمكنك اعتماد الاستيراد مباشرة.
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
