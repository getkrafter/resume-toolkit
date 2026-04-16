/**
 * Resume scoring engine.
 *
 * Provides a deterministic, multi-dimensional resume score composed of
 * five sub-scorers: quantification, verb strength, bullet structure,
 * section completeness, and ATS keyword matching.
 *
 * Main export: `scoreResume(resumeData, jdText?)` returns a `ResumeScore`.
 */
import type {
  ResumeData,
  ResumeScore,
  ScoreDimension,
  ScoreMode,
  ATSResult,
  VerbTier,
} from './types.js';
import { stem, tokenize, STOP_WORDS, VERB_TIERS, isVerb } from './text-utils.js';
import { scoreATS } from './ats-scorer.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Weights when a job description is provided. */
const WEIGHTS_WITH_JD: Record<string, number> = {
  quantification: 0.25,
  verbStrength: 0.2,
  ats: 0.3,
  bulletStructure: 0.15,
  sectionCompleteness: 0.1,
};

/** Required resume sections, each worth 20 points. */
const REQUIRED_SECTIONS = ['experience', 'education', 'skills'] as const;

/** Recommended resume sections, each worth ~13.33 points. */
const RECOMMENDED_SECTIONS = ['summary', 'projects', 'certifications'] as const;

const REQUIRED_SECTION_POINTS = 20;
const RECOMMENDED_SECTION_POINTS = 100 / 3 - 13; // ~13.33
// More precise: 40 / 3 = 13.333...
const RECOMMENDED_POINTS = 40 / 3;

/** Quantity words that indicate measurement without concrete numbers. */
const QUANTITY_WORDS = new Set([
  'significantly',
  'substantially',
  'dramatically',
  'multiple',
  'numerous',
  'extensive',
  'considerable',
  'major',
  'large-scale',
  'enterprise-wide',
  'company-wide',
  'organization-wide',
]);

// ---------------------------------------------------------------------------
// Pre-computed stemmed verb tiers for fast lookup
// ---------------------------------------------------------------------------

/**
 * Maps a stemmed verb to its tier number.
 * Built once at module load time from VERB_TIERS.
 */
const STEMMED_VERB_MAP: Map<string, 1 | 2 | 3> = buildStemmedVerbMap();

