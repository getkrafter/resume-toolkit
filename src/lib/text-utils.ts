/**
 * Shared text processing utilities for resume analysis.
 *
 * Built on the `natural` NLP library, these helpers handle stemming,
 * tokenization, normalisation (with resume-domain synonym expansion),
 * and term extraction (unigrams + bigrams) used by the ATS scorer.
 */
import natural from 'natural';

const porterStemmer = natural.PorterStemmer;
const wordTokenizer = new natural.WordTokenizer();

// BrillPOSTagger for verb detection fallback
const lexicon = new natural.Lexicon('EN', 'N');
const ruleSet = new natural.RuleSet('EN');
const posTagger = new natural.BrillPOSTagger(lexicon, ruleSet);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Comprehensive English stop words (~179 words) that carry little semantic
 * meaning and should be filtered out during term extraction.
 */
export const STOP_WORDS: Set<string> = new Set([
  // Articles & determiners
  'a', 'an', 'the', 'this', 'that', 'these', 'those',
  // Conjunctions & prepositions
  'and', 'or', 'but', 'nor', 'so', 'yet', 'for', 'at', 'by', 'in', 'of',
  'on', 'to', 'with', 'from', 'into', 'over', 'about', 'up', 'out', 'if',
  'then', 'than', 'as', 'between', 'through', 'under', 'above', 'below',
  'during', 'before', 'after', 'until', 'while', 'because', 'against',
  'again', 'further', 'once',
  // Pronouns
  'i', 'me', 'my', 'we', 'our', 'us', 'you', 'your', 'he', 'him', 'his',
  'she', 'her', 'it', 'its', 'they', 'their', 'them', 'who', 'which',
  'what', 'where', 'when', 'how', 'whom', 'whose',
  // Be / have / do / modals
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'having',
  'do', 'does', 'did',
  'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall',
  'must', 'need', 'ought',
  // Common adverbs & adjectives used as function words
  'not', 'no', 'very', 'just', 'also', 'too', 'only', 'own', 'same',
  'such', 'more', 'most', 'other', 'some', 'any', 'each', 'every',
  'all', 'both', 'few', 'many', 'much', 'several',
  // Misc function words
  'here', 'there', 'now', 'already', 'still', 'even', 'well',
  'back', 'away', 'off', 'down',
  // Additional common stop words
  'been', 'being', 'had', 'having', 'did', 'doing',
  'would', 'could', 'should',
  'able', 'across', 'almost', 'along', 'among', 'another',
  'around', 'away', 'become', 'becomes', 'began', 'behind',
  'beside', 'besides', 'beyond', 'came', 'cannot', 'come',
  'comes', 'could', 'done', 'either', 'else', 'enough',
  'etc', 'ever', 'everything', 'find', 'first', 'found',
  'get', 'gets', 'give', 'given', 'goes', 'going', 'gone',
  'got', 'great', 'however', 'just', 'keep', 'keeps', 'kept',
  'know', 'known', 'last', 'later', 'least', 'less', 'let',
  'like', 'likely', 'long', 'look', 'made', 'make', 'makes',
  'making', 'may', 'maybe', 'might', 'mine', 'more', 'most',
  'mostly', 'must', 'never', 'new', 'next', 'none', 'nothing',
  'often', 'old', 'one', 'ones', 'others', 'part', 'per',
  'perhaps', 'put', 'quite', 'rather', 'really', 'right',
  'said', 'say', 'says', 'seem', 'seemed', 'seems', 'show',
  'since', 'something', 'still', 'take', 'taken', 'tell',
  'thing', 'things', 'think', 'three', 'thus', 'together',
  'told', 'took', 'toward', 'towards', 'try', 'turn', 'turned',
  'two', 'upon', 'use', 'used', 'using', 'want', 'wants',
  'way', 'ways', 'went', 'whether', 'within', 'without',
  'work', 'works', 'worked', 'working', 'year', 'years',
  'yet', 'also',
]);

