import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { KrafterClient } from '../../src/krafter/client.js';
import {
  KrafterAuthError,
  KrafterNotFoundError,
  KrafterServerError,
  KrafterNetworkError,
  KrafterRateLimitError,
} from '../../src/krafter/errors.js';
import { getKrafterTools } from '../../src/mcp/tools/krafter.js';
import type { ScoringTool } from '../../src/mcp/tools/scoring.js';

// ---------------------------------------------------------------------------
// Mock client factory
// ---------------------------------------------------------------------------

function createMockClient(): KrafterClient {
  return {
    getResume: vi.fn(),
    listResumes: vi.fn(),
    createResume: vi.fn(),
    updateResume: vi.fn(),
    deleteResume: vi.fn(),
    duplicateResume: vi.fn(),
    updateSettings: vi.fn(),
    updateSection: vi.fn(),
    listTemplates: vi.fn(),
    getResumeSchema: vi.fn(),
  } as unknown as KrafterClient;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findTool(tools: ScoringTool[], name: string): ScoringTool {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`Tool "${name}" not found`);
  return tool;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Krafter tools', () => {
  let mockClient: KrafterClient;
  let tools: ScoringTool[];

  beforeEach(() => {
    mockClient = createMockClient();
    tools = getKrafterTools(mockClient);
  });

  // -----------------------------------------------------------------------
  // Tool registration
  // -----------------------------------------------------------------------

  describe('registration', () => {
    it('exports exactly 11 tools', () => {
      expect(tools).toHaveLength(11);
    });

    it.each([
      'get_resume',
      'list_resumes',
      'create_resume',
      'update_resume',
      'delete_resume',
      'duplicate_resume',
      'update_settings',
      'update_section',
      'list_templates',
      'get_resume_schema',
      'score_krafter_resume',
    ])('registers tool: %s', (name) => {
      const tool = findTool(tools, name);
      expect(tool).toBeDefined();
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.handler).toBeInstanceOf(Function);
    });
  });

  // -----------------------------------------------------------------------
  // CRUD tools — correct MCP format
  // -----------------------------------------------------------------------

  describe('CRUD tools return correct MCP format', () => {
    it('get_resume returns resume as JSON text', async () => {
      const resume = { id: 'r1', firstName: 'Ada' };
      vi.mocked(mockClient.getResume).mockResolvedValue(resume);

      const tool = findTool(tools, 'get_resume');
      const result = await tool.handler({ id: 'r1' });

      expect(mockClient.getResume).toHaveBeenCalledWith('r1');
      expect(result.isError).toBeUndefined();
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(JSON.parse(result.content[0].text)).toEqual(resume);
    });

    it('list_resumes returns array as JSON text', async () => {
      const resumes = [{ id: 'r1' }, { id: 'r2' }];
      vi.mocked(mockClient.listResumes).mockResolvedValue(resumes);

      const tool = findTool(tools, 'list_resumes');
      const result = await tool.handler({});

      expect(mockClient.listResumes).toHaveBeenCalled();
      expect(JSON.parse(result.content[0].text)).toEqual(resumes);
    });

    it('create_resume passes data and returns result', async () => {
      const created = { id: 'r3', firstName: 'Grace' };
      vi.mocked(mockClient.createResume).mockResolvedValue(created);

      const tool = findTool(tools, 'create_resume');
      const data = { firstName: 'Grace' };
      const result = await tool.handler({ data });

      expect(mockClient.createResume).toHaveBeenCalledWith(data);
      expect(JSON.parse(result.content[0].text)).toEqual(created);
    });

    it('update_resume passes id and data', async () => {
      const updated = { id: 'r1', firstName: 'Updated' };
      vi.mocked(mockClient.updateResume).mockResolvedValue(updated);

      const tool = findTool(tools, 'update_resume');
      const result = await tool.handler({ id: 'r1', data: { firstName: 'Updated' } });

      expect(mockClient.updateResume).toHaveBeenCalledWith('r1', { firstName: 'Updated' });
      expect(JSON.parse(result.content[0].text)).toEqual(updated);
    });

    it('delete_resume passes id', async () => {
      vi.mocked(mockClient.deleteResume).mockResolvedValue({ ok: true });

      const tool = findTool(tools, 'delete_resume');
      const result = await tool.handler({ id: 'r1' });

      expect(mockClient.deleteResume).toHaveBeenCalledWith('r1');
      expect(JSON.parse(result.content[0].text)).toEqual({ ok: true });
    });

    it('duplicate_resume passes id', async () => {
      const duplicated = { id: 'r4' };
      vi.mocked(mockClient.duplicateResume).mockResolvedValue(duplicated);

      const tool = findTool(tools, 'duplicate_resume');
      const result = await tool.handler({ id: 'r1' });

      expect(mockClient.duplicateResume).toHaveBeenCalledWith('r1');
      expect(JSON.parse(result.content[0].text)).toEqual(duplicated);
    });

    it('update_settings passes id and settings', async () => {
      const updated = { id: 'r1', template: 'modern' };
      vi.mocked(mockClient.updateSettings).mockResolvedValue(updated);

      const tool = findTool(tools, 'update_settings');
      const result = await tool.handler({ id: 'r1', settings: { template: 'modern' } });

      expect(mockClient.updateSettings).toHaveBeenCalledWith('r1', { template: 'modern' });
      expect(JSON.parse(result.content[0].text)).toEqual(updated);
    });

    it('update_section passes id, type, and items', async () => {
      const updated = { ok: true };
      vi.mocked(mockClient.updateSection).mockResolvedValue(updated);

      const items = [{ title: 'Engineer' }];
      const tool = findTool(tools, 'update_section');
      const result = await tool.handler({ id: 'r1', type: 'experience', items });

      expect(mockClient.updateSection).toHaveBeenCalledWith('r1', 'experience', items);
      expect(JSON.parse(result.content[0].text)).toEqual(updated);
    });

    it('list_templates returns template list', async () => {
      const templates = [{ id: 't1', name: 'Modern' }];
      vi.mocked(mockClient.listTemplates).mockResolvedValue(templates);

      const tool = findTool(tools, 'list_templates');
      const result = await tool.handler({});

      expect(mockClient.listTemplates).toHaveBeenCalled();
      expect(JSON.parse(result.content[0].text)).toEqual(templates);
    });

    it('get_resume_schema returns schema', async () => {
      const schema = { type: 'object', properties: {} };
      vi.mocked(mockClient.getResumeSchema).mockResolvedValue(schema);

      const tool = findTool(tools, 'get_resume_schema');
      const result = await tool.handler({});

      expect(mockClient.getResumeSchema).toHaveBeenCalled();
      expect(JSON.parse(result.content[0].text)).toEqual(schema);
    });
  });

  // -----------------------------------------------------------------------
  // score_krafter_resume — chains getResume -> toResumeData -> scoreResume
  // -----------------------------------------------------------------------

  describe('score_krafter_resume', () => {
    it('fetches resume, transforms, and scores without JD', async () => {
      const resume = {
        firstName: 'Ada',
        lastName: 'Lovelace',
        jobTitle: 'Engineer',
        professionalSummary: '',
        sections: [
          {
            name: 'Experience',
            items: [
              {
                title: 'Senior Engineer',
                subtitle: 'Acme Corp',
                description:
                  '<ul><li>Spearheaded migration to microservices, reducing latency by 40%</li><li>Led team of 8 engineers delivering critical features on schedule</li></ul>',
              },
            ],
          },
          { name: 'Education', items: [] },
          { name: 'Skills', items: [{ name: 'TypeScript' }] },
        ],
      };
      vi.mocked(mockClient.getResume).mockResolvedValue(resume);

      const tool = findTool(tools, 'score_krafter_resume');
      const result = await tool.handler({ id: 'r1' });

      expect(mockClient.getResume).toHaveBeenCalledWith('r1');
      expect(result.isError).toBeUndefined();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveProperty('total');
      expect(parsed).toHaveProperty('mode', 'without-jd');
      expect(parsed).toHaveProperty('breakdown');
      expect(parsed).toHaveProperty('flags');
      expect(typeof parsed.total).toBe('number');
      expect(parsed.total).toBeGreaterThanOrEqual(0);
      expect(parsed.total).toBeLessThanOrEqual(100);
    });

    it('passes jdText to scoreResume when provided', async () => {
      const resume = {
        firstName: 'Ada',
        sections: [
          {
            name: 'Experience',
            items: [
              {
                description:
                  '<ul><li>Built microservices with Kubernetes and TypeScript</li></ul>',
              },
            ],
          },
          { name: 'Skills', items: [{ name: 'Kubernetes' }] },
        ],
      };
      vi.mocked(mockClient.getResume).mockResolvedValue(resume);

      const tool = findTool(tools, 'score_krafter_resume');
      const result = await tool.handler({
        id: 'r1',
        jdText: 'Looking for Kubernetes and TypeScript engineer',
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.mode).toBe('with-jd');
      expect(parsed.ats).not.toBeNull();
    });

    it('returns ResumeScore shape with correct fields', async () => {
      const resume = {
        firstName: 'Test',
        sections: [],
      };
      vi.mocked(mockClient.getResume).mockResolvedValue(resume);

      const tool = findTool(tools, 'score_krafter_resume');
      const result = await tool.handler({ id: 'r1' });

      const parsed = JSON.parse(result.content[0].text);
      // Verify full ResumeScore shape
      expect(parsed).toHaveProperty('total');
      expect(parsed).toHaveProperty('mode');
      expect(parsed).toHaveProperty('breakdown');
      expect(parsed).toHaveProperty('ats');
      expect(parsed).toHaveProperty('flags');
      expect(Array.isArray(parsed.flags)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------

  describe('error handling', () => {
    it('returns isError: true with auth message on 401', async () => {
      vi.mocked(mockClient.getResume).mockRejectedValue(new KrafterAuthError());

      const tool = findTool(tools, 'get_resume');
      const result = await tool.handler({ id: 'r1' });

      expect(result.isError).toBe(true);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Invalid API key');
    });

    it('returns isError: true with not-found message on 404', async () => {
      vi.mocked(mockClient.getResume).mockRejectedValue(new KrafterNotFoundError());

      const tool = findTool(tools, 'get_resume');
      const result = await tool.handler({ id: 'nonexistent' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
    });

    it('returns isError: true with server error message on 500', async () => {
      vi.mocked(mockClient.listResumes).mockRejectedValue(new KrafterServerError());

      const tool = findTool(tools, 'list_resumes');
      const result = await tool.handler({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('service error');
    });

    it('returns isError: true with rate limit message on 429', async () => {
      vi.mocked(mockClient.createResume).mockRejectedValue(new KrafterRateLimitError());

      const tool = findTool(tools, 'create_resume');
      const result = await tool.handler({ data: {} });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Too many requests');
    });

    it('returns isError: true with network message on network error', async () => {
      vi.mocked(mockClient.deleteResume).mockRejectedValue(new KrafterNetworkError());

      const tool = findTool(tools, 'delete_resume');
      const result = await tool.handler({ id: 'r1' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unable to reach Krafter');
    });

    it('returns isError: true for unexpected errors', async () => {
      vi.mocked(mockClient.getResume).mockRejectedValue(new Error('Something broke'));

      const tool = findTool(tools, 'get_resume');
      const result = await tool.handler({ id: 'r1' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBeTruthy();
    });

    it('handles errors in score_krafter_resume when getResume fails', async () => {
      vi.mocked(mockClient.getResume).mockRejectedValue(new KrafterNotFoundError());

      const tool = findTool(tools, 'score_krafter_resume');
      const result = await tool.handler({ id: 'deleted-resume' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
    });
  });
});
