/**
 * MCP tool handlers for Krafter resume CRUD and scoring.
 *
 * Defines 11 tools that wrap {@link KrafterClient} methods with MCP-formatted
 * error handling. The `score_krafter_resume` tool chains three operations:
 * fetch resume -> transform to ResumeData -> score.
 *
 * All tools return standard MCP {@link CallToolResult} objects. On error,
 * the result includes `isError: true` with the error message as text content.
 */
import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { KrafterClient } from '../../krafter/client.js';
import { KrafterError } from '../../krafter/errors.js';
import { toResumeData } from '../../lib/resume-transformer.js';
import { scoreResume } from '../../lib/resume-scorer.js';
import type { ScoringTool } from './scoring.js';

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

/**
 * Wrap a handler function with MCP-compatible error handling.
 *
 * If the handler throws a {@link KrafterError} (or subclass), the error
 * message is returned as an MCP error result (`isError: true`). Unexpected
 * errors are caught the same way so the MCP transport never sees a raw
 * exception.
 */
function withErrorHandling(
  fn: (args: any) => Promise<CallToolResult>,
): (args: any) => Promise<CallToolResult> {
  return async (args: any): Promise<CallToolResult> => {
    try {
      return await fn(args);
    } catch (error: unknown) {
      const message =
        error instanceof KrafterError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'An unexpected error occurred.';

      return {
        content: [{ type: 'text', text: message }],
        isError: true,
      };
    }
  };
}

/**
 * Build a standard success result wrapping the given data as JSON text.
 */
function ok(data: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
  };
}

// ---------------------------------------------------------------------------
// Tool descriptions
// ---------------------------------------------------------------------------

const DESCRIPTIONS = {
  get_resume:
    'Fetch a single Krafter resume by ID. Returns the full resume object as JSON.',
  list_resumes:
    'List all resumes for the authenticated Krafter user.',
  create_resume:
    'Create a new resume in Krafter. Accepts a data object with resume fields.',
  update_resume:
    'Update an existing Krafter resume. Accepts the resume ID and a data object with fields to update.',
  delete_resume:
    'Delete a Krafter resume by ID.',
  duplicate_resume:
    'Duplicate an existing Krafter resume. Returns the new resume.',
  update_settings:
    'Update resume settings (template, colors, font, etc.). Accepts resume ID and a settings object.',
  update_section:
    'Update a specific resume section (experience, education, skills, etc.). Accepts resume ID, section type, and items array.',
  list_templates:
    'List all available Krafter resume templates.',
  get_resume_schema:
    'Fetch the Krafter resume JSON schema. Useful for understanding the resume data structure.',
  score_krafter_resume:
    'Score a Krafter resume for quality across 5 dimensions (0-100). Fetches the resume by ID, ' +
    'converts it to scoring format, and runs the deterministic scorer. Optionally accepts a job ' +
    'description for ATS keyword matching. Returns total score, mode, breakdown per dimension, and diagnostic flags.',
} as const;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build and return the array of Krafter tool descriptors.
 *
 * Each tool wraps a {@link KrafterClient} method with MCP-formatted
 * error handling. The tools use the same {@link ScoringTool} interface
 * as the scoring tools so they can be registered uniformly.
 *
 * @param client - A configured {@link KrafterClient} instance.
 * @returns An array of tool descriptors ready for MCP server registration.
 */
