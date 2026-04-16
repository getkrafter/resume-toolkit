#!/usr/bin/env node
import { startServer } from '../mcp/server.js';
import { scoreResume } from '../lib/resume-scorer.js';
import { scoreATS } from '../lib/ats-scorer.js';
import type { ResumeData } from '../lib/types.js';

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

function parseRawText(text: string): ResumeData {
  // Strip markdown formatting for rawText
  const cleanText = text.replace(/^#+\s+/gm, '').replace(/\*+([^*]+)\*+/g, '$1');

  const lines = text.split('\n');
  const bullets: string[] = [];
  const sections: string[] = [];
  let currentSection = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect markdown headings as sections
    const headingMatch = trimmed.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) {
      const heading = headingMatch[1].replace(/\|.*$/, '').trim().toLowerCase();
      sections.push(heading);
      currentSection = heading;
      continue;
    }

    // Detect ALL CAPS or Title Case lines as sections (plain text resumes)
    if (
      trimmed.length < 50 &&
      !(/^\s*[-*•]/.test(line) || /^\s*\d+[.)]/.test(line)) &&
      (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed))
    ) {
      sections.push(trimmed.toLowerCase());
      currentSection = trimmed.toLowerCase();
      continue;
    }

    // Detect bullet points — only count as achievement bullets in work/project sections
    const isNonBulletSection = /skill|competenc|tool|technolog|proficienc/i.test(currentSection);
    if (/^\s*[-*•]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      const content = trimmed.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '');
      if (isNonBulletSection) continue;
      // Skip comma-separated lists (likely skills: "React, TypeScript, Node.js")
      const commaCount = (content.match(/,/g) || []).length;
      if (commaCount >= 3 && content.length < 200) continue;
      // Skip short items (skill names, one-liners)
      if (content.length <= 30) continue;
      bullets.push(content);
    }
  }

  return { rawText: cleanText, bullets, sections };
}
