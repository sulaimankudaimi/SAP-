import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  ShoppingCart,
  Boxes,
  Truck,
  Building2,
  Landmark,
  Database,
  BarChart3,
  ShieldCheck,
  ChevronDown,
  ChevronLeft,
  Zap,
  Menu,
  FileCode,
  Activity,
} from 'lucide-react';
import { cn } from '../../core/utils';
import { t } from '../../i18n/ar';
import { NavItemConfig } from '../../types';
import { useAuthStore } from '../../core/auth/useAuthStore';
import type { ModuleCode } from '../../types/models';

export interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

interface NavItemWithModule extends NavItemConfig {
  requiredModule?: ModuleCode;
}

export const navigationConfig: NavItemWithModule[] = [
  {
    id: 'home',
    path: '/',
    titleKey: 'nav_home',
    icon: Home,
  },
  {
    id: 'procurement',
    path: '/procurement',
    titleKey: 'nav_procurement',
    icon: ShoppingCart,
    requiredModule: 'MM',
    badgeCount: 5,
    children: [
      { id: 'pr', path: '/procurement/pr', titleKey: 'nav_pr', badgeCount: 3 },
      { id: 'rfq', path: '/procurement/rfq', titleKey: 'nav_rfq' },
      { id: 'po', path: '/procurement/po', titleKey: 'nav_po', badgeCount: 2 },
      { id: 'contracts', path: '/procurement/contracts', titleKey: 'nav_contracts' },
      { id: 'tenders', path: '/procurement/tenders', titleKey: 'nav_tenders' },
    ],
  },
  {
    id: 'inventory',
    path: '/inventory',
    titleKey: 'nav_inventory',
    icon: Boxes,
    requiredModule: 'WM',
    children: [
      { id: 'stock', path: '/inventory/stock', titleKey: 'nav_stock_balance' },
      { id: 'movements', path: '/inventory/movements', titleKey: 'nav_mat_movements' },
      { id: 'inventory-audit', path: '/inventory/physical', titleKey: 'nav_physical_inv' },
      { id: 'reorder', path: '/inventory/reorder', titleKey: 'nav_reorder' },
    ],
  },
  {
    id: 'fleet',
    path: '/fleet',
    titleKey: 'nav_fleet',
    icon: Truck,
    requiredModule: 'TM',
    children: [
      { id: 'vehicles', path: '/fleet/vehicles', titleKey: 'nav_vehicles' },
      { id: 'drivers', path: '/fleet/drivers', titleKey: 'nav_drivers' },
      { id: 'trips', path: '/fleet/trips', titleKey: 'nav_trips' },
      { id: 'fuel', path: '/fleet/fuel', titleKey: 'nav_fuel' },
      { id: 'maintenance', path: '/fleet/maintenance', titleKey: 'nav_fleet_maintenance' },
    ],
  },
  {
    id: 'assets',
    path: '/assets',
    titleKey: 'nav_assets',
    icon: Building2,
    requiredModule: 'AM',
    children: [
      { id: 'asset-reg', path: '/assets/register', titleKey: 'nav_assets_register' },
      { id: 'depreciation', path: '/assets/depreciation', titleKey: 'nav_depreciation' },
      { id: 'transfers', path: '/assets/transfers', titleKey: 'nav_assets_transfers' },
      { id: 'disposal', path: '/assets/disposal', titleKey: 'nav_disposal' },
      { id: 'reports', path: '/assets/reports', titleKey: 'nav_assets_reports' },
    ],
  },
  {
    id: 'finance',
    path: '/finance',
    titleKey: 'nav_finance',
    icon: Landmark,
    requiredModule: 'FI',
    children: [
      { id: 'journal', path: '/finance/journal', titleKey: 'nav_journal_entries' },
      { id: 'ap', path: '/finance/ap', titleKey: 'nav_ap' },
      { id: 'ar', path: '/finance/ar', titleKey: 'nav_ar' },
      { id: 'cost-centers', path: '/finance/cost-centers', titleKey: 'nav_cost_centers' },
      { id: 'budgets', path: '/finance/budgets', titleKey: 'nav_budgets' },
      { id: 'period-end', path: '/finance/period-end', titleKey: 'nav_period_end' },
      { id: 'statements', path: '/finance/statements', titleKey: 'nav_financial_statements' },
      { id: 'account-rules', path: '/finance/account-rules', titleKey: 'nav_account_rules' },
    ],
  },
  {
    id: 'master-data',
    path: '/master-data',
    titleKey: 'nav_master_data',
    icon: Database,
    requiredModule: 'MD',
    children: [
      { id: 'materials', path: '/master-data/materials', titleKey: 'nav_md_materials' },
      { id: 'vendors', path: '/master-data/vendors', titleKey: 'nav_md_vendors' },
      { id: 'customers', path: '/master-data/customers', titleKey: 'nav_md_customers' },
      { id: 'locations', path: '/master-data/locations', titleKey: 'nav_md_locations' },
      { id: 'cost-centers', path: '/master-data/cost-centers', titleKey: 'nav_md_cost_centers' },
      { id: 'gl-accounts', path: '/master-data/gl-accounts', titleKey: 'nav_md_gl_accounts' },
      { id: 'material-groups', path: '/master-data/material-groups', titleKey: 'nav_md_groups' },
      { id: 'units', path: '/master-data/units', titleKey: 'nav_md_units' },
    ],
  },
  {
    id: 'reports',
    path: '/reports',
    titleKey: 'nav_reports',
    icon: BarChart3,
  },
  {
    id: 'admin',
    path: '/admin',
    titleKey: 'nav_admin',
    icon: ShieldCheck,
    requiredModule: 'ADM',
    children: [
      { id: 'dev-cockpit', path: '/admin/dev', titleKey: 'nav_audit_log' },
      { id: 'users', path: '/admin/users', titleKey: 'nav_users' },
      { id: 'roles', path: '/admin/roles', titleKey: 'nav_roles' },
      { id: 'audit', path: '/admin/audit', titleKey: 'nav_audit_log' },
      { id: 'settings', path: '/admin/settings', titleKey: 'nav_settings' },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggleCollapse }) => {
  const location = useLocation();
  const can = useAuthStore((s) => s.can);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    procurement: true,
  });

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Filter navigation items based on current role permissions (SAP-style UI security)
  const visibleNavItems = navigationConfig.filter((item) => {
    if (!item.requiredModule) return true;
    return can({ module: item.requiredModule, activity: 'view' });
  });

  return (
    <aside
      className={cn(
        'bg-[#0B2545] text-white shrink-0 flex flex-col justify-between transition-all duration-300 z-30 select-none border-e border-[#13315C] h-screen sticky top-0',
        collapsed ? 'w-[72px]' : 'w-[260px]'
      )}
    >
      {/* Sidebar Header with Brand */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-[#13315C]">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0FA37F] to-[#2563EB] flex items-center justify-center shrink-0 shadow-md">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          {!collapsed && (
            <div className="truncate text-start">
              <h1 className="font-extrabold text-sm text-white tracking-wide truncate">
                {t('app_name')}
              </h1>
              <p className="text-[10px] text-emerald-400 font-mono tracking-wider font-semibold">
                {t('app_title')}
              </p>
            </div>
          )}
        </div>

        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#13315C] transition-colors cursor-pointer"
          title={collapsed ? 'توسيع القائمة' : 'تصغير القائمة'}
        >
          {collapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* Nav Tree (Hidden menu items per permission) */}
      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const hasChildren = item.children && item.children.length > 0;
          const isGroupOpen = openGroups[item.id] ?? false;

          const isChildActive = hasChildren
            ? item.children!.some((c) => location.pathname === c.path)
            : false;
          const isDirectActive = location.pathname === item.path;
          const isActive = isDirectActive || isChildActive;

          if (hasChildren && !collapsed) {
            return (
              <div key={item.id} className="space-y-0.5">
                <button
                  onClick={() => toggleGroup(item.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer',
                    isActive
                      ? 'text-white bg-[#13315C]/60'
                      : 'text-slate-300 hover:text-white hover:bg-[#13315C]/40'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-emerald-400' : 'text-slate-400')} />
                    <span>{t(item.titleKey as Parameters<typeof t>[0])}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {item.badgeCount && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-[#0FA37F]/20 text-emerald-400 border border-[#0FA37F]/30 font-mono">
                        {item.badgeCount}
                      </span>
                    )}
                    <ChevronDown
                      className={cn('w-3.5 h-3.5 text-slate-400 transition-transform duration-200', isGroupOpen && 'rotate-180')}
                    />
                  </div>
                </button>

                {isGroupOpen && (
                  <div className="ps-8 pe-2 py-1 space-y-0.5 border-s border-[#13315C] ms-5 my-0.5">
                    {item.children!.map((sub) => {
                      const isSubActive = location.pathname === sub.path;
                      return (
                        <NavLink
                          key={sub.id}
                          to={sub.path}
                          className={cn(
                            'flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-all font-medium',
                            isSubActive
                              ? 'bg-[#0FA37F] text-white font-bold shadow-sm'
                              : 'text-slate-300 hover:text-white hover:bg-[#13315C]/40'
                          )}
                        >
                          <span className="truncate">{t(sub.titleKey as Parameters<typeof t>[0])}</span>
                          {sub.badgeCount && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-white/20 text-white font-mono">
                              {sub.badgeCount}
                            </span>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          // Single item or collapsed mode
          return (
            <NavLink
              key={item.id}
              to={hasChildren && item.children ? item.children[0].path : item.path}
              title={t(item.titleKey as Parameters<typeof t>[0])}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all',
                isActive
                  ? 'bg-[#0FA37F] text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-[#13315C]/50',
                collapsed && 'justify-center px-0'
              )}
            >
              <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-white' : 'text-slate-400')} />
              {!collapsed && (
                <div className="flex-1 flex items-center justify-between overflow-hidden">
                  <span className="truncate">{t(item.titleKey as Parameters<typeof t>[0])}</span>
                  {item.badgeCount && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white/20 text-white font-mono">
                      {item.badgeCount}
                    </span>
                  )}
                </div>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* Sidebar Footer with Offline indicator & Project rules quick link */}
      <div className="p-3 border-t border-[#13315C] space-y-2">
        <NavLink
          to="/rules"
          className={cn(
            'flex items-center gap-2.5 p-2 rounded-xl text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all',
            collapsed && 'justify-center p-2'
          )}
          title="ملف قواعد المشروع (PROJECT_RULES.md)"
        >
          <FileCode className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="truncate">PROJECT_RULES.md</span>}
        </NavLink>

        <div
          className={cn(
            'flex items-center gap-2 text-[10px] text-slate-400 px-2 py-1',
            collapsed && 'justify-center px-0'
          )}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          {!collapsed && <span className="truncate font-medium">{t('offline_mode')}</span>}
        </div>
      </div>
    </aside>
  );
};