export function getKrafterTools(client: KrafterClient): ScoringTool[] {
  return [
    // -----------------------------------------------------------------
    // get_resume
    // -----------------------------------------------------------------
    {
      name: 'get_resume',
      description: DESCRIPTIONS.get_resume,
      inputSchema: z.object({ id: z.string() }),
      handler: withErrorHandling(async (args: { id: string }) => {
        const resume = await client.getResume(args.id);
        return ok(resume);
      }),
    },

    // -----------------------------------------------------------------
    // list_resumes
    // -----------------------------------------------------------------
    {
      name: 'list_resumes',
      description: DESCRIPTIONS.list_resumes,
      inputSchema: z.object({}),
      handler: withErrorHandling(async () => {
        const resumes = await client.listResumes();
        return ok(resumes);
      }),
    },

    // -----------------------------------------------------------------
    // create_resume
    // -----------------------------------------------------------------
    {
      name: 'create_resume',
      description: DESCRIPTIONS.create_resume,
      inputSchema: z.object({ data: z.record(z.unknown()) }),
      handler: withErrorHandling(async (args: { data: Record<string, unknown> }) => {
        const result = await client.createResume(args.data);
        return ok(result);
      }),
    },

    // -----------------------------------------------------------------
    // update_resume
    // -----------------------------------------------------------------
    {
      name: 'update_resume',
      description: DESCRIPTIONS.update_resume,
      inputSchema: z.object({ id: z.string(), data: z.record(z.unknown()) }),
      handler: withErrorHandling(
        async (args: { id: string; data: Record<string, unknown> }) => {
          const result = await client.updateResume(args.id, args.data);
          return ok(result);
        },
      ),
    },

    // -----------------------------------------------------------------
    // delete_resume
    // -----------------------------------------------------------------
    {
      name: 'delete_resume',
      description: DESCRIPTIONS.delete_resume,
      inputSchema: z.object({ id: z.string() }),
      handler: withErrorHandling(async (args: { id: string }) => {
        const result = await client.deleteResume(args.id);
        return ok(result);
      }),
    },

    // -----------------------------------------------------------------
    // duplicate_resume
    // -----------------------------------------------------------------
    {
      name: 'duplicate_resume',
      description: DESCRIPTIONS.duplicate_resume,
      inputSchema: z.object({ id: z.string() }),
      handler: withErrorHandling(async (args: { id: string }) => {
        const result = await client.duplicateResume(args.id);
        return ok(result);
      }),
    },

    // -----------------------------------------------------------------
    // update_settings
    // -----------------------------------------------------------------
    {
      name: 'update_settings',
      description: DESCRIPTIONS.update_settings,
      inputSchema: z.object({ id: z.string(), settings: z.record(z.unknown()) }),
      handler: withErrorHandling(
        async (args: { id: string; settings: Record<string, unknown> }) => {
          const result = await client.updateSettings(args.id, args.settings);
          return ok(result);
        },
      ),
    },

    // -----------------------------------------------------------------
    // update_section
    // -----------------------------------------------------------------
    {
      name: 'update_section',
      description: DESCRIPTIONS.update_section,
      inputSchema: z.object({
        id: z.string(),
        type: z.string(),
        items: z.array(z.unknown()),
      }),
      handler: withErrorHandling(
        async (args: { id: string; type: string; items: unknown[] }) => {
          const result = await client.updateSection(args.id, args.type, args.items);
          return ok(result);
        },
      ),
    },

    // -----------------------------------------------------------------
    // list_templates
    // -----------------------------------------------------------------
    {
      name: 'list_templates',
      description: DESCRIPTIONS.list_templates,
      inputSchema: z.object({}),
      handler: withErrorHandling(async () => {
        const templates = await client.listTemplates();
        return ok(templates);
      }),
    },

    // -----------------------------------------------------------------
    // get_resume_schema
    // -----------------------------------------------------------------
    {
      name: 'get_resume_schema',
      description: DESCRIPTIONS.get_resume_schema,
      inputSchema: z.object({}),
      handler: withErrorHandling(async () => {
        const schema = await client.getResumeSchema();
        return ok(schema);
      }),
    },

    // -----------------------------------------------------------------
    // score_krafter_resume
    // -----------------------------------------------------------------
    {
      name: 'score_krafter_resume',
      description: DESCRIPTIONS.score_krafter_resume,
      inputSchema: z.object({
        id: z.string(),
        jdText: z.string().optional(),
      }),
      handler: withErrorHandling(
        async (args: { id: string; jdText?: string }) => {
          const resume = await client.getResume(args.id);
          const resumeData = toResumeData(resume as Record<string, unknown>);
          const score = scoreResume(resumeData, args.jdText);
          return ok(score);
        },
      ),
    },
  ];
}
