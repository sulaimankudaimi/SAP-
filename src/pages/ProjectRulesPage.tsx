import { DiagnosticLogger } from '../core/services/DiagnosticLogger';
import React from 'react';
import { Card } from '../components/ui/Card';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { StatusChip } from '../components/ui/Badge';
import { FileCode, CheckCircle2, ShieldCheck, Download } from 'lucide-react';
import { Button } from '../components/ui/Button';

import { saveFileUniversal } from '../core/utils/fileDownloader';

export const ProjectRulesPage: React.FC = () => {
  const rulesContent = `ROLE
You are a Principal Software Architect and Senior Full-Stack Engineer who has implemented SAP S/4HANA (MM, WM, FI/CO, AM, PM) and builds enterprise desktop apps. You write production-grade, strictly typed, modular code.

PRODUCT
"Gulf Energy ERP" — a custom ERP for Oil & Gas / energy-logistics companies, structured like SAP (modules, master data, transaction documents, document flow, posting to accounting, authorization objects, change documents). It will ship as a Windows desktop app (Electron) and MUST work 100% offline.

TECH STACK (fixed, do not deviate)
- React 18 + TypeScript (strict) + Vite
- Tailwind CSS (with CSS variables for design tokens)
- React Router using HashRouter (required for Electron file://)
- Zustand for state; TanStack Table for grids; Recharts for charts; lucide-react for icons
- react-hook-form + zod for forms/validation
- Dexie (IndexedDB) behind a Repository interface (so it can later be swapped for SQLite)
- date handling: date-fns; numbers via Intl.NumberFormat('en-US') (use Western digits 0-9 everywhere)
- NO external network calls, NO CDN assets, NO remote images, NO map tiles. Fonts bundled locally (@fontsource/ibm-plex-sans-arabic). Illustrations = inline SVG/CSS.
- NO localStorage for business data (only UI prefs).

LANGUAGE & LAYOUT
- All UI text in Arabic; <html dir="rtl" lang="ar">. Use logical CSS properties (ms-/me-/ps-/pe-, start/end), never left/right.
- Centralize all strings in /src/i18n/ar.ts (key → Arabic) and use a t() helper. Code, identifiers, comments in English.
- Charts, tables, forms, and dropdowns must all be RTL-correct. Currency default: SAR (ريال), configurable.

DESIGN SYSTEM (strict)
- Reference style: clean modern Arabic SaaS dashboards (white cards on very light blue-gray background).
- Tokens: --bg:#F4F7FB; --card:#FFFFFF; --navy:#0B2545 (sidebar/primary dark); --navy-2:#13315C; --primary:#0FA37F (emerald/teal for actions & positive); --blue:#2563EB; --amber:#F59E0B; --red:#EF4444; --text:#0F172A; --muted:#64748B; --border:#E5EAF2.
- Cards: radius 16px, 1px border, shadow 0 1px 3px rgba(15,23,42,.06); spacing scale 4/8/12/16/24; page padding 24px.
- Typography: IBM Plex Sans Arabic; sizes 12/14/16/20/28; weights 400/500/700.
- Status chips: green=approved/completed, amber=in review/pending, red=rejected/critical, blue=in progress, gray=draft/closed.
- Every screen must have: loading skeleton, empty state, error state, and responsive behavior down to 1280px width.

ARCHITECTURE RULES
- Folder structure: /src/app, /src/core (db, repositories, services, numbering, audit, auth, rbac), /src/modules/{procurement,inventory,fleet,assets,finance,reports,admin}, /src/components/ui, /src/components/layout, /src/i18n, /src/types, /src/seed.
- Business logic lives in services (pure TS), never inside components. Components only call services/hooks.
- Every transaction document has: id, docNumber (auto, per-type, per-year), status, createdBy, createdAt, updatedBy, updatedAt, version.
- Every create/update/delete/status change writes an AuditLog entry (userId, action, entity, entityId, before, after, timestamp).
- Every action is guarded by permission checks (RBAC) both in UI (hide/disable) and in services (throw).
- Never use any. Never leave TODO/placeholder/pseudo code. Never mock a feature with a non-functional button.

WORKING PROTOCOL
- Implement ONLY what the current prompt asks. Do not refactor unrelated files.
- Before coding, output a short PLAN (files to create/change). After coding, output a CHECKLIST of the acceptance criteria and mark each as done.
- If something is ambiguous, choose the SAP-standard behavior and state the assumption in one line; do not stop to ask.
- Keep the app compiling and runnable after every response.`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 text-start">
          <Breadcrumbs items={[{ label: 'الرئيسية', path: '/' }, { label: 'ملف قواعد ومحددات المشروع' }]} />
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
              وثيقة القواعد والمحددات المعمارية الملزمة
            </h1>
            <StatusChip variant="approved">
              Binding Rules
            </StatusChip>
          </div>
          <p className="text-xs text-[#64748B]">
            مسار الملف الجذري: <code className="font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">/PROJECT_RULES.md</code>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="w-4 h-4" />}
            onClick={() => {
              saveFileUniversal('PROJECT_RULES.md', rulesContent, [
                { name: 'Markdown Document (*.md)', extensions: ['md'] },
              ]).catch((err: unknown) => { DiagnosticLogger.error('ProjectRulesPage', 'Operation failed', err); });
            }}
          >
            تحميل نسخة MD
          </Button>
        </div>
      </div>

      <Card
        header={
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#0FA37F]" />
            <span className="font-bold text-sm text-[#0F172A]">نص القواعد المعتمد حرفياً (Verbatim Invariant)</span>
          </div>
        }
      >
        <div className="space-y-4 text-start">
          <div className="p-3 bg-[#0FA37F]/10 border border-[#0FA37F]/20 rounded-xl text-xs text-[#0FA37F] font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>يتم قراءة هذا الملف والالتزام ببنوده بشكل صارم قبل كل استجابة وتعديل برمجي في المشروع.</span>
          </div>

          <pre className="p-6 bg-slate-900 text-slate-100 rounded-2xl font-mono text-xs overflow-x-auto leading-relaxed whitespace-pre-wrap selection:bg-[#0FA37F]">
            {rulesContent}
          </pre>
        </div>
      </Card>
    </div>
  );
};
