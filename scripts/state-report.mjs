#!/usr/bin/env node

/**
 * State Report Generator
 * Reads src/app/routeStatus.ts and src/app/routes.tsx to generate /docs/STATE.md
 * Truthfully reports implemented pages vs. placeholder routes, as well as features not yet implemented.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const routeStatusPath = path.join(rootDir, 'src', 'app', 'routeStatus.ts');
const routesPath = path.join(rootDir, 'src', 'app', 'routes.tsx');
const docsDir = path.join(rootDir, 'docs');
const stateMdPath = path.join(docsDir, 'STATE.md');

// 1. Read routeStatus.ts and extract NOT_IMPLEMENTED_ROUTES
const routeStatusContent = fs.readFileSync(routeStatusPath, 'utf-8');
const notImplementedMatch = routeStatusContent.match(/export const NOT_IMPLEMENTED_ROUTES = \[([^\]]+)\]/s);

const notImplementedList = [];
if (notImplementedMatch) {
  const rawList = notImplementedMatch[1];
  const stringMatches = rawList.matchAll(/['"]([^'"]+)['"]/g);
  for (const m of stringMatches) {
    notImplementedList.push(m[1]);
  }
}

// 2. Read routes.tsx and extract route definitions
const routesContent = fs.readFileSync(routesPath, 'utf-8');

// Match every <Route ... /> or <Route ...>...</Route>
// We can find all occurrences of `<Route` and parse until the tag is closed or next route
const routeTagRegex = /<Route\b([\s\S]*?)(?:\/>|<\/Route>|(?=<Route\b))/g;
const foundRoutes = [];

let match;
while ((match = routeTagRegex.exec(routesContent)) !== null) {
  const block = match[1];

  // Extract path or index
  let routePath = null;
  const pathMatch = block.match(/path=["']([^"']+)["']/);
  const isIndex = /\bindex\b/.test(block);

  if (pathMatch) {
    routePath = pathMatch[1].startsWith('/') ? pathMatch[1] : '/' + pathMatch[1];
  } else if (isIndex) {
    routePath = '/';
  }

  if (!routePath || routePath === '/*' || routePath === '/') {
    // If index or root, check if it's the AppLayout container
    if (routePath === '/' && block.includes('AppLayout')) {
      continue;
    }
    if (!routePath || routePath === '/*') continue;
  }

  // Determine component name inside element={...}
  let componentName = 'Unknown';
  if (block.includes('PlaceholderPage')) {
    componentName = 'PlaceholderPage';
  } else {
    // Look for JSX components ending with Page or similar e.g. <DashboardPage
    const compMatches = [...block.matchAll(/<([A-Z][A-Za-z0-9_]+Page)\b/g)];
    if (compMatches.length > 0) {
      componentName = compMatches[compMatches.length - 1][1];
    } else {
      // Find any capitalized JSX tag inside that isn't Wrapper
      const allCompMatches = [...block.matchAll(/<([A-Z][A-Za-z0-9_]+)\b/g)];
      const filtered = allCompMatches
        .map((m) => m[1])
        .filter((c) => !['ProtectedRoute', 'DevRouteWrapper', 'Suspense', 'Routes', 'Route'].includes(c));
      if (filtered.length > 0) {
        componentName = filtered[0];
      }
    }
  }

  const isPlaceholder =
    componentName === 'PlaceholderPage' ||
    notImplementedList.some((p) => p === routePath || (p !== '/admin' && routePath.startsWith(p + '/')));

  foundRoutes.push({
    path: routePath,
    component: componentName,
    status: isPlaceholder ? 'PLACEHOLDER' : 'IMPLEMENTED',
  });
}

// Helper to determine module name based on route path
function getModuleCategory(p) {
  if (p === '/' || p === '/home' || p === '/login' || p === '/change-password' || p === '/about' || p === '/rules') {
    return 'Core & Authentication';
  }
  if (p.startsWith('/procurement')) {
    return 'Procurement (MM-PUR)';
  }
  if (p.startsWith('/inventory') || p.startsWith('/warehouse')) {
    return 'Inventory & Warehouse (MM-IM / WM)';
  }
  if (p.startsWith('/fleet')) {
    return 'Fleet Management (TM / PM)';
  }
  if (p.startsWith('/assets')) {
    return 'Asset Management (FI-AA)';
  }
  if (p.startsWith('/finance') || p.startsWith('/controlling') || p.startsWith('/accounts-')) {
    return 'Finance & Controlling (FI / CO)';
  }
  if (p.startsWith('/master-data')) {
    return 'Master Data Hub';
  }
  if (p.startsWith('/reports')) {
    return 'Reports Center (BI)';
  }
  if (p.startsWith('/admin') || p === '/diagnostics') {
    return 'Administration & System (ADM / SYS)';
  }
  return 'System & Utility';
}

// Group routes by module
const grouped = new Map();
for (const r of foundRoutes) {
  const category = getModuleCategory(r.path);
  if (!grouped.has(category)) {
    grouped.set(category, []);
  }
  // Deduplicate by path
  if (!grouped.get(category).some((existing) => existing.path === r.path)) {
    grouped.get(category).push(r);
  }
}

// Build Markdown
let md = `# Gulf Energy ERP — Implementation State Report

Generated automatically by \`scripts/state-report.mjs\` based on \`src/app/routeStatus.ts\` and \`src/app/routes.tsx\`.

---

## Route Implementation Matrix

`;

let totalRoutes = 0;
let implementedCount = 0;
let placeholderCount = 0;

for (const [category, routes] of grouped.entries()) {
  md += `### ${category}\n\n`;
  md += `| Route Path | Component | Status |\n`;
  md += `| :--- | :--- | :--- |\n`;

  for (const r of routes) {
    totalRoutes++;
    if (r.status === 'IMPLEMENTED') implementedCount++;
    else placeholderCount++;

    const badge = r.status === 'IMPLEMENTED' ? '✅ **IMPLEMENTED**' : '⏳ *PLACEHOLDER*';
    md += `| \`${r.path}\` | \`${r.component}\` | ${badge} |\n`;
  }
  md += '\n';
}

md += `### Summary\n\n`;
md += `- **Total Registered Routes**: ${totalRoutes}\n`;
md += `- **Implemented Routes**: ${implementedCount}\n`;
md += `- **Placeholder Routes**: ${placeholderCount}\n\n`;

md += `---

## Not implemented yet

The following capabilities and components are explicitly planned but not implemented yet in the current version of the application:

1. **Procurement**:
   - Purchase Requisitions (\`/procurement/pr\`)
   - Requests for Quotation (\`/procurement/rfq\`)
   - Purchase Orders (\`/procurement/po\`)
   - Procurement Contracts (\`/procurement/contracts\`)
   *(Currently registered as UI placeholders using \`PlaceholderPage\`)*

2. **Admin users/roles/audit viewer/settings**:
   - Administrative User Management (\`/admin/users\`)
   - Role Authorization Matrix (\`/admin/roles\`)
   - System Audit Log Viewer (\`/admin/audit\`)
   - System Configuration Settings (\`/admin/settings\`)
   *(Currently registered as UI placeholders using \`PlaceholderPage\`)*

3. **Audit hash chain**:
   - While append-only audit logging and centralized credential redaction are active in \`AuditService\`, cryptographic hash-chaining across sequential audit log entries is not yet implemented.

4. **Electron packaging**:
   - Desktop packaging files (\`electron/main.cjs\` and \`electron/preload.cjs\`) are currently empty stubs; desktop packaging, auto-update, and native packaging installers are not yet implemented.

5. **Multi-user sync**:
   - The application runs 100% offline within the browser IndexedDB environment; multi-user peer-to-peer or server-mediated database synchronization is not yet implemented.
`;

if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

fs.writeFileSync(stateMdPath, md, 'utf-8');
console.log(`Successfully generated ${stateMdPath} (${totalRoutes} routes processed: ${implementedCount} implemented, ${placeholderCount} placeholder).`);
