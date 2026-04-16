/**
 * Unified resume text parser.
 *
 * Extracts bullets and section headings from raw resume text (plain text or
 * markdown). Used by both the MCP scoring tools and the CLI entry point.
 */
import type { ResumeData } from './types.js';

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

const BULLET_RE = /^\s*(?:[-\u2022*]|\d+[.)]\s)/;

/**
 * Detect section headings structurally by shape, not by matching keywords.
 *
 * A heading is a short, standalone line that doesn't look like a bullet,
 * a job title (contains a year), or a long sentence. Unrecognised headings
 * are still detected (preventing bullet leakage) but receive zero credit
 * in section completeness scoring.
 */
function isStructuralHeading(trimmed: string): boolean {
  if (trimmed.length === 0 || trimmed.length >= 50) return false;
  if (BULLET_RE.test(trimmed)) return false;
  if (/\b\d{4}\b/.test(trimmed)) return false;
  if (trimmed.split(/\s+/).length > 5) return false;
  if (!/^[A-Z]/.test(trimmed)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// parseRawText
// ---------------------------------------------------------------------------

/**
 * Parse raw resume text into the internal {@link ResumeData} format.
 *
 * Detection strategy:
 * 1. Split into lines.
 * 2. Markdown headings (`# …`) are treated as section headings.
 * 3. Lines detected structurally as headings (by shape, not keywords) are
 *    treated as section headings.
 * 4. Lines with bullet markers are extracted as bullets (marker stripped).
 * 5. Long unmarked lines in work/project sections are captured as bullets.
 * 6. Lines in skill/tool sections and comma-heavy lists are skipped.
 *
 * @param text - Raw resume text, typically pasted by the user.
 * @returns A {@link ResumeData} object with rawText, bullets, and sections.
 */
export function parseRawText(text: string): ResumeData {
  // Strip markdown formatting for rawText used by ATS scorer
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

    // Detect section headings structurally (by shape, not keywords).
    // Short standalone lines that don't look like bullets, job titles, or sentences.
    // Unrecognised headings get zero credit in scoring but still prevent bullet leakage.
    if (isStructuralHeading(trimmed)) {
      sections.push(trimmed.toLowerCase());
      currentSection = trimmed.toLowerCase();
      continue;
    }

    // Detect bullet points
    const isNonBulletSection = /skill|competenc|tool|technolog|proficienc/i.test(currentSection);
    const isWorkSection = /experience|work|project|employment|history/i.test(currentSection);
    const hasMarker = /^\s*[-*•]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line);

    // Unmarked bullets: long sentences in work sections (no marker, but reads like an achievement)
    const isUnmarkedBullet = !hasMarker && isWorkSection && trimmed.length > 50 && /^[A-Z][a-z]/.test(trimmed);

    if (hasMarker || isUnmarkedBullet) {
      const content = hasMarker
        ? trimmed.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '')
        : trimmed;
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