/**
 * Resume-domain synonym map. Multi-word phrases and framework names are
 * normalised to their canonical short forms. Keys are sorted by length
 * descending at module load time so that longer phrases match first
 * (e.g. "amazon web services" before "amazon").
 */
export const SYNONYMS: Record<string, string> = {
  // Cloud platforms (multi-word first)
  'amazon web services': 'aws',
  'google cloud platform': 'gcp',
  // DevOps / CI-CD
  'continuous integration': 'ci',
  'continuous deployment': 'cd',
  'continuous delivery': 'cd',
  // AI / ML
  'artificial intelligence': 'ai',
  'machine learning': 'ml',
  // UX / UI
  'user experience': 'ux',
  'user interface': 'ui',
  // Languages
  'javascript': 'js',
  'typescript': 'ts',
  // Frameworks (dot-notation and concatenated forms)
  'react.js': 'react',
  'reactjs': 'react',
  'node.js': 'node',
  'nodejs': 'node',
  'vue.js': 'vue',
  'vuejs': 'vue',
  'next.js': 'next',
  'nextjs': 'next',
  // Container orchestration
  'kubernetes': 'k8s',
};

/**
 * Pre-sorted synonym keys (longest first) so multi-word synonyms are
 * matched before their sub-strings.
 */
const SORTED_SYNONYM_KEYS: string[] = Object.keys(SYNONYMS).sort(
  (a, b) => b.length - a.length,
);

/**
 * Action verb tiers for resume bullet quality assessment.
 *
 * - tier1: strong leadership / impact verbs
 * - tier2: solid, active verbs
 * - tier3: weak, passive, or vague verbs
 */
export const VERB_TIERS: { tier1: string[]; tier2: string[]; tier3: string[] } = {
  tier1: [
    'spearheaded',
    'orchestrated',
    'pioneered',
    'transformed',
    'revolutionized',
    'architected',
    'championed',
    'negotiated',
    'overhauled',
    'launched',
    'shipped',
    'scaled',
    'drove',
    'owned',
    'founded',
    'accelerated',
    'eliminated',
    'secured',
    'restructured',
    'consolidated',
    'mobilized',
    'maximized',
    'instituted',
    'doubled',
    'tripled',
  ],
  tier2: [
    'managed',
    'developed',
    'implemented',
    'designed',
    'created',
    'built',
    'led',
    'established',
    'delivered',
    'improved',
    'optimized',
    'reduced',
    'increased',
    'automated',
    'streamlined',
    'coordinated',
    'directed',
    'executed',
    'analyzed',
    'resolved',
    'configured',
    'deployed',
    'integrated',
    'migrated',
    'refactored',
    'mentored',
    'facilitated',
    'authored',
    'collaborated',
    'monitored',
    'diagnosed',
    'maintained',
    'documented',
    'tested',
    'reviewed',
    'presented',
    'trained',
    'researched',
    'defined',
    'evaluated',
    'planned',
    'prioritized',
    'proposed',
    'identified',
    'modernized',
  ],
  tier3: [
    'helped',
    'assisted',
    'participated',
    'contributed',
    'supported',
    'worked',
    'responsible',
    'involved',
    'utilized',
    'handled',
  ],
};

// ---------------------------------------------------------------------------
// Stem overrides — fixes for known Porter Stemmer issues
// ---------------------------------------------------------------------------

/**
 * Words where the standard Porter Stemmer produces an incorrect or
 * unhelpful result. Map from lowercase input to desired stem.
 */
