import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Guard Invariant: Zero Hardcoded / Fictional User Fallbacks in Production Code (C7)', () => {
  const srcDir = path.resolve(process.cwd(), 'src');

  const FORBIDDEN_ACTOR_LITERALS = [
    'u-wh-clerk',
    'usr-admin-1',
    'usr-cfo-1',
  ];

  function getAllSourceFiles(dir: string, fileList: string[] = []): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        getAllSourceFiles(fullPath, fileList);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        fileList.push(fullPath);
      }
    }
    return fileList;
  }

  it('Production code in src/modules, src/core, src/pages, and src/components contains ZERO forbidden actor literals', () => {
    const allFiles = getAllSourceFiles(srcDir);

    // Production target subdirectories: modules, core, pages, components
    const prodFiles = allFiles.filter((filePath) => {
      const rel = path.relative(srcDir, filePath);
      const isTest = rel.includes('test');
      const isSeed = rel.startsWith('seed');
      return !isTest && !isSeed;
    });

    const violations: { file: string; line: number; literal: string; text: string }[] = [];

    for (const file of prodFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');

      lines.forEach((lineText, idx) => {
        for (const literal of FORBIDDEN_ACTOR_LITERALS) {
          if (lineText.includes(literal)) {
            violations.push({
              file: path.relative(srcDir, file),
              line: idx + 1,
              literal,
              text: lineText.trim(),
            });
          }
        }
      });
    }

    expect(
      violations,
      `Detected hardcoded fictional actors in production code:\n${violations
        .map((v) => `  - ${v.file}:${v.line} matched "${v.literal}" -> ${v.text}`)
        .join('\n')}`
    ).toEqual([]);
  });

  it('No production UI modal or service uses default fallback operator to fictional user', () => {
    const allFiles = getAllSourceFiles(srcDir);
    const prodFiles = allFiles.filter((filePath) => {
      const rel = path.relative(srcDir, filePath);
      return !rel.includes('test') && !rel.startsWith('seed');
    });

    const regex = /user\?\.id\s*\|\|\s*['"][^'"]+['"]/g;
    const fallbackViolations: string[] = [];

    for (const file of prodFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const matches = content.match(regex);
      if (matches) {
        fallbackViolations.push(`${path.relative(srcDir, file)}: ${matches.join(', ')}`);
      }
    }

    expect(
      fallbackViolations,
      `Found user?.id || '...' fallback patterns in production code:\n${fallbackViolations.join('\n')}`
    ).toEqual([]);
  });
});
