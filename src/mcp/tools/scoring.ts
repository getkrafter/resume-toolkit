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
import { parseRawText } from '../../lib/resume-parser.js';
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
