import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { ProtectedRoute } from '../core/rbac';
import { t } from '../i18n/ar';
import { PlaceholderPage } from '../components/layout/PlaceholderPage';

// Arabic Skeleton Loading Fallback for Lazy-Loaded Routes
const PageLoadingFallback: React.FC = () => (
  <div className="space-y-6 p-6 animate-pulse" dir="rtl">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <div className="h-6 bg-[#E5EAF2] rounded-lg w-48" />
        <div className="h-3.5 bg-[#E5EAF2] rounded-lg w-72" />
      </div>
      <div className="h-9 bg-[#E5EAF2] rounded-xl w-32" />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-28 bg-white border border-[#E5EAF2] rounded-[16px] p-4 space-y-3">
          <div className="h-4 bg-[#E5EAF2] rounded w-24" />
          <div className="h-7 bg-[#E5EAF2] rounded w-36" />
        </div>
      ))}
    </div>
    <div className="h-72 bg-white border border-[#E5EAF2] rounded-[16px] p-6 space-y-4">
      <div className="h-4 bg-[#E5EAF2] rounded w-1/3" />
      <div className="h-4 bg-[#E5EAF2] rounded w-full" />
      <div className="h-4 bg-[#E5EAF2] rounded w-4/5" />
    </div>
  </div>
);