function buildStemmedVerbMap(): Map<string, 1 | 2 | 3> {
  const map = new Map<string, 1 | 2 | 3>();
  for (const verb of VERB_TIERS.tier1) {
    map.set(stem(verb), 1);
  }
  for (const verb of VERB_TIERS.tier2) {
    map.set(stem(verb), 2);
  }
  for (const verb of VERB_TIERS.tier3) {
    map.set(stem(verb), 3);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Sub-scorers
// ---------------------------------------------------------------------------

/**
 * Score bullets for quantification. Concrete numbers get full credit (100 pts),
 * quantity words (e.g. "significantly") get partial credit (30 pts).
 * Returns 0-100. Returns 0 for empty bullets array.
 */
export function scoreQuantification(bullets: string[]): number {
  if (bullets.length === 0) return 0;

  let total = 0;
  for (const bullet of bullets) {
    if (/\d+/.test(bullet)) {
      total += 100;
    } else {
      const lower = bullet.toLowerCase();
      const hasQuantityWord = [...QUANTITY_WORDS].some((w) => lower.includes(w));
      if (hasQuantityWord) {
        total += 30;
      }
    }
  }
  return total / bullets.length;
}

/**
 * Determine the verb tier for a bullet based on its first non-stop-word token.
 *
 * 1. Tokenizes the bullet, skips stop words, takes the first meaningful token.
 * 2. Stems it and looks it up in the pre-computed stemmed verb map (authoritative).
 * 3. If not in our curated list, falls back to BrillPOSTagger:
 *    - If tagged as a verb (VB/VBD/VBN/VBP/VBZ) → tier 2
 *    - If not a verb → null (score 0)
 *
 * Returns 1 (strong), 2 (solid), 3 (weak), or null (not a verb).
 */
export function getVerbTier(bullet: string): VerbTier {
  const tokens = tokenize(bullet);

  // Find the first non-stop-word token
  const firstMeaningful = tokens.find((t) => !STOP_WORDS.has(t));
  if (!firstMeaningful) return null;

  const stemmed = stem(firstMeaningful);
  const curatedTier = STEMMED_VERB_MAP.get(stemmed);
  if (curatedTier !== undefined) return curatedTier;

  // POS tagger fallback: any real verb gets tier 2 credit
  if (isVerb(firstMeaningful)) return 2;

  return null;
}

/**
 * Average verb tier quality across bullets.
 * Scoring: tier1=100, tier2=60, tier3=20, null (not a verb)=0.
 * Returns 0-100. Returns 0 for empty bullets array.
 */
export function scoreVerbStrength(bullets: string[]): number {
  if (bullets.length === 0) return 0;

  const tierScores: Record<number, number> = { 1: 100, 2: 60, 3: 20 };

  let total = 0;
  for (const bullet of bullets) {
    const tier = getVerbTier(bullet);
    total += tier !== null ? tierScores[tier] : 0;
  }

  return total / bullets.length;
}

/**
 * Weighted partial-credit bullet structure scoring.
 * Each bullet earns points for:
 * - Recognized verb opener: 40 points
 * - Contains a number: 35 points
 * - 8+ words (sufficient detail): 25 points
 *
 * A bullet with all 3 scores 100. Two of 3 scores 60-75.
 * Returns 0-100. Returns 0 for empty bullets array.
 */
export function scoreBulletStructure(bullets: string[]): number {
  if (bullets.length === 0) return 0;

  let total = 0;
  for (const bullet of bullets) {
    let bulletScore = 0;
    const tier = getVerbTier(bullet);
    if (tier !== null) bulletScore += 40;
    if (/\d+/.test(bullet)) bulletScore += 35;
    if (tokenize(bullet).length >= 8) bulletScore += 25;
    total += bulletScore;
  }

  return total / bullets.length;
}

/**
 * Presence of expected resume sections.
 *
 * Required sections ("experience", "education", "skills") are worth 20 points each.
 * Recommended sections ("summary", "projects", "certifications") are worth ~13.33 points each.
 * Match by substring: a section name includes the keyword.
 * Capped at 100.
 */
export function scoreSectionCompleteness(sections: string[]): number {
  const lowerSections = sections.map((s) => s.toLowerCase());
  let score = 0;

  for (const required of REQUIRED_SECTIONS) {
    if (lowerSections.some((s) => s.includes(required))) {
      score += REQUIRED_SECTION_POINTS;
    }
  }

  for (const recommended of RECOMMENDED_SECTIONS) {
    if (lowerSections.some((s) => s.includes(recommended))) {
      score += RECOMMENDED_POINTS;
    }
  }

  return Math.min(Math.round(score * 100) / 100, 100);
}

// ---------------------------------------------------------------------------
// Main scorer
// ---------------------------------------------------------------------------

/**
 * Score a resume across five dimensions: quantification, verb strength,
 * ATS keyword match, bullet structure, and section completeness.
 *
 * When a job description is provided, the ATS dimension is active and
 * carries 30% weight. Without a JD, the ATS weight is redistributed
 * proportionally across the other four dimensions.
 *
 * @param resumeData - Parsed resume data (raw text, bullets, sections)
 * @param jdText     - Optional job description text for ATS matching
 * @returns A `ResumeScore` with total (0-100), mode, breakdown, ATS result, and flags.
 */
export function scoreResume(
  resumeData: ResumeData,
  jdText?: string,
): ResumeScore {
  const { rawText, bullets, sections } = resumeData;
  const flags: string[] = [];

  // --- Determine mode ---
  const hasJd = Boolean(jdText);
  const mode: ScoreMode = hasJd ? 'with-jd' : 'without-jd';

  if (!hasJd) {
    flags.push(
      'No job description provided — ATS score excluded, weights redistributed.',
    );
  }

  // --- Check for empty / short resume ---
  if (!rawText || rawText.trim().length === 0) {
    flags.push('Resume appears empty');
  } else {
    const wordCount = tokenize(rawText).length;
    if (wordCount < 50) {
      flags.push('Resume is unusually short');
    }
  }

  // --- Compute raw scores ---
  const quantScore = scoreQuantification(bullets);
  const verbScore = scoreVerbStrength(bullets);
  const structScore = scoreBulletStructure(bullets);
  const sectionScore = scoreSectionCompleteness(sections);
  const atsResult: ATSResult | null = hasJd
    ? scoreATS(rawText, jdText!)
    : null;
  const atsScore = atsResult?.score ?? 0;

  // --- Build weights ---
  const weights: Record<string, number> = { ...WEIGHTS_WITH_JD };

  if (!hasJd) {
    // Redistribute ATS weight proportionally across the other 4 dimensions
    const nonAtsTotal = 1 - weights['ats'];
    weights['ats'] = 0;
    for (const key of Object.keys(weights)) {
      if (key !== 'ats') {
        weights[key] = WEIGHTS_WITH_JD[key] / nonAtsTotal;
      }
    }
  }

  // --- Build breakdown ---
  const scores: Record<string, number> = {
    quantification: quantScore,
    verbStrength: verbScore,
    ats: atsScore,
    bulletStructure: structScore,
    sectionCompleteness: sectionScore,
  };

  const breakdown: Record<string, ScoreDimension> = {};
  let total = 0;

  for (const key of Object.keys(weights)) {
    const score = scores[key];
    const weight = weights[key];
    const weightedScore = Math.round(score * weight * 100) / 100;
    breakdown[key] = { score, weight, weightedScore };
    total += weightedScore;
  }

  // Round total to reasonable precision
  total = Math.round(total * 100) / 100;

  // --- Generate diagnostic flags ---
  if (quantScore < 40) {
    flags.push(
      'Fewer than 40% of bullets contain measurable results. Add numbers, percentages, or metrics.',
    );
  }

  if (verbScore < 40) {
    flags.push(
      'Action verb quality is low. Replace weak/passive openers with strong action verbs.',
    );
  }

  if (structScore < 40) {
    flags.push(
      'Most bullets lack the verb -> action -> outcome structure.',
    );
  }

  // Check for summary/profile section
  const lowerSections = sections.map((s) => s.toLowerCase());
  const hasSummaryOrProfile = lowerSections.some(
    (s) => s.includes('summary') || s.includes('profile'),
  );
  if (!hasSummaryOrProfile) {
    flags.push('No summary/profile section found.');
  }

  // Flag low ATS score with top 5 missing terms
  if (atsResult && atsResult.score < 50) {
    const top5missing = atsResult.missing.slice(0, 5);
    flags.push(
      `Low ATS match (${atsResult.score}%). Key missing terms: ${top5missing.join(', ')}`,
    );
  }

  return {
    total,
    mode,
    breakdown,
    ats: atsResult,
    flags,
  };
}
