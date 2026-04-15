// Stable public API — covered by semver guarantees
export { scoreATS } from './ats-scorer.js';
export { scoreResume, getVerbTier } from './resume-scorer.js';
export { toResumeData } from './resume-transformer.js';
export type {
  ResumeData,
  ATSResult,
  ResumeScore,
  ScoreDimension,
  ScoreMode,
  VerbTier,
} from './types.js';

// Internal utilities — NOT part of the stable API, may change in minor versions
// Exported for advanced consumers who accept the risk
export { stem, tokenize, normalise, extractTerms } from './text-utils.js';
