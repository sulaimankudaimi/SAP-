import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { AuthService } from '../core/services/AuthService';

/**
 * Static Architectural & Security Guard Tests
 *
 * Scans codebase files directly via fs to prevent silent regression
 * of security, typing, and architectural requirements.
 */

const SRC_DIR = path.resolve(__dirname, '..');

// Helper to recursively collect all source files under a directory
function getAllFiles(dir: string, extensions: string[] = ['.ts', '.tsx']): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }

  return files;
}

describe('Static Security & Architecture Guards', () => {
  const allSrcFiles = getAllFiles(SRC_DIR);

  // ---------------------------------------------------------------------------
  // Guard 1: Forbidden legacy tokens, pseudo-users, any types, and console.log
  // ---------------------------------------------------------------------------
  describe('1. Forbidden tokens & Strict typing check', () => {
    // Constructed via array joins so this test file itself does not match
    const FORBIDDEN_RULES = [
      {
        name: 'DEFAULT' + '_ADMIN',
        matcher: (line: string) => line.includes(['DEFAULT', 'ADMIN'].join('_')),
        description: 'Hardcoded DEFAULT_ADMIN constant or credentials',
      },
      {
        name: 'SYS' + '-AUTO',
        matcher: (line: string) => line.includes(['SYS', 'AUTO'].join('-')),
        description: 'Hardcoded pseudo-user SYS-AUTO fallback',
      },
      {
        name: ':' + ' any',
        matcher: (line: string) => /:[\t ]*any\b/.test(line),
        description: 'Unsafe explicit ": any" type annotation',
      },
      {
        name: 'as' + ' any',
        matcher: (line: string) => /\bas[\t ]+any\b/.test(line),
        description: 'Unsafe "as any" type assertion cast',
      },
      {
        name: 'console' + '.log',
        matcher: (line: string) => /\bconsole\.log\s*\(/.test(line),
        description: 'Forbidden console.log statement (use DiagnosticLogger or typed telemetry)',
      },
    ];

    it('fails if any file under /src contains DEFAULT_ADMIN, SYS-AUTO, ": any", "as any", or console.log', () => {
      const violations: { file: string; line: number; rule: string; content: string }[] = [];

      for (const filePath of allSrcFiles) {
        // Exclude guards.test.ts itself from token scanning
        if (filePath.endsWith('guards.test.ts')) continue;

        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          for (const rule of FORBIDDEN_RULES) {
            if (rule.matcher(line)) {
              violations.push({
                file: path.relative(SRC_DIR, filePath),
                line: i + 1,
                rule: rule.name,
                content: line.trim(),
              });
            }
          }
        }
      }

      if (violations.length > 0) {
        const errorReport = violations
          .map((v) => `[${v.rule}] ${v.file}:${v.line} -> ${v.content}`)
          .join('\n');
        expect.fail(`Detected ${violations.length} forbidden token violation(s):\n${errorReport}`);
      }

      expect(violations).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Guard 2: Web Storage (localStorage / sessionStorage) key isolation
  // ---------------------------------------------------------------------------
  describe('2. Web Storage Security Guard', () => {
    /**
     * DOCUMENTED ALLOWED STORAGE EXCEPTION:
     * Key: 'gulf_fb_otp'
     * Storage: sessionStorage only
     * Location: src/core/security/FirstBootSecret.ts
     * Rationale:
     *   On initial first-boot before the administrator's first login, a random 16-character
     *   one-time password (OTP) is generated. To prevent the user from being locked out if they
     *   refresh the browser tab before completing login, the OTP is stored in memory and mirrored
     *   transiently in sessionStorage. It is NEVER written to persistent IndexedDB or localStorage,
     *   and is purged immediately upon successful login or password change.
     */
    const ALLOWED_STORAGE_KEYS = new Set(['gulf_fb_otp']);
    const SENSITIVE_STORAGE_KEY_PATTERN = /password|hash|salt|otp/i;

    it('fails if localStorage/sessionStorage is used with a key containing password, hash, salt, or otp outside allowed FirstBootSecret key', () => {
      const storageViolations: {
        file: string;
        line: number;
        storage: string;
        keyExpression: string;
        reason: string;
      }[] = [];

      // Regex matching localStorage/sessionStorage method calls
      const storageMethodRegex = /(localStorage|sessionStorage)\.(getItem|setItem|removeItem)\s*\(\s*([^,\)]+)/g;

      for (const filePath of allSrcFiles) {
        // Exclude test mocks/stubs and guard itself
        if (filePath.endsWith('setup.ts') || filePath.endsWith('guards.test.ts')) continue;

        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        // Check constant definitions in file if keys are referenced by variable name
        const constDefs: Record<string, string> = {};
        for (const line of lines) {
          const constMatch = line.match(/(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*['"`]([^'"`]+)['"`]/);
          if (constMatch) {
            constDefs[constMatch[1]] = constMatch[2];
          }
        }

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          let match: RegExpExecArray | null;

          while ((match = storageMethodRegex.exec(line)) !== null) {
            const storageType = match[1];
            const rawKeyArg = match[3].trim();

            // Extract literal or resolve identifier
            let resolvedKey = '';
            const literalMatch = rawKeyArg.match(/^['"`]([^'"`]+)['"`]/);
            if (literalMatch) {
              resolvedKey = literalMatch[1];
            } else if (constDefs[rawKeyArg]) {
              resolvedKey = constDefs[rawKeyArg];
            } else {
              resolvedKey = rawKeyArg;
            }

            // Check if key contains sensitive keywords
            if (SENSITIVE_STORAGE_KEY_PATTERN.test(resolvedKey)) {
              // Verify whether this matches our documented FirstBootSecret exception
              const isAllowedException =
                ALLOWED_STORAGE_KEYS.has(resolvedKey) &&
                storageType === 'sessionStorage' &&
                filePath.endsWith(path.join('core', 'security', 'FirstBootSecret.ts'));

              if (!isAllowedException) {
                storageViolations.push({
                  file: path.relative(SRC_DIR, filePath),
                  line: i + 1,
                  storage: storageType,
                  keyExpression: resolvedKey,
                  reason: `Disallowed sensitive key '${resolvedKey}' accessed via ${storageType}`,
                });
              }
            }
          }
        }
      }

      if (storageViolations.length > 0) {
        const report = storageViolations
          .map((v) => `${v.file}:${v.line} [${v.storage}] key: "${v.keyExpression}" -> ${v.reason}`)
          .join('\n');
        expect.fail(`Detected sensitive storage key violations:\n${report}`);
      }

      expect(storageViolations).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Guard 3: Repository write calls security & permission context enforcement
  // ---------------------------------------------------------------------------
  describe('3. Repository Write Security Guard', () => {
    /**
     * DOCUMENTED ALLOW-LIST FOR INFRASTRUCTURE SERVICES:
     * Services that perform write operations without high-level user permissions because
     * they act as low-level infrastructure or authentication handshakes:
     *
     * 1. AuditService: Writes audit rows directly (`db.auditLogs.add`). Cannot require user session
     *    or write through repositories recursively without infinite loop.
     * 2. SecurityMigrationService: First-boot maintenance service that purges obsolete OTP keys from settings.
     *    Executes during app initialization prior to any user login.
     * 3. NumberRangeService: Document numbering sequence manager. Increments and assigns numbers
     *    during transaction processing on behalf of calling domain services.
     * 4. AuthService: Authentication state manager. Tracks failed login attempts, lockout timestamps,
     *    and password changes before/during session lifecycle. When calling userRepository.update,
     *    passes explicit ActionContext.
     * 5. NotificationService: System background notifications dispatcher.
     * 6. PrintTemplateService: Seeds default print layout templates if missing on boot.
     * 7. WorkflowService: Seeds default delegation of authority approval matrices if missing on boot.
     */
    const ALLOW_LISTED_SERVICES: Record<string, string> = {
      'AuditService.ts': 'Core audit logging infrastructure; records audit entries for all system actions.',
      'SecurityMigrationService.ts': 'First-boot maintenance migration purging legacy plaintext keys prior to login.',
      'NumberRangeService.ts': 'Low-level document numbering sequence generator for transaction documents.',
      'AuthService.ts': 'Authentication state manager; handles login attempts, account lockouts, and credentials.',
      'NotificationService.ts': 'System background notification dispatcher.',
      'PrintTemplateService.ts': 'Seeds default document print templates on initialization.',
      'WorkflowService.ts': 'Seeds default workflow approval rules on initialization.',
    };

    it('fails if a repository write call exists in a service with no requirePermission call, no explicit context argument, and is not in the documented allow-list', () => {
      // Find all service files in /src/modules/**/services and /src/core/services
      const serviceFiles = allSrcFiles.filter((fp) => {
        const normalized = fp.replace(/\\/g, '/');
        const isModuleService = /\/src\/modules\/[^\/]+\/services\/[^\/]+\.ts$/.test(normalized);
        const isCoreService = /\/src\/core\/services\/[^\/]+\.ts$/.test(normalized);
        return (isModuleService || isCoreService) && !normalized.endsWith('.test.ts');
      });

      const unverifiedWrites: {
        file: string;
        line: number;
        code: string;
        reason: string;
      }[] = [];

      const repoWriteRegex = /\b([a-zA-Z0-9_]*[rR]epository|[a-zA-Z0-9_]*Repo)\.(create|update|delete|bulkCreate)\s*\(([^;]*)/g;

      for (const filePath of serviceFiles) {
        const fileName = path.basename(filePath);
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        // Check if the file uses requirePermission
        const hasRequirePermissionImport = /requirePermission/.test(content);

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          let match: RegExpExecArray | null;

          while ((match = repoWriteRegex.exec(line)) !== null) {
            const method = match[2];
            const argsText = match[3];

            // If the service is in the documented allow-list, skip with documented rationale
            if (ALLOW_LISTED_SERVICES[fileName]) {
              continue;
            }

            // Check if call has explicit context passed as argument
            // (create takes entity, context; update takes id, patch, context; delete takes id, context; bulkCreate takes items, context)
            const argTokens = argsText.split(',').map((t) => t.trim());
            const hasContextArg =
              (method === 'create' && argTokens.length >= 2 && argTokens[1].length > 0) ||
              (method === 'update' && argTokens.length >= 3 && argTokens[2].length > 0) ||
              (method === 'delete' && argTokens.length >= 2 && argTokens[1].length > 0) ||
              (method === 'bulkCreate' && argTokens.length >= 2 && argTokens[1].length > 0);

            // Must have requirePermission call in file OR pass explicit context
            if (!hasRequirePermissionImport && !hasContextArg) {
              unverifiedWrites.push({
                file: path.relative(SRC_DIR, filePath),
                line: i + 1,
                code: line.trim(),
                reason: `Repository .${method}() call missing requirePermission and missing explicit ActionContext`,
              });
            }
          }
        }
      }

      if (unverifiedWrites.length > 0) {
        const report = unverifiedWrites
          .map((w) => `${w.file}:${w.line} -> ${w.code} (${w.reason})`)
          .join('\n');
        expect.fail(`Detected unguarded repository write call(s):\n${report}`);
      }

      expect(unverifiedWrites).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Guard 4: Legacy fixed salt isolation check
  // ---------------------------------------------------------------------------
  describe('4. Legacy Fixed Salt Isolation Guard', () => {
    it('fails if the seeder or any source contains the legacy fixed salt outside AuthService LEGACY_SALTS', () => {
      const legacySalt = AuthService.LEGACY_SALTS[0];
      expect(legacySalt).toBeDefined();

      const violations: { file: string; line: number; content: string }[] = [];

      for (const filePath of allSrcFiles) {
        // Legitimate authorized occurrences:
        // 1. AuthService.ts: Where LEGACY_SALTS is defined
        // 2. guards.test.ts: This guard test
        // 3. credentials.test.ts: Tests asserting that generated salts do NOT match legacy salt
        const normalized = filePath.replace(/\\/g, '/');
        if (
          normalized.endsWith('/core/services/AuthService.ts') ||
          normalized.endsWith('/tests/guards.test.ts') ||
          normalized.endsWith('/tests/credentials.test.ts')
        ) {
          continue;
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        if (content.includes(legacySalt)) {
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(legacySalt)) {
              violations.push({
                file: path.relative(SRC_DIR, filePath),
                line: i + 1,
                content: lines[i].trim(),
              });
            }
          }
        }
      }

      if (violations.length > 0) {
        const report = violations
          .map((v) => `${v.file}:${v.line} -> ${v.content}`)
          .join('\n');
        expect.fail(`Detected legacy fixed salt '${legacySalt}' in unauthorized file(s):\n${report}`);
      }

      expect(violations).toHaveLength(0);
    });
  });
});
