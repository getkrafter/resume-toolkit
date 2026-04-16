import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KrafterClient } from '../../src/krafter/client.js';
import {
  KrafterAuthError,
  KrafterNotFoundError,
  KrafterServerError,
  KrafterRateLimitError,
  KrafterNetworkError,
} from '../../src/krafter/errors.js';

describe('KrafterClient', () => {
  let client: KrafterClient;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
    client = new KrafterClient('test-api-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ---------------------------------------------------------------------------
  // Helper to build a successful Response
  // ---------------------------------------------------------------------------
  function okResponse(result: unknown): Response {
    return new Response(JSON.stringify({ result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  function errorResponse(status: number): Response {
    return new Response(JSON.stringify({ error: 'fail' }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ---------------------------------------------------------------------------
  // Request shape & auth
  // ---------------------------------------------------------------------------
  describe('request construction', () => {
    it('sends POST to /api/mcp with Bearer token', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ id: 'r1' }));

      await client.getResume('r1');

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://krafter.vercel.app/api/mcp');
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual(
        expect.objectContaining({
          Authorization: 'Bearer test-api-key',
          'Content-Type': 'application/json',
        }),
      );
    });

    it('uses custom baseUrl when provided', async () => {
      const custom = new KrafterClient('key', 'https://staging.krafter.app');
      mockFetch.mockResolvedValueOnce(okResponse([]));

      await custom.listResumes();

      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://staging.krafter.app/api/mcp');
    });

    it('defaults baseUrl to production', () => {
      // The default is asserted indirectly via the URL in the first test.
      // We assert it here again with a fresh client.
      const fresh = new KrafterClient('k');
      mockFetch.mockResolvedValueOnce(okResponse(null));

      // Trigger a request so we can inspect the URL.
      fresh.listResumes();

      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://krafter.vercel.app/api/mcp');
    });
  });

  // ---------------------------------------------------------------------------
  // Public method payloads
  // ---------------------------------------------------------------------------
  describe('getResume', () => {
    it('sends tool=get_resume with id arg', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ id: 'abc' }));

      const result = await client.getResume('abc');

      const body = JSON.parse(
        (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
      );
      expect(body).toEqual({ tool: 'get_resume', args: { id: 'abc' } });
      expect(result).toEqual({ id: 'abc' });
    });
  });

  describe('listResumes', () => {
    it('sends tool=list_resumes with empty args', async () => {
      const resumes = [{ id: '1' }, { id: '2' }];
      mockFetch.mockResolvedValueOnce(okResponse(resumes));

      const result = await client.listResumes();

      const body = JSON.parse(
        (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
      );
      expect(body).toEqual({ tool: 'list_resumes', args: {} });
      expect(result).toEqual(resumes);
    });
  });

  describe('createResume', () => {
    it('sends tool=create_resume with data arg', async () => {
      const data = { name: 'My Resume' };
      mockFetch.mockResolvedValueOnce(okResponse({ id: 'new' }));

      const result = await client.createResume(data);

      const body = JSON.parse(
        (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
      );
      expect(body).toEqual({ tool: 'create_resume', args: { data } });
      expect(result).toEqual({ id: 'new' });
    });
  });

  describe('updateResume', () => {
    it('sends tool=update_resume with id and data args', async () => {
      const data = { name: 'Updated' };
      mockFetch.mockResolvedValueOnce(okResponse({ id: 'r1' }));

      await client.updateResume('r1', data);

      const body = JSON.parse(
        (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
      );
      expect(body).toEqual({
        tool: 'update_resume',
        args: { id: 'r1', data },
      });
    });
  });

  describe('deleteResume', () => {
    it('sends tool=delete_resume with id arg', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ success: true }));

      await client.deleteResume('r1');

      const body = JSON.parse(
        (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
      );
      expect(body).toEqual({ tool: 'delete_resume', args: { id: 'r1' } });
    });
  });

  describe('duplicateResume', () => {
    it('sends tool=duplicate_resume with id arg', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ id: 'dup1' }));

      const result = await client.duplicateResume('r1');

      const body = JSON.parse(
        (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
      );
      expect(body).toEqual({ tool: 'duplicate_resume', args: { id: 'r1' } });
      expect(result).toEqual({ id: 'dup1' });
    });
  });

  describe('updateSettings', () => {
    it('sends tool=update_settings with id and settings args', async () => {
      const settings = { theme: 'dark' };
      mockFetch.mockResolvedValueOnce(okResponse({ ok: true }));

      await client.updateSettings('r1', settings);

      const body = JSON.parse(
        (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
      );
      expect(body).toEqual({
        tool: 'update_settings',
        args: { id: 'r1', settings },
      });
    });
  });

  describe('updateSection', () => {
    it('sends tool=update_section with id, type, and items args', async () => {
      const items = [{ title: 'Engineer' }];
      mockFetch.mockResolvedValueOnce(okResponse({ ok: true }));

      await client.updateSection('r1', 'experience', items);

      const body = JSON.parse(
        (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
      );
      expect(body).toEqual({
        tool: 'update_section',
        args: { id: 'r1', type: 'experience', items },
      });
    });
  });

  describe('listTemplates', () => {
    it('sends tool=list_templates with empty args', async () => {
      const templates = [{ id: 't1', name: 'Classic' }];
      mockFetch.mockResolvedValueOnce(okResponse(templates));

      const result = await client.listTemplates();

      const body = JSON.parse(
        (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
      );
      expect(body).toEqual({ tool: 'list_templates', args: {} });
      expect(result).toEqual(templates);
    });
  });

  // ---------------------------------------------------------------------------
  // Schema caching
  // ---------------------------------------------------------------------------
  describe('getResumeSchema', () => {
    it('sends tool=get_resume_schema with empty args', async () => {
      const schema = { type: 'object', properties: {} };
      mockFetch.mockResolvedValueOnce(okResponse(schema));

      const result = await client.getResumeSchema();

      const body = JSON.parse(
        (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
      );
      expect(body).toEqual({ tool: 'get_resume_schema', args: {} });
      expect(result).toEqual(schema);
    });

    it('caches schema after first call — fetch called only once', async () => {
      const schema = { type: 'object' };
      mockFetch.mockResolvedValueOnce(okResponse(schema));

      const first = await client.getResumeSchema();
      const second = await client.getResumeSchema();

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(first).toEqual(schema);
      expect(second).toEqual(schema);
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------
  describe('error handling', () => {
    it('throws KrafterAuthError on 401', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(401));
      await expect(client.getResume('r1')).rejects.toThrow(KrafterAuthError);
    });

    it('throws KrafterNotFoundError on 404', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(404));
      await expect(client.getResume('r1')).rejects.toThrow(
        KrafterNotFoundError,
      );
    });

    it('throws KrafterRateLimitError on 429', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(429));
      await expect(client.listResumes()).rejects.toThrow(
        KrafterRateLimitError,
      );
    });

    it('throws KrafterServerError on 500', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(500));
      await expect(client.listResumes()).rejects.toThrow(KrafterServerError);
    });

    it('throws KrafterServerError on 502', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(502));
      await expect(client.listResumes()).rejects.toThrow(KrafterServerError);
    });

    it('throws KrafterServerError on 503', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(503));
      await expect(client.listResumes()).rejects.toThrow(KrafterServerError);
    });

    it('throws KrafterNetworkError when fetch rejects (network failure)', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      await expect(client.getResume('r1')).rejects.toThrow(
        KrafterNetworkError,
      );
    });

    it('throws KrafterNetworkError on AbortError (timeout)', async () => {
      const abortError = new DOMException('The operation was aborted', 'AbortError');
      mockFetch.mockRejectedValueOnce(abortError);
      await expect(client.getResume('r1')).rejects.toThrow(
        KrafterNetworkError,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Timeout
  // ---------------------------------------------------------------------------
  describe('timeout', () => {
    it('passes an AbortSignal to fetch', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ id: 'r1' }));

      await client.getResume('r1');

      const init = (mockFetch.mock.calls[0] as [string, RequestInit])[1];
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it('configures a 10-second timeout via AbortSignal.timeout', async () => {
      // We spy on AbortSignal.timeout to verify the duration.
      const realTimeout = AbortSignal.timeout;
      const timeoutSpy = vi
        .spyOn(AbortSignal, 'timeout')
        .mockImplementation((ms) => realTimeout.call(AbortSignal, ms));

      mockFetch.mockResolvedValueOnce(okResponse(null));
      await client.listResumes();

      expect(timeoutSpy).toHaveBeenCalledWith(10_000);
      timeoutSpy.mockRestore();
    });
  });
});
