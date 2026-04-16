#!/usr/bin/env node

// Stamps the current package.json version into every skills/*/SKILL.md frontmatter.
// Runs as prepublishOnly so the npm tarball contains real versions, not "0.0.0-development".

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const version = pkg.version;

const skillsDir = join(root, 'skills');
const entries = readdirSync(skillsDir);

let stamped = 0;

for (const entry of entries) {
  const skillFile = join(skillsDir, entry, 'SKILL.md');
  try {
    if (!statSync(skillFile).isFile()) continue;
  } catch {
    continue;
  }

  let content = readFileSync(skillFile, 'utf8');
  const updated = content.replace(
    /^(version:\s*).+$/m,
    `$1${version}`
  );

  if (updated !== content) {
    writeFileSync(skillFile, updated);
    stamped++;
    console.log(`Stamped ${entry}/SKILL.md -> ${version}`);
  }
}

if (stamped === 0) {
  console.log('No SKILL.md files needed version stamping.');
} else {
  console.log(`Done. Stamped ${stamped} skill(s) with version ${version}.`);
}
