#!/usr/bin/env node

/**
 * Postinstall check: compares this package's version against the version
 * frontmatter in ~/.agents/skills/{score,tailor}/SKILL.md.
 * If skills are older, prints a boxed update notification.
 * Never throws — wrapped in try/catch so installs always succeed.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

try {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const root = join(__dirname, '..');

  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const packageVersion = pkg.version;

  // Don't check during development
  if (packageVersion === '0.0.0-development') process.exit(0);

  const skillNames = ['score', 'tailor'];
  const skillsRoot = join(homedir(), '.agents', 'skills');

  let installedVersion = null;

  for (const name of skillNames) {
    const skillFile = join(skillsRoot, name, 'SKILL.md');
    let content;
    try {
      content = readFileSync(skillFile, 'utf8');
    } catch {
      // Skill not installed — nothing to check
      continue;
    }

    const match = content.match(/^version:\s*(.+)$/m);
    if (!match) continue;

    const skillVersion = match[1].trim();
    if (skillVersion === '0.0.0-development') continue;

    // Use the first skill version we find
    if (!installedVersion) {
      installedVersion = skillVersion;
    }
  }

  // No installed skills or no version found — nothing to do
  if (!installedVersion) process.exit(0);

  // Versions match — nothing to do
  if (installedVersion === packageVersion) process.exit(0);

  // Simple semver comparison: split on dots, compare numerically
  const parse = (v) => v.split('.').map(Number);
  const installed = parse(installedVersion);
  const current = parse(packageVersion);

  let isOlder = false;
  for (let i = 0; i < 3; i++) {
    if ((installed[i] || 0) < (current[i] || 0)) { isOlder = true; break; }
    if ((installed[i] || 0) > (current[i] || 0)) break;
  }

  if (!isOlder) process.exit(0);

  // Print boxed notification
  const line1 = '  @getkrafter/resume-toolkit skill update';
  const line2 = `  Installed skills: ${installedVersion}`;
  const line3 = `  Package version:  ${packageVersion}`;
  const line4 = '  Run to update:';
  const line5 = '  npx skills add @getkrafter/resume-toolkit';

  const lines = ['', line1, '', line2, line3, '', line4, line5, ''];
  const width = Math.max(...lines.map((l) => l.length)) + 2;

  const pad = (s) => s + ' '.repeat(width - s.length);

  console.log();
  console.log(`\u250C${'─'.repeat(width)}\u2510`);
  for (const l of lines) {
    console.log(`\u2502${pad(l)}\u2502`);
  }
  console.log(`\u2514${'─'.repeat(width)}\u2518`);
  console.log();
} catch {
  // Never fail — this is a best-effort notification
}
