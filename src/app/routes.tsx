import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { DashboardPage } from '../pages/DashboardPage';
import { LoginPage } from '../pages/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ProjectRulesPage } from '../pages/ProjectRulesPage';
import { DevAdminPage } from '../pages/DevAdminPage';
import { PlaceholderPage } from '../components/layout/PlaceholderPage';
import { ProtectedRoute } from '../core/rbac';
import { t } from '../i18n/ar';
import { MasterDataHubPage } from '../modules/masterdata/pages/MasterDataHubPage';
import { MaterialsListPage } from '../modules/masterdata/pages/MaterialsListPage';
import { MaterialDetailPage } from '../modules/masterdata/pages/MaterialDetailPage';
import { VendorsListPage } from '../modules/masterdata/pages/VendorsListPage';
import { VendorDetailPage } from '../modules/masterdata/pages/VendorDetailPage';
import { CustomersListPage } from '../modules/masterdata/pages/CustomersListPage';
import { CustomerDetailPage } from '../modules/masterdata/pages/CustomerDetailPage';
import { LocationsListPage } from '../modules/masterdata/pages/LocationsListPage';
import { CostCentersListPage } from '../modules/masterdata/pages/CostCentersListPage';
import { GLAccountsListPage } from '../modules/masterdata/pages/GLAccountsListPage';
import { MaterialGroupsListPage } from '../modules/masterdata/pages/MaterialGroupsListPage';
import { UnitsListPage } from '../modules/masterdata/pages/UnitsListPage';
import { WarehouseDashboardPage } from '../modules/inventory/pages/WarehouseDashboardPage';
import { StockBalancePage } from '../modules/inventory/pages/StockBalancePage';
import { MaterialMovementsPage } from '../modules/inventory/pages/MaterialMovementsPage';
import { PhysicalInventoryPage } from '../modules/inventory/pages/PhysicalInventoryPage';
import { ReorderManagementPage } from '../modules/inventory/pages/ReorderManagementPage';
import { FleetDashboardPage } from '../modules/fleet/pages/FleetDashboardPage';
import { VehiclesListPage } from '../modules/fleet/pages/VehiclesListPage';
import { DriversListPage } from '../modules/fleet/pages/DriversListPage';
import { TripsListPage } from '../modules/fleet/pages/TripsListPage';
import { FuelManagementPage } from '../modules/fleet/pages/FuelManagementPage';
import { FleetMaintenancePage } from '../modules/fleet/pages/FleetMaintenancePage';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Standalone Login Screen */}
      <Route path="/login" element={<LoginPage />} />

      {/* Main ERP Layout Shell protected by authentication */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Dashboard */}
        <Route index element={<DashboardPage />} />
        <Route path="home" element={<DashboardPage />} />
        <Route path="rules" element={<ProjectRulesPage />} />

        {/* Developer Verification Cockpit */}
        <Route path="admin/dev" element={<DevAdminPage />} />

        {/* Procurement Routes (Guarded by MM_VIEW) */}
        <Route
          path="procurement"
          element={
            <ProtectedRoute requiredAuth={{ module: 'MM', activity: 'view' }}>
              <PlaceholderPage
                title={t('nav_procurement')}
                moduleName="SAP MM"
                breadcrumbs={[{ label: t('nav_home'), path: '/' }, { label: t('nav_procurement') }]}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="procurement/pr"
          element={
            <ProtectedRoute requiredAuth={{ module: 'MM', activity: 'view' }}>
              <PlaceholderPage
                title={t('nav_pr')}
                subtitle="إنشاء ومتابعة طلبات الشراء الداخلية والاعتمادات (Purchase Requisition - ME51N)"
                moduleName="SAP MM-PUR"
                breadcrumbs={[
                  { label: t('nav_home'), path: '/' },
                  { label: t('nav_procurement'), path: '/procurement' },
                  { label: t('nav_pr') },
                ]}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="procurement/rfq"
          element={
            <ProtectedRoute requiredAuth={{ module: 'MM', activity: 'view' }}>
              <PlaceholderPage
                title={t('nav_rfq')}
                subtitle="إصدار واستلام عروض أسعار الموردين والمقارنة الفنية والمالية (RFQ - ME41)"
                moduleName="SAP MM-PUR"
                breadcrumbs={[
                  { label: t('nav_home'), path: '/' },
                  { label: t('nav_procurement'), path: '/procurement' },
                  { label: t('nav_rfq') },
                ]}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="procurement/po"
          element={
            <ProtectedRoute requiredAuth={{ module: 'MM', activity: 'view' }}>
              <PlaceholderPage
                title={t('nav_po')}
                subtitle="إدارة أوامر الشراء والتعاقدات الرسمية مع الموردين (Purchase Order - ME21N)"
                moduleName="SAP MM-PUR"
                breadcrumbs={[
                  { label: t('nav_home'), path: '/' },
                  { label: t('nav_procurement'), path: '/procurement' },
                  { label: t('nav_po') },
                ]}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="procurement/contracts"
          element={
            <ProtectedRoute requiredAuth={{ module: 'MM', activity: 'view' }}>
              <PlaceholderPage
                title={t('nav_contracts')}
                subtitle="عقود توريد الوقود والخدمات اللوجستية الإطارية طويلة الأجل"
                moduleName="SAP MM-PUR"
                breadcrumbs={[
                  { label: t('nav_home'), path: '/' },
                  { label: t('nav_procurement'), path: '/procurement' },
                  { label: t('nav_contracts') },
                ]}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="procurement/tenders"
          element={
            <ProtectedRoute requiredAuth={{ module: 'MM', activity: 'view' }}>
              <PlaceholderPage
                title={t('nav_tenders')}
                subtitle="طرح وترسية مناقصات مشتريات الطاقة والمعدات الثقيلة"
                moduleName="SAP MM-PUR"
                breadcrumbs={[
                  { label: t('nav_home'), path: '/' },
                  { label: t('nav_procurement'), path: '/procurement' },
                  { label: t('nav_tenders') },
                ]}
              />
            </ProtectedRoute>
          }
        />

        {/* Inventory Routes (Guarded by WM_VIEW) */}
        <Route
          path="inventory"
          element={
            <ProtectedRoute requiredAuth={{ module: 'WM', activity: 'view' }}>
              <WarehouseDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory/stock"
          element={
            <ProtectedRoute requiredAuth={{ module: 'WM', activity: 'view' }}>
              <StockBalancePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory/movements"
          element={
            <ProtectedRoute requiredAuth={{ module: 'WM', activity: 'view' }}>
              <MaterialMovementsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory/physical"
          element={
            <ProtectedRoute requiredAuth={{ module: 'WM', activity: 'view' }}>
              <PhysicalInventoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory/reorder"
          element={
            <ProtectedRoute requiredAuth={{ module: 'WM', activity: 'view' }}>
              <ReorderManagementPage />
            </ProtectedRoute>
          }
        />

        {/* Fleet & Logistics Routes (Guarded by TM_VIEW) */}
        <Route
          path="fleet"
          element={
            <ProtectedRoute requiredAuth={{ module: 'TM', activity: 'view' }}>
              <FleetDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="fleet/vehicles"
          element={
            <ProtectedRoute requiredAuth={{ module: 'TM', activity: 'view' }}>
              <VehiclesListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="fleet/drivers"
          element={
            <ProtectedRoute requiredAuth={{ module: 'TM', activity: 'view' }}>
              <DriversListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="fleet/trips"
          element={
            <ProtectedRoute requiredAuth={{ module: 'TM', activity: 'view' }}>
              <TripsListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="fleet/fuel"
          element={
            <ProtectedRoute requiredAuth={{ module: 'TM', activity: 'view' }}>
              <FuelManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="fleet/maintenance"
          element={
            <ProtectedRoute requiredAuth={{ module: 'TM', activity: 'view' }}>
              <FleetMaintenancePage />
            </ProtectedRoute>
          }
        />

        {/* Fixed Assets Routes (Guarded by AM_VIEW) */}
        <Route
          path="assets"
          element={
            <ProtectedRoute requiredAuth={{ module: 'AM', activity: 'view' }}>
              <PlaceholderPage
                title={t('nav_assets')}
                moduleName="SAP FI-AA"
                breadcrumbs={[{ label: t('nav_home'), path: '/' }, { label: t('nav_assets') }]}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="assets/register"
          element={
            <ProtectedRoute requiredAuth={{ module: 'AM', activity: 'view' }}>
              <PlaceholderPage
                title={t('nav_assets_register')}
                subtitle="سجل الأصول الرأسمالية ومعدات الضخ والتخزين (Asset Master - AS01)"
                moduleName="SAP FI-AA"
                breadcrumbs={[
                  { label: t('nav_home'), path: '/' },
                  { label: t('nav_assets'), path: '/assets' },
                  { label: t('nav_assets_register') },
                ]}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="assets/depreciation"
          element={
            <ProtectedRoute requiredAuth={{ module: 'AM', activity: 'view' }}>
              <PlaceholderPage
                title={t('nav_depreciation')}
                subtitle="تشغيل دورات الإهلاك الشهري والترحيل إلى الأستاذ العام (AFAB)"
                moduleName="SAP FI-AA"
                breadcrumbs={[
                  { label: t('nav_home'), path: '/' },
                  { label: t('nav_assets'), path: '/assets' },
                  { label: t('nav_depreciation') },
                ]}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="assets/maintenance"
          element={
            <ProtectedRoute requiredAuth={{ module: 'AM', activity: 'view' }}>
              <PlaceholderPage
                title={t('nav_assets_maint')}
                subtitle="أوامر صيانة الخزانات والمضخات ومحطات الطاقة (SAP PM)"
                moduleName="SAP PM"
                breadcrumbs={[
                  { label: t('nav_home'), path: '/' },
                  { label: t('nav_assets'), path: '/assets' },
                  { label: t('nav_assets_maint') },
                ]}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="assets/disposal"
          element={
            <ProtectedRoute requiredAuth={{ module: 'AM', activity: 'view' }}>
              <PlaceholderPage
                title={t('nav_disposal')}
                subtitle="استبعاد وتخريد الأصول وحساب أرباح وخسائر التخريد (ABAVN)"
                moduleName="SAP FI-AA"
                breadcrumbs={[
                  { label: t('nav_home'), path: '/' },
                  { label: t('nav_assets'), path: '/assets' },
                  { label: t('nav_disposal') },
                ]}
              />
            </ProtectedRoute>
          }
        />

        {/* Finance & Accounting Routes (Guarded by FI_VIEW) */}
        <Route
          path="finance"
          element={
            <ProtectedRoute requiredAuth={{ module: 'FI', activity: 'view' }}>
              <PlaceholderPage
                title={t('nav_finance')}
                moduleName="SAP FI/CO"
                breadcrumbs={[{ label: t('nav_home'), path: '/' }, { label: t('nav_finance') }]}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="finance/journal"
          element={
            <ProtectedRoute requiredAuth={{ module: 'FI', activity: 'view' }}>
              <PlaceholderPage
                title={t('nav_journal_entries')}
                subtitle="إدخال وترحيل القيود اليومية في دفتر الأستاذ العام (GL Entry - FB50)"
                moduleName="SAP FI-GL"
                breadcrumbs={[
                  { label: t('nav_home'), path: '/' },
                  { label: t('nav_finance'), path: '/finance' },
                  { label: t('nav_journal_entries') },
                ]}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="finance/ap"
          element={
            <ProtectedRoute requiredAuth={{ module: 'FI', activity: 'view' }}>
              <PlaceholderPage
                title={t('nav_ap')}
                subtitle="فواتير الموردين، المطابقات الثلاثية، وأوامر الدفع (AP - FB60)"
                moduleName="SAP FI-AP"
                breadcrumbs={[
                  { label: t('nav_home'), path: '/' },
                  { label: t('nav_finance'), path: '/finance' },
                  { label: t('nav_ap') },
                ]}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="finance/ar"
          element={
            <ProtectedRoute requiredAuth={{ module: 'FI', activity: 'view' }}>
              <PlaceholderPage
                title={t('nav_ar')}
                subtitle="فواتير العملاء ومحطات التوزيع وسندات القبض (AR - FB70)"
                moduleName="SAP FI-AR"
                breadcrumbs={[
                  { label: t('nav_home'), path: '/' },
                  { label: t('nav_finance'), path: '/finance' },
                  { label: t('nav_ar') },
                ]}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="finance/cost-centers"
          element={
            <ProtectedRoute requiredAuth={{ module: 'FI', activity: 'view' }}>
              <CostCentersListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="finance/budgets"
          element={
            <ProtectedRoute requiredAuth={{ module: 'FI', activity: 'view' }}>
              <PlaceholderPage
                title={t('nav_budgets')}
                subtitle="مراقبة الميزانيات التقديرية والتحكم في اعتمادات الإنفاق"
                moduleName="SAP CO-OM"
                breadcrumbs={[
                  { label: t('nav_home'), path: '/' },
                  { label: t('nav_finance'), path: '/finance' },
                  { label: t('nav_budgets') },
                ]}
              />
            </ProtectedRoute>
          }
        />

        {/* Master Data Routes */}
        <Route path="master-data" element={<MasterDataHubPage />} />
        <Route path="master-data/materials" element={<MaterialsListPage />} />
        <Route path="master-data/materials/:id" element={<MaterialDetailPage />} />
        <Route path="master-data/vendors" element={<VendorsListPage />} />
        <Route path="master-data/vendors/:id" element={<VendorDetailPage />} />
        <Route path="master-data/customers" element={<CustomersListPage />} />
        <Route path="master-data/customers/:id" element={<CustomerDetailPage />} />
        <Route path="master-data/locations" element={<LocationsListPage />} />
        <Route path="master-data/cost-centers" element={<CostCentersListPage />} />
        <Route path="master-data/gl-accounts" element={<GLAccountsListPage />} />
        <Route path="master-data/material-groups" element={<MaterialGroupsListPage />} />
        <Route path="master-data/units" element={<UnitsListPage />} />

        {/* Reports */}
        <Route
          path="reports"
          element={
            <PlaceholderPage
              title={t('nav_reports')}
              subtitle="تقارير الأداء التشغيلي والتحليلات المالية المجمعة"
              moduleName="Executive BI"
              breadcrumbs={[{ label: t('nav_home'), path: '/' }, { label: t('nav_reports') }]}
            />
          }
        />

        {/* Admin & System Routes (Guarded by ADM_ALL) */}
        <Route
          path="admin"
          element={
            <ProtectedRoute requiredAuth={{ module: 'ADM', activity: 'create' }}>
              <PlaceholderPage
                title={t('nav_admin')}
                moduleName="System Admin"
                breadcrumbs={[{ label: t('nav_home'), path: '/' }, { label: t('nav_admin') }]}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/users"
          element={
            <ProtectedRoute requiredAuth={{ module: 'ADM', activity: 'create' }}>
              <PlaceholderPage
                title={t('nav_users')}
                subtitle="إدارة حسابات مستخدمي النظام وتعيين الفروع والمستودعات"
                moduleName="Security Admin"
                breadcrumbs={[
                  { label: t('nav_home'), path: '/' },
                  { label: t('nav_admin'), path: '/admin' },
                  { label: t('nav_users') },
                ]}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/roles"
          element={
            <ProtectedRoute requiredAuth={{ module: 'ADM', activity: 'create' }}>
              <PlaceholderPage
                title={t('nav_roles')}
                subtitle="كائنات التخويل ومجموعات الصلاحيات (Authorization Objects & RBAC)"
                moduleName="SAP PFCG"
                breadcrumbs={[
                  { label: t('nav_home'), path: '/' },
                  { label: t('nav_admin'), path: '/admin' },
                  { label: t('nav_roles') },
                ]}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/audit"
          element={
            <ProtectedRoute requiredAuth={{ module: 'ADM', activity: 'create' }}>
              <PlaceholderPage
                title={t('nav_audit_log')}
                subtitle="سجل التدقيق الشامل وتتبع كافة الحركات والتعديلات (Change Documents / Audit Trail)"
                moduleName="Audit & Compliance"
                breadcrumbs={[
                  { label: t('nav_home'), path: '/' },
                  { label: t('nav_admin'), path: '/admin' },
                  { label: t('nav_audit_log') },
                ]}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/settings"
          element={
            <ProtectedRoute requiredAuth={{ module: 'ADM', activity: 'create' }}>
              <PlaceholderPage
                title={t('nav_settings')}
                subtitle="تخصيص معلمات النظام، الترقيم الآلي للمستندات، وسلاسل الاعتماد"
                moduleName="IMG Customizing"
                breadcrumbs={[
                  { label: t('nav_home'), path: '/' },
                  { label: t('nav_admin'), path: '/admin' },
                  { label: t('nav_settings') },
                ]}
              />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* 404 Catch-All */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
