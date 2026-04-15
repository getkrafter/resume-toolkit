/**
 * Thin HTTP client wrapping Krafter's `/api/mcp` tool-call endpoint.
 *
 * Every public method delegates to {@link callTool} which handles
 * authentication, timeout, and error mapping so callers get
 * strongly-typed errors they can pattern-match on.
 */

import {
  KrafterAuthError,
  KrafterNetworkError,
  KrafterNotFoundError,
  KrafterRateLimitError,
  KrafterServerError,
} from './errors.js';

/** Default request timeout in milliseconds. */
const REQUEST_TIMEOUT_MS = 10_000;

export class KrafterClient {
  private apiKey: string;
  private baseUrl: string;
  private schemaCache: unknown | null = null;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl ?? 'https://krafter.app';
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Fetch a single resume by id. */
  async getResume(id: string): Promise<unknown> {
    return this.callTool('get_resume', { id });
  }

  /** List all resumes for the authenticated user. */
  async listResumes(): Promise<unknown> {
    return this.callTool('list_resumes', {});
  }

  /** Create a new resume. */
  async createResume(data: unknown): Promise<unknown> {
    return this.callTool('create_resume', { data });
  }

  /** Update an existing resume. */
  async updateResume(id: string, data: unknown): Promise<unknown> {
    return this.callTool('update_resume', { id, data });
  }

  /** Delete a resume. */
  async deleteResume(id: string): Promise<unknown> {
    return this.callTool('delete_resume', { id });
  }

  /** Duplicate a resume. */
  async duplicateResume(id: string): Promise<unknown> {
    return this.callTool('duplicate_resume', { id });
  }

  /** Update resume settings (template, colors, etc.). */
  async updateSettings(id: string, settings: unknown): Promise<unknown> {
    return this.callTool('update_settings', { id, settings });
  }

  /** Update a specific resume section (experience, education, etc.). */
  async updateSection(
    id: string,
    type: string,
    items: unknown[],
  ): Promise<unknown> {
    return this.callTool('update_section', { id, type, items });
  }

  /** List available templates. */
  async listTemplates(): Promise<unknown> {
    return this.callTool('list_templates', {});
  }

  /**
   * Fetch the resume JSON schema.
   *
   * The schema is cached after the first successful call because it
   * doesn't change during a client's lifetime.
   */
  async getResumeSchema(): Promise<unknown> {
    if (this.schemaCache !== null) {
      return this.schemaCache;
    }

    const schema = await this.callTool('get_resume_schema', {});
    this.schemaCache = schema;
    return schema;
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /**
   * Execute a single tool call against the Krafter MCP endpoint.
   *
   * Handles:
   * - Bearer authentication
   * - 10-second timeout via AbortSignal
   * - HTTP status → typed error mapping
   * - Network / timeout errors → KrafterNetworkError
   */
  private async callTool(
    tool: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const url = `${this.baseUrl}/api/mcp`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tool, args }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      // Network failures and AbortError (timeout) both land here.
      throw new KrafterNetworkError();
    }

    if (!response.ok) {
      this.throwForStatus(response.status);
    }

    const json = (await response.json()) as { result: unknown };
    return json.result;
  }

  /**
   * Map an HTTP error status code to the appropriate typed error.
   * Always throws — the return type is `never`.
   */
  private throwForStatus(status: number): never {
    switch (status) {
      case 401:
        throw new KrafterAuthError();
      case 404:
        throw new KrafterNotFoundError();
      case 429:
        throw new KrafterRateLimitError();
      default:
        // Treat any 5xx (or unexpected status) as a server error.
        if (status >= 500) {
          throw new KrafterServerError();
        }
        // Fallback for unexpected 4xx codes we don't have a class for.
        throw new KrafterServerError();
    }
  }
}