// Lazy Loaded Core Pages
const DashboardPage = lazy(() => import('../pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const LoginPage = lazy(() => import('../pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));
const ProjectRulesPage = lazy(() => import('../pages/ProjectRulesPage').then((m) => ({ default: m.ProjectRulesPage })));
const DevAdminPage = lazy(() => import('../pages/DevAdminPage').then((m) => ({ default: m.DevAdminPage })));
const DiagnosticsPage = lazy(() => import('../pages/DiagnosticsPage').then((m) => ({ default: m.DiagnosticsPage })));
const AboutPage = lazy(() => import('../pages/AboutPage').then((m) => ({ default: m.AboutPage })));
const NotificationsPage = lazy(() => import('../pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));

// Admin Module Pages
const ApprovalsInboxPage = lazy(() => import('../modules/admin/pages/ApprovalsInboxPage').then((m) => ({ default: m.ApprovalsInboxPage })));
const WorkflowConfigPage = lazy(() => import('../modules/admin/pages/WorkflowConfigPage').then((m) => ({ default: m.WorkflowConfigPage })));
const BackupRestorePage = lazy(() => import('../modules/admin/pages/BackupRestorePage').then((m) => ({ default: m.BackupRestorePage })));
const PrintTemplatesPage = lazy(() => import('../modules/admin/pages/PrintTemplatesPage').then((m) => ({ default: m.PrintTemplatesPage })));

// Master Data Module
const MasterDataHubPage = lazy(() => import('../modules/masterdata/pages/MasterDataHubPage').then((m) => ({ default: m.MasterDataHubPage })));
const MaterialsListPage = lazy(() => import('../modules/masterdata/pages/MaterialsListPage').then((m) => ({ default: m.MaterialsListPage })));
const MaterialDetailPage = lazy(() => import('../modules/masterdata/pages/MaterialDetailPage').then((m) => ({ default: m.MaterialDetailPage })));
const VendorsListPage = lazy(() => import('../modules/masterdata/pages/VendorsListPage').then((m) => ({ default: m.VendorsListPage })));
const VendorDetailPage = lazy(() => import('../modules/masterdata/pages/VendorDetailPage').then((m) => ({ default: m.VendorDetailPage })));
const CustomersListPage = lazy(() => import('../modules/masterdata/pages/CustomersListPage').then((m) => ({ default: m.CustomersListPage })));
const CustomerDetailPage = lazy(() => import('../modules/masterdata/pages/CustomerDetailPage').then((m) => ({ default: m.CustomerDetailPage })));
const LocationsListPage = lazy(() => import('../modules/masterdata/pages/LocationsListPage').then((m) => ({ default: m.LocationsListPage })));
const CostCentersListPage = lazy(() => import('../modules/masterdata/pages/CostCentersListPage').then((m) => ({ default: m.CostCentersListPage })));
const GLAccountsListPage = lazy(() => import('../modules/masterdata/pages/GLAccountsListPage').then((m) => ({ default: m.GLAccountsListPage })));
const MaterialGroupsListPage = lazy(() => import('../modules/masterdata/pages/MaterialGroupsListPage').then((m) => ({ default: m.MaterialGroupsListPage })));
const UnitsListPage = lazy(() => import('../modules/masterdata/pages/UnitsListPage').then((m) => ({ default: m.UnitsListPage })));

// Inventory Module
const WarehouseDashboardPage = lazy(() => import('../modules/inventory/pages/WarehouseDashboardPage').then((m) => ({ default: m.WarehouseDashboardPage })));
const StockBalancePage = lazy(() => import('../modules/inventory/pages/StockBalancePage').then((m) => ({ default: m.StockBalancePage })));
const MaterialMovementsPage = lazy(() => import('../modules/inventory/pages/MaterialMovementsPage').then((m) => ({ default: m.MaterialMovementsPage })));
const PhysicalInventoryPage = lazy(() => import('../modules/inventory/pages/PhysicalInventoryPage').then((m) => ({ default: m.PhysicalInventoryPage })));
const ReorderManagementPage = lazy(() => import('../modules/inventory/pages/ReorderManagementPage').then((m) => ({ default: m.ReorderManagementPage })));

// Fleet Module
const FleetDashboardPage = lazy(() => import('../modules/fleet/pages/FleetDashboardPage').then((m) => ({ default: m.FleetDashboardPage })));
const VehiclesListPage = lazy(() => import('../modules/fleet/pages/VehiclesListPage').then((m) => ({ default: m.VehiclesListPage })));
const DriversListPage = lazy(() => import('../modules/fleet/pages/DriversListPage').then((m) => ({ default: m.DriversListPage })));
const TripsListPage = lazy(() => import('../modules/fleet/pages/TripsListPage').then((m) => ({ default: m.TripsListPage })));
const FuelManagementPage = lazy(() => import('../modules/fleet/pages/FuelManagementPage').then((m) => ({ default: m.FuelManagementPage })));
const FleetMaintenancePage = lazy(() => import('../modules/fleet/pages/FleetMaintenancePage').then((m) => ({ default: m.FleetMaintenancePage })));

// Assets Module
const AssetDashboardPage = lazy(() => import('../modules/assets/pages/AssetDashboardPage').then((m) => ({ default: m.AssetDashboardPage })));
const AssetRegisterPage = lazy(() => import('../modules/assets/pages/AssetRegisterPage').then((m) => ({ default: m.AssetRegisterPage })));
const AssetDetailPage = lazy(() => import('../modules/assets/pages/AssetDetailPage').then((m) => ({ default: m.AssetDetailPage })));
const DepreciationManagementPage = lazy(() => import('../modules/assets/pages/DepreciationManagementPage').then((m) => ({ default: m.DepreciationManagementPage })));
const AssetTransfersPage = lazy(() => import('../modules/assets/pages/AssetTransfersPage').then((m) => ({ default: m.AssetTransfersPage })));
const AssetDisposalsPage = lazy(() => import('../modules/assets/pages/AssetDisposalsPage').then((m) => ({ default: m.AssetDisposalsPage })));
const AssetReportsPage = lazy(() => import('../modules/assets/pages/AssetReportsPage').then((m) => ({ default: m.AssetReportsPage })));

// Finance Module
const FinancialCockpitPage = lazy(() => import('../modules/finance/pages/FinancialCockpitPage').then((m) => ({ default: m.FinancialCockpitPage })));
const JournalEntriesPage = lazy(() => import('../modules/finance/pages/JournalEntriesPage').then((m) => ({ default: m.JournalEntriesPage })));
const AccountsPayablePage = lazy(() => import('../modules/finance/pages/AccountsPayablePage').then((m) => ({ default: m.AccountsPayablePage })));
const AccountsReceivablePage = lazy(() => import('../modules/finance/pages/AccountsReceivablePage').then((m) => ({ default: m.AccountsReceivablePage })));
const ControllingPage = lazy(() => import('../modules/finance/pages/ControllingPage').then((m) => ({ default: m.ControllingPage })));
const BudgetControlPage = lazy(() => import('../modules/finance/pages/BudgetControlPage').then((m) => ({ default: m.BudgetControlPage })));
const PeriodEndClosingPage = lazy(() => import('../modules/finance/pages/PeriodEndClosingPage').then((m) => ({ default: m.PeriodEndClosingPage })));
const FinancialStatementsPage = lazy(() => import('../modules/finance/pages/FinancialStatementsPage').then((m) => ({ default: m.FinancialStatementsPage })));
const AccountDeterminationPage = lazy(() => import('../modules/finance/pages/AccountDeterminationPage').then((m) => ({ default: m.AccountDeterminationPage })));

// Reports Module
const ReportsCenterPage = lazy(() => import('../modules/reports/pages/ReportsCenterPage').then((m) => ({ default: m.ReportsCenterPage })));

export const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
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
          <Route path="about" element={<AboutPage />} />

          {/* Developer Verification & Diagnostics */}
          <Route path="admin/dev" element={<DevAdminPage />} />
          <Route path="admin/diagnostics" element={<DiagnosticsPage />} />
          <Route path="diagnostics" element={<DiagnosticsPage />} />

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
                  subtitle="إدارة وإصدار أوامر الشراء الرسمية مع الموردين ومتابعة التوريد (Purchase Order - ME21N)"
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
                  subtitle="عقود التوريد طويلة الأجل والاتفاقيات الإطارية لكميات الوقود والمعدات (ME31K)"
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

          {/* Inventory & Warehouse Routes (Guarded by WM_VIEW) */}
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
                <AssetDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="assets/register"
            element={
              <ProtectedRoute requiredAuth={{ module: 'AM', activity: 'view' }}>
                <AssetRegisterPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="assets/detail/:id"
            element={
              <ProtectedRoute requiredAuth={{ module: 'AM', activity: 'view' }}>
                <AssetDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="assets/depreciation"
            element={
              <ProtectedRoute requiredAuth={{ module: 'AM', activity: 'view' }}>
                <DepreciationManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="assets/transfers"
            element={
              <ProtectedRoute requiredAuth={{ module: 'AM', activity: 'view' }}>
                <AssetTransfersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="assets/disposals"
            element={
              <ProtectedRoute requiredAuth={{ module: 'AM', activity: 'view' }}>
                <AssetDisposalsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="assets/reports"
            element={
              <ProtectedRoute requiredAuth={{ module: 'AM', activity: 'view' }}>
                <AssetReportsPage />
              </ProtectedRoute>
            }
          />

          {/* Finance & Controlling Routes (Guarded by FI_VIEW) */}
          <Route
            path="finance"
            element={
              <ProtectedRoute requiredAuth={{ module: 'FI', activity: 'view' }}>
                <FinancialCockpitPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="finance/gl"
            element={
              <ProtectedRoute requiredAuth={{ module: 'FI', activity: 'view' }}>
                <JournalEntriesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="finance/ap"
            element={
              <ProtectedRoute requiredAuth={{ module: 'FI', activity: 'view' }}>
                <AccountsPayablePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="finance/ar"
            element={
              <ProtectedRoute requiredAuth={{ module: 'FI', activity: 'view' }}>
                <AccountsReceivablePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="finance/co"
            element={
              <ProtectedRoute requiredAuth={{ module: 'FI', activity: 'view' }}>
                <ControllingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="finance/budget"
            element={
              <ProtectedRoute requiredAuth={{ module: 'FI', activity: 'view' }}>
                <BudgetControlPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="finance/period-end"
            element={
              <ProtectedRoute requiredAuth={{ module: 'FI', activity: 'view' }}>
                <PeriodEndClosingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="finance/statements"
            element={
              <ProtectedRoute requiredAuth={{ module: 'FI', activity: 'view' }}>
                <FinancialStatementsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="finance/account-rules"
            element={
              <ProtectedRoute requiredAuth={{ module: 'FI', activity: 'view' }}>
                <AccountDeterminationPage />
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
          <Route path="reports" element={<ReportsCenterPage />} />

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
          <Route
            path="admin/approvals"
            element={
              <ProtectedRoute requiredAuth={{ module: 'ADM', activity: 'view' }}>
                <ApprovalsInboxPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/workflow"
            element={
              <ProtectedRoute requiredAuth={{ module: 'ADM', activity: 'view' }}>
                <WorkflowConfigPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/backup"
            element={
              <ProtectedRoute requiredAuth={{ module: 'ADM', activity: 'create' }}>
                <BackupRestorePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/print-templates"
            element={
              <ProtectedRoute requiredAuth={{ module: 'ADM', activity: 'view' }}>
                <PrintTemplatesPage />
              </ProtectedRoute>
            }
          />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>

        {/* 404 Catch-All */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
};
