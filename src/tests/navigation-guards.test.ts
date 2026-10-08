import { describe, it, expect } from 'vitest';
import {
  NOT_IMPLEMENTED_ROUTES,
  isRouteImplemented,
  getDevRouteDecision,
  canAccessDevRoute,
} from '../app/routeStatus';
import { TCodeService } from '../core/services/TCodeService';
import {
  buildVisibleNavigation,
  filterSidebarItems,
  navigationConfig,
  NavItemWithModule,
} from '../components/layout/Sidebar';
import { SYSTEM_ROLES } from '../core/services/RbacService';
import type { Role, ModuleCode } from '../types/models';
import { ShoppingCart, Boxes } from 'lucide-react';

describe('Navigation Guards & Route Implementation Tests', () => {
  const adminRole: Role = {
    id: 'r-admin',
    code: SYSTEM_ROLES.ADMIN,
    name: 'مدير النظام',
    description: 'Superuser',
    permissionCodes: ['*'],
    isSystem: true,
  };

  const viewerRole: Role = {
    id: 'r-viewer',
    code: SYSTEM_ROLES.VIEWER,
    name: 'مستعرض فقط',
    description: 'Viewer',
    permissionCodes: ['MM_VIEW', 'WM_VIEW', 'TM_VIEW', 'AM_VIEW', 'FI_VIEW', 'MD_VIEW'],
    isSystem: true,
  };

  // 1. isRouteImplemented specification
  describe('isRouteImplemented()', () => {
    it('returns false for exact matches in NOT_IMPLEMENTED_ROUTES', () => {
      expect(NOT_IMPLEMENTED_ROUTES).toEqual([
        '/procurement',
        '/procurement/pr',
        '/procurement/rfq',
        '/procurement/po',
        '/procurement/contracts',
        '/admin',
        '/admin/users',
        '/admin/roles',
        '/admin/audit',
        '/admin/settings',
      ]);

      for (const route of NOT_IMPLEMENTED_ROUTES) {
        expect(isRouteImplemented(route)).toBe(false);
      }
    });

    it('returns false for child-of matches for listed prefixes', () => {
      expect(isRouteImplemented('/procurement/po/PO-2026-0001')).toBe(false);
      expect(isRouteImplemented('/procurement/pr/PR-2026-999')).toBe(false);
      expect(isRouteImplemented('/procurement/contracts/CNT-101')).toBe(false);
      expect(isRouteImplemented('/procurement/tenders')).toBe(false);
      expect(isRouteImplemented('/admin/users/u-new')).toBe(false);
      expect(isRouteImplemented('/admin/roles/r-custom')).toBe(false);
      expect(isRouteImplemented('/admin/audit/export')).toBe(false);
      expect(isRouteImplemented('/admin/settings/company')).toBe(false);
    });

    it('returns true for genuinely implemented routes', () => {
      expect(isRouteImplemented('/')).toBe(true);
      expect(isRouteImplemented('/inventory')).toBe(true);
      expect(isRouteImplemented('/inventory/stock')).toBe(true);
      expect(isRouteImplemented('/master-data/materials')).toBe(true);
      expect(isRouteImplemented('/fleet/vehicles')).toBe(true);
      expect(isRouteImplemented('/assets/register')).toBe(true);
      expect(isRouteImplemented('/finance/journal')).toBe(true);
      expect(isRouteImplemented('/change-password')).toBe(true);
      expect(isRouteImplemented('/notifications')).toBe(true);

      // Implemented admin pages must return true
      expect(isRouteImplemented('/admin/approvals')).toBe(true);
      expect(isRouteImplemented('/admin/workflow')).toBe(true);
      expect(isRouteImplemented('/admin/backup')).toBe(true);
      expect(isRouteImplemented('/admin/diagnostics')).toBe(true);
      expect(isRouteImplemented('/admin/print-templates')).toBe(true);
      expect(isRouteImplemented('/about')).toBe(true);
    });
  });

  // 2. TCodeService resolution and autocomplete
  describe('TCodeService implementation filtering', () => {
    it('returns clear Arabic unavailable error for ME21N and ME51N', () => {
      const resPO = TCodeService.resolveCode('ME21N', adminRole);
      expect(resPO.success).toBe(false);
      expect(resPO.error).toBe('هذه الشاشة غير متاحة بعد في هذا الإصدار');

      const resPR = TCodeService.resolveCode('ME51N', adminRole);
      expect(resPR.success).toBe(false);
      expect(resPR.error).toBe('هذه الشاشة غير متاحة بعد في هذا الإصدار');
    });

    it('still resolves and navigates implemented T-codes such as MM03', () => {
      const resMM03 = TCodeService.resolveCode('MM03', adminRole);
      expect(resMM03.success).toBe(true);
      expect(resMM03.targetPath).toBe('/masterdata/materials');
      expect(resMM03.code?.code).toBe('MM03');
    });

    it('omits unimplemented codes from autocomplete searchCodes', () => {
      const results = TCodeService.searchCodes('ME21N', adminRole);
      expect(results.some((r) => r.code === 'ME21N')).toBe(false);

      const prResults = TCodeService.searchCodes('ME51N', adminRole);
      expect(prResults.some((r) => r.code === 'ME51N')).toBe(false);

      const mm03Results = TCodeService.searchCodes('MM03', adminRole);
      expect(mm03Results.some((r) => r.code === 'MM03')).toBe(true);
    });
  });

  // 3. Sidebar pure model builder
  describe('Sidebar buildVisibleNavigation() pure filtering', () => {
    const mockCanAll = () => true;

    it('completely omits a group header if all of its children are hidden', () => {
      const sampleItems: NavItemWithModule[] = [
        {
          id: 'procurement',
          path: '/procurement',
          titleKey: 'nav_procurement',
          icon: ShoppingCart,
          requiredModule: 'MM',
          children: [
            { id: 'pr', path: '/procurement/pr', titleKey: 'nav_pr' },
            { id: 'po', path: '/procurement/po', titleKey: 'nav_po' },
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
          ],
        },
      ];

      const visible = buildVisibleNavigation(sampleItems, mockCanAll, false);
      expect(visible.some((i) => i.id === 'procurement')).toBe(false);
      expect(visible.some((i) => i.id === 'inventory')).toBe(true);
    });

    it('keeps a group with mixed children, omitting only unimplemented ones', () => {
      const visible = buildVisibleNavigation(navigationConfig, mockCanAll, false);

      const adminGroup = visible.find((i) => i.id === 'admin');
      expect(adminGroup).toBeDefined();

      const adminChildPaths = adminGroup!.children?.map((c) => c.path) || [];
      expect(adminChildPaths).not.toContain('/admin/users');
      expect(adminChildPaths).not.toContain('/admin/roles');
      expect(adminChildPaths).not.toContain('/admin/audit');
      expect(adminChildPaths).not.toContain('/admin/settings');
      expect(adminChildPaths).not.toContain('/admin/dev'); // excluded in production (non-demo)

      expect(adminChildPaths).toContain('/admin/backup');
      expect(adminChildPaths).toContain('/admin/workflow');
      expect(adminChildPaths).toContain('/admin/print-templates');
      expect(adminChildPaths).toContain('/admin/diagnostics');
      expect(adminChildPaths).toContain('/about');
    });

    it('includes /admin/dev in navigation only when isDemoMode is true and user has permission', () => {
      const navProd = filterSidebarItems(navigationConfig, mockCanAll, false);
      const adminGroupProd = navProd.find((i) => i.id === 'admin');
      expect(adminGroupProd?.children?.some((c) => c.path === '/admin/dev')).toBe(false);

      const navDemo = filterSidebarItems(navigationConfig, mockCanAll, true);
      const adminGroupDemo = navDemo.find((i) => i.id === 'admin');
      expect(adminGroupDemo?.children?.some((c) => c.path === '/admin/dev')).toBe(true);
    });
  });

  // 4. Developer route access decision function
  describe('Developer route decision function', () => {
    it('returns not-found when demo flag is false', () => {
      expect(getDevRouteDecision(false, true)).toBe('not-found');
      expect(getDevRouteDecision(false, false)).toBe('not-found');
      expect(canAccessDevRoute(false, true)).toBe(false);
      expect(canAccessDevRoute(false, false)).toBe(false);
    });

    it('returns not-found when demo flag is true but user lacks SYS_VIEW', () => {
      expect(getDevRouteDecision(true, false)).toBe('not-found');
      expect(canAccessDevRoute(true, false)).toBe(false);
    });

    it('returns render only when demo flag is true AND user has SYS_VIEW', () => {
      expect(getDevRouteDecision(true, true)).toBe('render');
      expect(canAccessDevRoute(true, true)).toBe(true);
    });
  });
});
