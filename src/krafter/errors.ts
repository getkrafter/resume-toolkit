/**
 * Typed error classes for the Krafter HTTP client.
 *
 * Each error maps to a specific HTTP failure mode so callers can
 * pattern-match on the class (instanceof) or inspect `statusCode`.
 */

export class KrafterError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = 'KrafterError';
  }
}

export class KrafterAuthError extends KrafterError {
  constructor() {
    super(
      'Invalid API key. Generate one at krafter.app → Settings → AI Integrations.',
      401,
    );
    this.name = 'KrafterAuthError';
  }
}

export class KrafterNotFoundError extends KrafterError {
  constructor() {
    super('Resume not found. It may have been deleted.', 404);
    this.name = 'KrafterNotFoundError';
  }
}

export class KrafterServerError extends KrafterError {
  constructor() {
    super('Krafter service error. Try again shortly.', 500);
    this.name = 'KrafterServerError';
  }
}

export class KrafterRateLimitError extends KrafterError {
  constructor() {
    super('Too many requests. Please wait a moment.', 429);
    this.name = 'KrafterRateLimitError';
  }
}

export class KrafterNetworkError extends KrafterError {
  constructor() {
    super('Unable to reach Krafter. Check your connection or try again.');
    this.name = 'KrafterNetworkError';
  }
}
