/**
 * MCP tool handlers for resume scoring.
 *
 * Defines two tools:
 *   - score_resume: Full multi-dimensional resume quality score (0-100)
 *   - score_ats: Focused ATS keyword-match score against a job description
 *
 * Each tool accepts raw text input, parses it into the internal ResumeData
 * format, and delegates to the deterministic scoring engine.
 */
import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ResumeData } from '../../lib/types.js';
import { scoreResume } from '../../lib/resume-scorer.js';
import { scoreATS } from '../../lib/ats-scorer.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Descriptor for a scoring tool: its name, description, Zod input schema,
 * and async handler function that returns a standard MCP CallToolResult.
 */
export interface ScoringTool {
  name: string;
  description: string;
  inputSchema: z.ZodObject<any>;
  handler: (args: any) => Promise<CallToolResult>;
}

// ---------------------------------------------------------------------------
// Bullet / section detection patterns
// ---------------------------------------------------------------------------

/**
 * Matches lines that start with common bullet markers:
 *   - dash (-)
 *   - bullet character (bullet)
 *   - asterisk (*)
 *   - numbered list (1., 2., etc.)
 *
 * Allows optional leading whitespace.
 */
const BULLET_RE = /^\s*(?:[-\u2022*]|\d+[.)]\s)/;

/**
 * Matches lines that look like ALL CAPS section headings:
 *   - ALL CAPS words (2+ chars, possibly with spaces, &, /)
 */
const HEADING_ALLCAPS_RE = /^[A-Z][A-Z &/]+$/;

/**
 * Matches known resume section keywords (case-insensitive).
 * This catches Title Case headings like "Experience" or "Technical Skills"
 * without false-positiving on job titles like "Senior Software Engineer".
 */
const KNOWN_SECTION_RE = /^(summary|profile|experience|work experience|employment|education|skills|projects|certifications?|courses?|awards?|honors?|publications?|interests?|languages?|references?|technical skills|professional experience|work history|objective|about me|volunteer)(?:\s*[:/|—–-]\s*.*)?$/i;

// ---------------------------------------------------------------------------
// parseRawText
// ---------------------------------------------------------------------------

/**
 * Parse raw pasted resume text into the internal {@link ResumeData} format.
 *
 * Detection strategy:
 * 1. Split into lines.
 * 2. Lines matching {@link BULLET_RE} are extracted as bullets (marker stripped).
 * 3. Short, non-bullet lines that are ALL CAPS or match known resume section
 *    keywords (case-insensitive) are treated as section headings.
 * 4. Lines that are neither bullets nor headings are ignored (they may be
 *    paragraph text, contact info, etc.).
 *
 * @param text - Raw resume text, typically pasted by the user.
 * @returns A {@link ResumeData} object with rawText, bullets, and sections.
 */
export function parseRawText(text: string): ResumeData {
  const lines = text.split('\n');
  const bullets: string[] = [];
  const sections: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (BULLET_RE.test(trimmed)) {
      // Strip the bullet marker to get the pure bullet text
      const bulletText = trimmed.replace(/^\s*(?:[-\u2022*]|\d+[.)]\s?)\s*/, '').trim();
      if (bulletText) {
        bullets.push(bulletText);
      }
    } else if (
      trimmed.length < 50 &&
      (HEADING_ALLCAPS_RE.test(trimmed) || KNOWN_SECTION_RE.test(trimmed))
    ) {
      sections.push(trimmed);
    }
  }

  return { rawText: text, bullets, sections };
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const SCORE_RESUME_DESCRIPTION =
  'Score a resume for quality across 5 dimensions (0-100). Deterministic — same input always produces the same score. ' +
  'The result includes: total score, mode (with-jd or without-jd), breakdown per dimension ' +
  '(quantification, verb strength, ATS match, bullet structure, section completeness), and diagnostic flags. ' +
  'Your role: explain what each dimension means for THIS resume, give specific actionable suggestions for low-scoring dimensions, ' +
  'highlight top 5 missing keywords if ATS match is low, and frame the score constructively.';

const SCORE_ATS_DESCRIPTION =
  'Score resume-to-job-description keyword match (0-100). Returns matched keywords, missing keywords, ' +
  'and bigram/unigram breakdown. Use this for focused ATS analysis without the full resume quality score.';

/**
 * Build and return the array of scoring tool descriptors.
 *
 * Each tool's handler accepts parsed arguments and returns a standard
 * MCP result with a single text content block containing JSON.
 */
export function getScoringTools(): ScoringTool[] {
  // -----------------------------------------------------------------------
  // Tool 1: score_resume
  // -----------------------------------------------------------------------
  const scoreResumeSchema = z.object({
    resumeText: z.string(),
    jdText: z.string().optional(),
  });

  const scoreResumeHandler = async (
    args: z.infer<typeof scoreResumeSchema>,
  ): Promise<CallToolResult> => {
    const resumeData = parseRawText(args.resumeText);
    const result = scoreResume(resumeData, args.jdText);

    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
    };
  };

  // -----------------------------------------------------------------------
  // Tool 2: score_ats
  // -----------------------------------------------------------------------
  const scoreAtsSchema = z.object({
    resumeText: z.string(),
    jdText: z.string(),
  });

  const scoreAtsHandler = async (
    args: z.infer<typeof scoreAtsSchema>,
  ): Promise<CallToolResult> => {
    const result = scoreATS(args.resumeText, args.jdText);

    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
    };
  };

  // -----------------------------------------------------------------------
  // Return tool array
  // -----------------------------------------------------------------------
  return [
    {
      name: 'score_resume',
      description: SCORE_RESUME_DESCRIPTION,
      inputSchema: scoreResumeSchema,
      handler: scoreResumeHandler,
    },
    {
      name: 'score_ats',
      description: SCORE_ATS_DESCRIPTION,
      inputSchema: scoreAtsSchema,
      handler: scoreAtsHandler,
    },
  ];
}