const STEM_OVERRIDES: Record<string, string> = {
  // Porter strips trailing 's' from '-sis' words yielding '-si'
  'analysis': 'analysis',
  'basis': 'basis',
  'diagnosis': 'diagnosis',
  'synthesis': 'synthesis',
  'thesis': 'thesis',
  'hypothesis': 'hypothesis',
  'parenthesis': 'parenthesis',
  'emphasis': 'emphasis',
  // Keep common tech acronyms intact
  'aws': 'aws',
  'gcp': 'gcp',
  'api': 'api',
  'apis': 'api',
  'css': 'css',
  'sql': 'sql',
  'html': 'html',
  'url': 'url',
  'urls': 'url',
  // Ensure kubernetes and k8s stem to the same canonical form
  'kubernetes': 'k8s',
  'k8s': 'k8s',
};

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Stem a single word using the Porter Stemmer, with overrides for known
 * problem words. Input is lowercased before stemming.
 */
export function stem(word: string): string {
  const lower = word.toLowerCase();

  // Check overrides first
  if (STEM_OVERRIDES[lower] !== undefined) {
    return STEM_OVERRIDES[lower];
  }

  // Short words (<=3 chars) are unlikely to benefit from stemming and
  // risk being mangled (e.g. "aws" -> "aw").
  if (lower.length <= 3) {
    return lower;
  }

  return porterStemmer.stem(lower);
}

/**
 * Tokenize text into an array of lowercase word tokens.
 * Returns an empty array for empty / whitespace-only input.
 */
export function tokenize(text: string): string[] {
  const lower = text.toLowerCase();
  const tokens = wordTokenizer.tokenize(lower);
  return tokens ?? [];
}

/**
 * Normalise text for matching: lowercase, trim, collapse whitespace,
 * and apply synonym replacement. Synonyms are applied as whole-word
 * replacements on the lowercased string before any tokenization.
 *
 * Multi-word synonyms are matched via simple `includes` + `replaceAll`,
 * while single-word synonyms use regex word-boundary matching. Keys are
 * processed longest-first to prevent partial matches.
 */
export function normalise(text: string): string {
  // Lowercase, trim, collapse whitespace
  let result = text.toLowerCase().trim().replace(/\s+/g, ' ');

  // Apply synonyms longest-first
  for (const key of SORTED_SYNONYM_KEYS) {
    const value = SYNONYMS[key];
    if (key.includes(' ')) {
      // Multi-word synonym: simple string replacement
      result = result.replaceAll(key, value);
    } else {
      // Single-word synonym: word-boundary regex to avoid partial matches.
      // Escape dots in keys like "react.js" for regex safety.
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'g');
      result = result.replace(regex, value);
    }
  }

  // Re-collapse whitespace in case synonym replacement left gaps
  result = result.trim().replace(/\s+/g, ' ');

  return result;
}

/**
 * Extract a set of search terms from text. The pipeline:
 *
 * 1. Normalise (lowercase + synonyms)
 * 2. Tokenize
 * 3. Filter out stop words
 * 4. Build stemmed unigrams from the filtered list
 * 5. Build raw bigrams from adjacent pairs in the filtered list
 *
 * Returns a Set containing both stemmed unigrams and raw bigrams.
 */
/**
 * Check if a word is a verb using BrillPOSTagger.
 * Returns true if the POS tag starts with VB (VB, VBD, VBN, VBP, VBZ).
 */
export function isVerb(word: string): boolean {
  const tagged = posTagger.tag([word.toLowerCase()]);
  const taggedWords = tagged.taggedWords;
  if (taggedWords.length === 0) return false;
  const tag = taggedWords[0].tag;
  return tag.startsWith('VB');
}

export function extractTerms(text: string): Set<string> {
  const normalised = normalise(text);
  const tokens = tokenize(normalised);

  // Filter stop words
  const filtered = tokens.filter((t) => !STOP_WORDS.has(t));

  const terms = new Set<string>();

  // Add stemmed unigrams
  for (const token of filtered) {
    terms.add(stem(token));
  }

  // Add raw bigrams from adjacent filtered tokens
  for (let i = 0; i < filtered.length - 1; i++) {
    terms.add(`${filtered[i]} ${filtered[i + 1]}`);
  }

  return terms;
}
