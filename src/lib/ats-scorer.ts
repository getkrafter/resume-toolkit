import type { ATSResult } from './types.js';
import { stem, normalise, extractTerms, STOP_WORDS } from './text-utils.js';

/**
 * Score a resume against a job description for ATS keyword match.
 *
 * Uses bigram + stemmed unigram matching with weighted scoring:
 * - Bigram match = 1.5 points
 * - Unigram match = 1.0 point
 *
 * Returns null if jdText is falsy (no JD provided).
 */
export function scoreATS(resumeText: string, jdText: string): ATSResult | null {
  if (!jdText) return null;

  const resumeTerms = extractTerms(resumeText);
  const jdTerms = extractTerms(jdText);

  // Separate JD terms into bigrams and unigrams
  const jdBigrams: string[] = [];
  const jdUnigrams: string[] = [];

  for (const term of jdTerms) {
    if (term.includes(' ')) {
      jdBigrams.push(term);
    } else {
      jdUnigrams.push(term);
    }
  }

  // Match bigrams
  const bigramsMatched: string[] = [];
  const bigramsMissing: string[] = [];

  for (const bigram of jdBigrams) {
    if (resumeTerms.has(bigram)) {
      bigramsMatched.push(bigram);
    } else {
      // Fallback: check if both unigrams in the bigram match individually
      const parts = bigram.split(' ');
      const bothMatch = parts.every((part) => resumeTerms.has(stem(part)));
      if (bothMatch) {
        bigramsMatched.push(bigram);
      } else {
        bigramsMissing.push(bigram);
      }
    }
  }

  // Match unigrams (stemmed)
  const unigramsMatched: string[] = [];
  const unigramsMissing: string[] = [];

  // Track which stemmed resume unigrams we have for unigram matching
  const resumeUnigrams = new Set<string>();
  for (const term of resumeTerms) {
    if (!term.includes(' ')) {
      resumeUnigrams.add(term);
    }
  }

  for (const unigram of jdUnigrams) {
    if (resumeUnigrams.has(unigram)) {
      unigramsMatched.push(unigram);
    } else {
      unigramsMissing.push(unigram);
    }
  }

  // Weighted scoring: bigram = 1.5, unigram = 1.0
  const totalPoints =
    jdBigrams.length * 1.5 + jdUnigrams.length * 1.0;

  const earnedPoints =
    bigramsMatched.length * 1.5 + unigramsMatched.length * 1.0;

  const score = totalPoints === 0 ? 0 : Math.round((earnedPoints / totalPoints) * 100);

  // Build human-readable matched/missing lists
  const matched = [...bigramsMatched, ...unigramsMatched];
  const missing = [...bigramsMissing, ...unigramsMissing];

  return {
    score,
    matched,
    missing,
    details: {
      bigramsMatched,
      unigramsMatched,
      bigramsMissing,
      unigramsMissing,
    },
  };
}
