#!/usr/bin/env node
import { startServer } from '../mcp/server.js';
import { parseRawText } from '../lib/resume-parser.js';
import { scoreResume } from '../lib/resume-scorer.js';
import { scoreATS } from '../lib/ats-scorer.js';

const args = process.argv.slice(2);
const command = args[0];

if (command === 'score') {
  const resumeFile = getFlag(args, '--resume');
  const jdFile = getFlag(args, '--jd');

  if (!resumeFile) {
    console.error('Usage: resume-toolkit score --resume <file> [--jd <file>]');
    process.exit(1);
  }

  const fs = await import('node:fs');
  const resumeText = fs.readFileSync(resumeFile, 'utf-8');
  const jdText = jdFile ? fs.readFileSync(jdFile, 'utf-8') : undefined;

  const resumeData = parseRawText(resumeText);
  const result = scoreResume(resumeData, jdText);
  console.log(JSON.stringify(result, null, 2));
} else if (command === 'ats') {
  const resumeFile = getFlag(args, '--resume');
  const jdFile = getFlag(args, '--jd');

  if (!resumeFile || !jdFile) {
    console.error('Usage: resume-toolkit ats --resume <file> --jd <file>');
    process.exit(1);
  }

  const fs = await import('node:fs');
  const resumeText = fs.readFileSync(resumeFile, 'utf-8');
  const jdText = fs.readFileSync(jdFile, 'utf-8');

  const result = scoreATS(resumeText, jdText);
  console.log(JSON.stringify(result, null, 2));
} else {
  // Default: start MCP server
  startServer();
}

function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}
