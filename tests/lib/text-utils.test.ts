import { describe, it, expect } from 'vitest';
import { stem, tokenize, normalise, extractTerms, STOP_WORDS, SYNONYMS, VERB_TIERS } from '../../src/lib/text-utils.js';

describe('stem', () => {
  it('stems common resume words correctly', () => {
    expect(stem('managing')).toBe(stem('managed'));
    expect(stem('development')).toBe(stem('developer'));
    expect(stem('systems')).toBe(stem('system'));
  });

  it('does not mangle short words', () => {
    expect(stem('led')).toBe('led');
    expect(stem('aws')).toBe('aws');
  });

  it('handles words the custom stemmer mangled', () => {
    expect(stem('process')).not.toBe('proces');
    expect(stem('analysis')).not.toBe('analysi');
  });
});

describe('tokenize', () => {
  it('splits on whitespace and punctuation', () => {
    expect(tokenize('Hello, world!')).toEqual(['hello', 'world']);
  });

  it('handles hyphenated words', () => {
    const tokens = tokenize('full-stack developer');
    expect(tokens).toContain('full');
    expect(tokens).toContain('stack');
  });

  it('lowercases all tokens', () => {
    expect(tokenize('TypeScript AWS')).toEqual(['typescript', 'aws']);
  });
});

describe('normalise', () => {
  it('applies synonym substitution', () => {
    expect(normalise('javascript')).toContain('js');
    expect(normalise('amazon web services')).toContain('aws');
  });

  it('applies longest synonym first', () => {
    const result = normalise('experience with amazon web services');
    expect(result).toContain('aws');
    expect(result).not.toContain('amazon');
  });

  it('lowercases and strips extra whitespace', () => {
    expect(normalise('  Hello   World  ')).toBe('hello world');
  });
});

describe('extractTerms', () => {
  it('returns stemmed unigrams', () => {
    const terms = extractTerms('managing kubernetes clusters');
    expect(terms.has(stem('managing'))).toBe(true);
    expect(terms.has(stem('kubernetes'))).toBe(true);
  });

  it('returns bigrams', () => {
    const terms = extractTerms('project management experience');
    expect(terms.has('project management')).toBe(true);
  });

  it('filters stop words from unigrams', () => {
    const terms = extractTerms('working with the kubernetes');
    expect(terms.has('the')).toBe(false);
    expect(terms.has('with')).toBe(false);
  });
});

describe('constants', () => {
  it('STOP_WORDS is a Set with common words', () => {
    expect(STOP_WORDS).toBeInstanceOf(Set);
    expect(STOP_WORDS.has('the')).toBe(true);
    expect(STOP_WORDS.has('and')).toBe(true);
    expect(STOP_WORDS.size).toBeGreaterThan(100);
  });

  it('SYNONYMS has resume-domain abbreviations', () => {
    expect(SYNONYMS['javascript']).toBe('js');
    expect(SYNONYMS['typescript']).toBe('ts');
    expect(SYNONYMS['amazon web services']).toBe('aws');
  });

  it('VERB_TIERS has three tiers', () => {
    expect(VERB_TIERS.tier1).toContain('spearheaded');
    expect(VERB_TIERS.tier2).toContain('managed');
    expect(VERB_TIERS.tier3).toContain('helped');
  });
});
