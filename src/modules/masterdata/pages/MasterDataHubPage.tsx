import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Database,
  Boxes,
  Users,
  Users2,
  Warehouse,
  PieChart,
  Landmark,
  FolderTree,
  Ruler,
  ArrowUpRight,
  ShieldCheck,
  AlertTriangle,
  FileCheck,
  Search,
  History,
} from 'lucide-react';
import { db } from '../../../core/db';
import type { AuditLog } from '../../../types/models';
import { Card } from '../../../components/ui/Card';
import { StatCard } from '../../../components/ui/StatCard';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Breadcrumbs } from '../../../components/ui/Breadcrumbs';
import { Skeleton } from '../../../components/ui/Skeleton';
import { formatNumber, formatDate } from '../../../core/utils';
import { t } from '../../../i18n/ar';

export const MasterDataHubPage: React.FC = () => {
  const navigate = useNavigate();
  const [counts, setCounts] = useState({
    materials: 0,
    vendors: 0,
    customers: 0,
    plants: 0,
    storageLocations: 0,
    costCenters: 0,
    glAccounts: 0,
    groups: 0,
    units: 0,
  });
  const [expiringVendorsCount, setExpiringVendorsCount] = useState(0);
  const [recentAudits, setRecentAudits] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHubData() {
      try {
        setLoading(true);
        const [mats, vends, custs, pls, sls, ccs, gls, grps, uns, audits] = await Promise.all([
          db.materials.where('isDeleted').equals(0).count(),
          db.vendors.toArray(),
          db.customers.where('isDeleted').equals(0).count(),
          db.plants.where('isDeleted').equals(0).count(),
          db.storageLocations.where('isDeleted').equals(0).count(),
          db.costCenters.where('isDeleted').equals(0).count(),
          db.glAccounts.where('isDeleted').equals(0).count(),
          db.materialGroups.where('isDeleted').equals(0).count(),
          db.units.where('isDeleted').equals(0).count(),
          db.auditLogs.reverse().limit(6).toArray(),
        ]);

        const activeVendors = vends.filter((v) => !v.isDeleted);
        const now = new Date();
        const expiring = activeVendors.filter((v) => {
          if (!v.crExpiryDate) return false;
          const diffDays = Math.ceil((new Date(v.crExpiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays <= 30;
        });

        setCounts({
          materials: mats,
          vendors: activeVendors.length,
          customers: custs,
          plants: pls,
          storageLocations: sls,
          costCenters: ccs,
          glAccounts: gls,
          groups: grps,
          units: uns,
        });
        setExpiringVendorsCount(expiring.length);
        setRecentAudits(audits);
      } catch (err) {
        console.error('Failed to load Master Data Hub:', err);
      } finally {
        setLoading(false);
      }
    }

    loadHubData();
  }, []);

  const masterEntities = [
    {
      title: 'سجل المواد وقطع الغيار',
      subtitle: 'Material Master (MM01/MM03)',
      icon: Boxes,
      count: counts.materials,
      path: '/master-data/materials',
      color: 'text-primary',
      bgColor: 'bg-emerald-50',
      description: 'إدارة مواصفات الأصناف، التقييم المخزني، ونقاط إعادة الطلب والباركود.',
    },
    {
      title: 'سجل الموردين والمقاولين',
      subtitle: 'Vendor Master (BP/XK03)',
      icon: Users,
      count: counts.vendors,
      path: '/master-data/vendors',
      color: 'text-blue',
      bgColor: 'bg-blue-50',
      description: 'ملفات الموردين، الحسابات البنكية، الاعتمادات وتقييمات الأداء التشغيلي.',
      alertCount: expiringVendorsCount > 0 ? expiringVendorsCount : undefined,
    },
    {
      title: 'سجل العملاء ومحطات التوزيع',
      subtitle: 'Customer Master (XD01)',
      icon: Users2,
      count: counts.customers,
      path: '/master-data/customers',
      color: 'text-amber',
      bgColor: 'bg-amber-50',
      description: 'ملفات العملاء، سقوف التسهيلات الائتمانية، وشروط التحصيل والتسليم.',
    },
    {
      title: 'هيكل المنشأة والمواقع',
      subtitle: 'Plants & Storage Locations',
      icon: Warehouse,
      count: counts.plants + counts.storageLocations,
      path: '/master-data/locations',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      description: 'المحطات الرئيسية (Plants) ومستودعات التخزين والخزانات الاستراتيجية.',
    },
    {
      title: 'مراكز التكلفة التشغيلية',
      subtitle: 'Cost Centers (KS01/KS03)',
      icon: PieChart,
      count: counts.costCenters,
      path: '/master-data/cost-centers',
      color: 'text-violet-600',
      bgColor: 'bg-violet-50',
      description: 'محاسبة التكاليف، تحميل المصروفات، وربط الإدارات التشغيلية.',
    },
    {
      title: 'دليل الحسابات والأستاذ العام',
      subtitle: 'GL Accounts (FS00)',
      icon: Landmark,
      count: counts.glAccounts,
      path: '/master-data/gl-accounts',
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50',
      description: 'شجرة الحسابات المالية، حسابات المخزون والذمم والرقابة.',
    },
    {
      title: 'مجموعات المواد والتصنيفات',
      subtitle: 'Material Groups',
      icon: FolderTree,
      count: counts.groups,
      path: '/master-data/material-groups',
      color: 'text-emerald-700',
      bgColor: 'bg-emerald-50',
      description: 'تصنيف المواد والوقود والزيوت والمعدات حسب الفئات الإستراتيجية.',
    },
    {
      title: 'وحدات القياس المعيارية',
      subtitle: 'Units of Measure (CUNI)',
      icon: Ruler,
      count: counts.units,
      path: '/master-data/units',
      color: 'text-rose-600',
      bgColor: 'bg-rose-50',
      description: 'الوحدات المعتمدة (لتر، طن متري، برميل، قطعة) والترميز القياسي ISO.',
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: t('nav_home'), path: '/' },
          { label: t('nav_master_data') },
        ]}
      />

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-navy to-navy-2 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-xs font-semibold mb-3">
            <Database className="w-4 h-4 text-primary" />
            <span>نظام إدارة البيانات الأساسية الموحد (SAP Master Data Cockpit)</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold">
            مركز البيانات الأساسية — شركة الخليج للطاقة
          </h1>
          <p className="text-xs text-slate-300 mt-2 leading-relaxed">
            المنصة المركزية لإدارة وتوثيق كائنات البيانات الرئيسية (الأصناف، الموردين، العملاء، المحطات، والحسابات) مع الحفاظ التام على التكامل المرجعي وسجلات التدقيق التاريخية.
          </p>
        </div>

        {/* Decorative SVG Pattern */}
        <div className="absolute top-0 end-0 -translate-y-4 translate-x-4 opacity-10 pointer-events-none">
          <Database className="w-72 h-72 text-white" />
        </div>
      </div>

      {/* Quick KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="إجمالي الأصناف المعيارية"
          value={loading ? '...' : formatNumber(counts.materials)}
          icon={<Boxes className="w-6 h-6 text-primary" />}
        />
        <StatCard
          label="الموردون والمقاولون المعتمدون"
          value={loading ? '...' : formatNumber(counts.vendors)}
          icon={<Users className="w-6 h-6 text-blue" />}
        />
        <StatCard
          label="المحطات ومستودعات التخزين"
          value={loading ? '...' : formatNumber(counts.plants + counts.storageLocations)}
          icon={<Warehouse className="w-6 h-6 text-indigo-600" />}
        />
        <StatCard
          label="تنبيهات انتهاء التراخيص"
          value={loading ? '...' : formatNumber(expiringVendorsCount)}
          icon={<AlertTriangle className="w-6 h-6 text-amber" />}
        />
      </div>

      {/* Grid of 8 Master Data Entities */}
      <div>
        <h2 className="text-lg font-bold text-navy mb-4">أدلة البيانات الأساسية (Master Data Catalogs)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {masterEntities.map((ent, idx) => {
            const Icon = ent.icon;
            return (
              <Card
                key={idx}
                className="p-5 border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
                onClick={() => navigate(ent.path)}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-12 h-12 rounded-xl ${ent.bgColor} flex items-center justify-center ${ent.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>

                    <div className="flex items-center gap-1.5">
                      {ent.alertCount && (
                        <Badge variant="critical">
                          {ent.alertCount} تنبيه
                        </Badge>
                      )}
                      <span className="text-xs font-bold text-navy bg-slate-100 px-2.5 py-1 rounded-full">
                        {loading ? '...' : `${formatNumber(ent.count)} سجل`}
                      </span>
                    </div>
                  </div>

                  <h3 className="font-bold text-navy text-base group-hover:text-primary transition-colors">
                    {ent.title}
                  </h3>
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">{ent.subtitle}</div>
                  <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                    {ent.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 text-xs font-semibold text-primary">
                  <span>فتح الدليل</span>
                  <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Recent Master Data Change Documents */}
      <Card className="p-5 border border-slate-200">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-navy" />
            <h3 className="text-base font-bold text-navy">أحدث حركات وتعديلات البيانات الأساسية (Audit Log)</h3>
          </div>
          <span className="text-xs text-slate-400">توثيق فوري وتلقائي</span>
        </div>

        {recentAudits.length === 0 ? (
          <p className="text-xs text-slate-400 italic">لا توجد حركات تدقيق مسجلة حتى الآن.</p>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {recentAudits.map((a) => (
              <div key={a.id} className="py-2.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Badge
                    variant={
                      a.action === 'CREATE' || a.action === 'LOGIN' || a.action === 'ACCOUNT_UNLOCKED'
                        ? 'approved'
                        : a.action === 'UPDATE' || a.action === 'PASSWORD_CHANGED'
                        ? 'in_progress'
                        : a.action === 'STATUS_CHANGE'
                        ? 'in_review'
                        : 'critical'
                    }
                  >
                    {a.action}
                  </Badge>
                  <div>
                    <span className="font-semibold text-navy">[{a.entity}]</span>
                    <span className="text-slate-600 ms-1.5">{a.entityId}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-slate-500">
                  <span>المستخدم: <strong className="text-navy">{a.userName || a.userId}</strong></span>
                  <span>{formatDate(a.timestamp, 'yyyy-MM-dd HH:mm')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
