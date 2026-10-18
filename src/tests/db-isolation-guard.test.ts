import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Guard Invariant: DB Test Suite Isolation', () => {
  const rootDir = process.cwd();

  it('Invariant: package.json default "test" script does NOT run the DB suite', () => {
    const pkgPath = path.join(rootDir, 'package.json');
    expect(fs.existsSync(pkgPath)).toBe(true);

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
      scripts: Record<string, string>;
    };

    const testScript = pkg.scripts.test;
    expect(testScript).toBeDefined();

    // Default test script must NOT mention vitest.db.config.ts, tests-db, or test:db
    expect(testScript).not.toContain('vitest.db.config.ts');
    expect(testScript).not.toContain('tests-db');
    expect(testScript).not.toContain('test:db');

    // Dedicated DB script must exist
    expect(pkg.scripts['test:db']).toBeDefined();
    expect(pkg.scripts['test:db']).toContain('vitest.db.config.ts');
  });

  it('Invariant: vitest.config.ts strictly excludes /src/tests-db/**', () => {
    const configPath = path.join(rootDir, 'vitest.config.ts');
    expect(fs.existsSync(configPath)).toBe(true);

    const configContent = fs.readFileSync(configPath, 'utf8');

    // Ensure exclude array contains 'src/tests-db/**'
    expect(configContent).toMatch(/exclude:\s*\[[^\]]*['"]src\/tests-db\/\*\*['"]/);

    // Ensure include array does not target tests-db
    expect(configContent).not.toMatch(/include:\s*\[[^\]]*['"]src\/tests-db/);
  });

  it('Invariant: no file in the default test project imports from /src/tests-db or imports pg', () => {
    const testsDir = path.join(rootDir, 'src/tests');
    const files = fs.readdirSync(testsDir).filter((f) => f.endsWith('.ts'));

    for (const file of files) {
      if (file === 'db-isolation-guard.test.ts') continue;

      const fullPath = path.join(testsDir, file);
      const content = fs.readFileSync(fullPath, 'utf8');

      // Must not import from tests-db
      expect(
        content.includes('tests-db'),
        `File ${file} in default project must not import from tests-db`
      ).toBe(false);

      // Must not directly import 'pg' in client/in-memory unit tests
      expect(
        content.includes("from 'pg'") || content.includes('from "pg"'),
        `File ${file} in default project must not import pg driver`
      ).toBe(false);
    }
  });

  it('Invariant: vitest.db.config.ts is configured as an isolated sequential suite with long timeouts', () => {
    const dbConfigPath = path.join(rootDir, 'vitest.db.config.ts');
    expect(fs.existsSync(dbConfigPath)).toBe(true);

    const dbConfigContent = fs.readFileSync(dbConfigPath, 'utf8');

    expect(dbConfigContent).toContain('src/tests-db/**/*.test.ts');
    expect(dbConfigContent).toContain('fileParallelism: false');
    expect(dbConfigContent).toMatch(/testTimeout:\s*\d+/);
  });
});
