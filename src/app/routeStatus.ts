// Remove a path from this list when its real page replaces PlaceholderPage.
export const NOT_IMPLEMENTED_ROUTES = [
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
] as const;

/**
 * Checks whether a given route path is implemented or registered as an unimplemented placeholder.
 * Handles exact matches as well as child-of matches for listed prefixes (such as /admin/users/*).
 */
export function isRouteImplemented(path: string): boolean {
  if (!path) return false;
  // Normalize path (strip queries, hashes, and trailing slash)
  const cleanPath = path.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';

  for (const route of NOT_IMPLEMENTED_ROUTES) {
    if (cleanPath === route) {
      return false;
    }
    // Child-of match:
    // If the listed route is not a top-level hub with implemented siblings (like '/admin'),
    // any sub-path of that listed route is considered unimplemented.
    // Specifically: if route is '/admin', we do not match other /admin/* subpages like /admin/approvals.
    // For specific sub-prefixes like '/admin/users' or '/procurement', any child is unimplemented.
    if (route !== '/admin' && cleanPath.startsWith(route + '/')) {
      return false;
    }
  }

  return true;
}

/**
 * Evaluates whether developer / demo routes (/admin/dev, /rules) should render or behave as NotFound.
 * Render ONLY when demo mode is enabled AND user has SYS_VIEW (ADMIN role).
 */
export function getDevRouteDecision(
  isDemoMode: boolean,
  hasSysView: boolean
): 'render' | 'not-found' {
  if (isDemoMode && hasSysView) {
    return 'render';
  }
  return 'not-found';
}

export function canAccessDevRoute(isDemoMode: boolean, hasSysView: boolean): boolean {
  return isDemoMode && hasSysView;
}
