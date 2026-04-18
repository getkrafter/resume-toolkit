/**
 * Shared text processing utilities for resume analysis.
 *
 * Built on the `natural` NLP library, these helpers handle stemming,
 * tokenization, normalisation (with resume-domain synonym expansion),
 * and term extraction (unigrams + bigrams) used by the ATS scorer.
 */
// Deep imports bypass natural's barrel (`natural/index.js`), which eagerly
// loads `util/storage` → `pg` / `redis` → Node built-ins (`tls`, `net`, `fs`,
// `node:diagnostics_channel`). Deep imports keep this library bundler-safe for
// browser consumers (e.g. Krafter's editor). Version is pinned narrowly in
// package.json to catch any upstream restructuring.
import { PorterStemmer } from "natural/lib/natural/stemmers/index.js";
import { WordTokenizer } from "natural/lib/natural/tokenizers/index.js";
import {
  BrillPOSTagger,
  Lexicon,
  RuleSet,
} from "natural/lib/natural/brill_pos_tagger/index.js";

const porterStemmer = PorterStemmer;
const wordTokenizer = new WordTokenizer();

// BrillPOSTagger for verb detection fallback
const lexicon = new Lexicon("EN", "N");
const ruleSet = new RuleSet("EN");
const posTagger = new BrillPOSTagger(lexicon, ruleSet);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Comprehensive English stop words (~179 words) that carry little semantic
 * meaning and should be filtered out during term extraction.
 */
export const STOP_WORDS: Set<string> = new Set([
  // Articles & determiners
  "a",
  "an",
  "the",
  "this",
  "that",
  "these",
  "those",
  // Conjunctions & prepositions
  "and",
  "or",
  "but",
  "nor",
  "so",
  "yet",
  "for",
  "at",
  "by",
  "in",
  "of",
  "on",
  "to",
  "with",
  "from",
  "into",
  "over",
  "about",
  "up",
  "out",
  "if",
  "then",
  "than",
  "as",
  "between",
  "through",
  "under",
  "above",
  "below",
  "during",
  "before",
  "after",
  "until",
  "while",
  "because",
  "against",
  "again",
  "further",
  "once",
  // Pronouns
  "i",
  "me",
  "my",
  "we",
  "our",
  "us",
  "you",
  "your",
  "he",
  "him",
  "his",
  "she",
  "her",
  "it",
  "its",
  "they",
  "their",
  "them",
  "who",
  "which",
  "what",
  "where",
  "when",
  "how",
  "whom",
  "whose",
  // Be / have / do / modals
  "is",
  "am",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "having",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "can",
  "shall",
  "must",
  "need",
  "ought",
  // Common adverbs & adjectives used as function words
  "not",
  "no",
  "very",
  "just",
  "also",
  "too",
  "only",
  "own",
  "same",
  "such",
  "more",
  "most",
  "other",
  "some",
  "any",
  "each",
  "every",
  "all",
  "both",
  "few",
  "many",
  "much",
  "several",
  // Misc function words
  "here",
  "there",
  "now",
  "already",
  "still",
  "even",
  "well",
  "back",
  "away",
  "off",
  "down",
  // Additional common stop words
  "been",
  "being",
  "had",
  "having",
  "did",
  "doing",
  "would",
  "could",
  "should",
  "able",
  "across",
  "almost",
  "along",
  "among",
  "another",
  "around",
  "away",
  "become",
  "becomes",
  "began",
  "behind",
  "beside",
  "besides",
  "beyond",
  "came",
  "cannot",
  "come",
  "comes",
  "could",
  "done",
  "either",
  "else",
  "enough",
  "etc",
  "ever",
  "everything",
  "find",
  "first",
  "found",
  "get",
  "gets",
  "give",
  "given",
  "goes",
  "going",
  "gone",
  "got",
  "great",
  "however",
  "just",
  "keep",
  "keeps",
  "kept",
  "know",
  "known",
  "last",
  "later",
  "least",
  "less",
  "let",
  "like",
  "likely",
  "long",
  "look",
  "made",
  "make",
  "makes",
  "making",
  "may",
  "maybe",
  "might",
  "mine",
  "more",
  "most",
  "mostly",
  "must",
  "never",
  "new",
  "next",
  "none",
  "nothing",
  "often",
  "old",
  "one",
  "ones",
  "others",
  "part",
  "per",
  "perhaps",
  "put",
  "quite",
  "rather",
  "really",
  "right",
  "said",
  "say",
  "says",
  "seem",
  "seemed",
  "seems",
  "show",
  "since",
  "something",
  "still",
  "take",
  "taken",
  "tell",
  "thing",
  "things",
  "think",
  "three",
  "thus",
  "together",
  "told",
  "took",
  "toward",
  "towards",
  "try",
  "turn",
  "turned",
  "two",
  "upon",
  "use",
  "used",
  "using",
  "want",
  "wants",
  "way",
  "ways",
  "went",
  "whether",
  "within",
  "without",
  "work",
  "works",
  "worked",
  "working",
  "year",
  "years",
  "yet",
  "also"
]);

/**
 * Resume-domain synonym map. Multi-word phrases and framework names are
 * normalised to their canonical short forms. Keys are sorted by length
 * descending at module load time so that longer phrases match first
 * (e.g. "amazon web services" before "amazon").
 */
export const SYNONYMS: Record<string, string> = {
  // Cloud platforms (multi-word first)
  "amazon web services": "aws",
  "google cloud platform": "gcp",
  "microsoft azure": "azure",
  // DevOps / CI-CD
  "continuous integration": "ci",
  "continuous deployment": "cd",
  "continuous delivery": "cd",
  "github actions": "github-actions",
  // AI / ML
  "artificial intelligence": "ai",
  "machine learning": "ml",
  "deep learning": "dl",
  "natural language processing": "nlp",
  "large language model": "llm",
  "large language models": "llm",
  // UX / UI
  "user experience": "ux",
  "user interface": "ui",
  // Languages
  javascript: "js",
  typescript: "ts",
  // Frameworks (dot-notation and concatenated forms)
  "react.js": "react",
  reactjs: "react",
  "react native": "react-native",
  "node.js": "node",
  nodejs: "node",
  "vue.js": "vue",
  vuejs: "vue",
  "next.js": "next",
  nextjs: "next",
  "nuxt.js": "nuxt",
  nuxtjs: "nuxt",
  "express.js": "express",
  expressjs: "express",
  "angular.js": "angular",
  angularjs: "angular",
  "ember.js": "ember",
  emberjs: "ember",
  "svelte.js": "svelte",
  sveltejs: "svelte",
  "gatsby.js": "gatsby",
  gatsbyjs: "gatsby",
  "nest.js": "nest",
  nestjs: "nest",
  "remix.js": "remix",
  remixjs: "remix",
  // Container orchestration & infra
  kubernetes: "k8s",
  // Databases
  postgresql: "postgres",
  "mongo db": "mongodb",
  dynamodb: "dynamo",
  "amazon dynamodb": "dynamo",
  "amazon s3": "s3",
  "amazon ec2": "ec2",
  "amazon rds": "rds",
  "amazon sqs": "sqs",
  "amazon sns": "sns",
  "amazon lambda": "lambda",
  "aws lambda": "lambda",
  "google bigquery": "bigquery",
  "elastic search": "elasticsearch",
  // Business & finance
  "return on investment": "roi",
  "key performance indicator": "kpi",
  "key performance indicators": "kpi",
  "profit and loss": "pnl",
  "generally accepted accounting principles": "gaap",
  "customer relationship management": "crm",
  "enterprise resource planning": "erp",
  "business intelligence": "bi",
  // Healthcare & compliance
  "electronic health record": "ehr",
  "electronic health records": "ehr",
  "electronic medical record": "emr",
  "electronic medical records": "emr",
  "health insurance portability and accountability act": "hipaa",
  // Methodologies
  "test driven development": "tdd",
  "test-driven development": "tdd",
  "behavior driven development": "bdd",
  "behavior-driven development": "bdd",
  "object oriented programming": "oop",
  "object-oriented programming": "oop",
  // APIs & protocols
  "rest api": "rest",
  "restful api": "rest",
  "graphql api": "graphql"
};

/**
 * Pre-sorted synonym keys (longest first) so multi-word synonyms are
 * matched before their sub-strings.
 */
const SORTED_SYNONYM_KEYS: string[] = Object.keys(SYNONYMS).sort((a, b) => b.length - a.length);

/**
 * Action verb tiers for resume bullet quality assessment.
 *
 * - tier1: strong leadership / impact verbs
 * - tier2: solid, active verbs
 * - tier3: weak, passive, or vague verbs
 */
export const VERB_TIERS: { tier1: string[]; tier2: string[]; tier3: string[] } = {
  // Tier 1: High-agency verbs — you drove the outcome, owned the initiative,
  // or produced a measurable transformation. Universal across industries.
  tier1: [
    // Leadership & ownership
    "spearheaded",
    "orchestrated",
    "pioneered",
    "championed",
    "founded",
    "owned",
    "directed",
    "instituted",
    "mobilized",
    "forged",
    // Transformation & impact
    "transformed",
    "revolutionized",
    "overhauled",
    "restructured",
    "consolidated",
    "revitalized",
    "reengineered",
    "modernized",
    // Growth & scale
    "scaled",
    "accelerated",
    "maximized",
    "doubled",
    "tripled",
    "expanded",
    "grew",
    // Launch & delivery
    "launched",
    "shipped",
    "delivered",
    "introduced",
    "established",
    // Elimination & efficiency
    "eliminated",
    "eradicated",
    "streamlined",
    // Revenue & business
    "negotiated",
    "secured",
    "won",
    "captured",
    "generated",
    // Architecture & design
    "architected",
    "engineered",
    "devised",
    "invented",
    // Drove (catch-all impact)
    "drove"
  ],
  // Tier 2: Solid action verbs — you did concrete, skilled work. The backbone
  // of most resume bullets across all industries.
  tier2: [
    // General action
    "managed",
    "developed",
    "implemented",
    "designed",
    "created",
    "built",
    "led",
    "executed",
    "produced",
    "achieved",
    "completed",
    "performed",
    // Improvement & optimisation
    "improved",
    "optimized",
    "enhanced",
    "upgraded",
    "refined",
    "strengthened",
    "reduced",
    "increased",
    "boosted",
    "elevated",
    // Technical / engineering
    "automated",
    "configured",
    "deployed",
    "integrated",
    "migrated",
    "refactored",
    "debugged",
    "programmed",
    "coded",
    "compiled",
    "provisioned",
    "containerized",
    "virtualized",
    // Analysis & research
    "analyzed",
    "researched",
    "investigated",
    "assessed",
    "audited",
    "evaluated",
    "benchmarked",
    "modeled",
    "forecasted",
    "projected",
    "measured",
    "quantified",
    "surveyed",
    "mapped",
    // Problem-solving
    "resolved",
    "diagnosed",
    "troubleshot",
    "debugged",
    "remediated",
    "mitigated",
    "solved",
    // Communication & collaboration
    "presented",
    "authored",
    "published",
    "communicated",
    "articulated",
    "collaborated",
    "partnered",
    "liaised",
    "advocated",
    // Teaching & mentoring
    "mentored",
    "trained",
    "coached",
    "guided",
    "tutored",
    "onboarded",
    // Planning & strategy
    "planned",
    "prioritized",
    "defined",
    "proposed",
    "formulated",
    "strategized",
    "roadmapped",
    "scoped",
    // Operations & coordination
    "coordinated",
    "facilitated",
    "monitored",
    "maintained",
    "supervised",
    "administered",
    "oversaw",
    "regulated",
    "enforced",
    // Documentation & quality
    "documented",
    "tested",
    "reviewed",
    "validated",
    "verified",
    "inspected",
    "certified",
    "standardized",
    "catalogued",
    // Finance & business
    "budgeted",
    "allocated",
    "reconciled",
    "invoiced",
    "procured",
    "appraised",
    "underwrote",
    "liquidated",
    // Healthcare & science
    "treated",
    "prescribed",
    "triaged",
    "immunized",
    "rehabilitated",
    "synthesized",
    "extracted",
    "cultivated",
    "formulated",
    // Marketing & sales
    "marketed",
    "promoted",
    "advertised",
    "pitched",
    "prospected",
    "converted",
    "retained",
    "segmented",
    "branded",
    // Creative & design
    "illustrated",
    "composed",
    "curated",
    "photographed",
    "animated",
    "sculpted",
    "drafted",
    "sketched",
    "rendered",
    "storyboarded",
    // Legal & compliance
    "litigated",
    "arbitrated",
    "mediated",
    "adjudicated",
    "prosecuted",
    "counseled",
    "filed",
    "petitioned",
    // Education & academia
    "taught",
    "lectured",
    "graded",
    "supervised",
    "advised",
    "curriculated",
    "enrolled",
    // Logistics & operations
    "dispatched",
    "distributed",
    "transported",
    "warehoused",
    "routed",
    "scheduled",
    "expedited",
    "sourced",
    // Law enforcement & military
    "patrolled",
    "apprehended",
    "surveilled",
    "detained",
    "interrogated",
    "briefed",
    "safeguarded",
    "escorted",
    "defused",
    // Construction & trades
    "installed",
    "fabricated",
    "welded",
    "wired",
    "plumbed",
    "demolished",
    "excavated",
    "erected",
    "renovated",
    "assembled",
    // Real estate & property
    "listed",
    "staged",
    "closed",
    "leased",
    "brokered",
    // Hospitality & food service
    "catered",
    "hosted",
    "bartended",
    "garnished",
    "plated",
    // Social work & counseling
    "intervened",
    "referred",
    "rehabilitated",
    "assessed",
    // Agriculture & environmental
    "harvested",
    "irrigated",
    "conserved",
    "composted",
    "propagated",
    // Government & policy
    "legislated",
    "lobbied",
    "ratified",
    "enacted",
    "governed",
    // Journalism & media
    "reported",
    "edited",
    "interviewed",
    "broadcast",
    "anchored",
    // Identified & discovered (common across industries)
    "identified",
    "discovered",
    "uncovered",
    "detected",
    "flagged"
  ],
  // Tier 3: Low-agency verbs — passive, vague, or diluting. These suggest
  // the person was present but didn't own the outcome.
  tier3: [
    "helped",
    "assisted",
    "participated",
    "contributed",
    "supported",
    "worked",
    "responsible",
    "involved",
    "utilized",
    "handled",
    "aided",
    "attended",
    "observed",
    "shadowed",
    "familiarized",
    "attempted",
    "tried",
    "served",
    "functioned",
    "acted",
    "exposed",
    "tasked",
    "assigned",
    "engaged"
  ]
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
  analysis: "analysis",
  basis: "basis",
  diagnosis: "diagnosis",
  synthesis: "synthesis",
  thesis: "thesis",
  hypothesis: "hypothesis",
  parenthesis: "parenthesis",
  emphasis: "emphasis",
  // Keep common tech acronyms intact (Porter would mangle these)
  aws: "aws",
  gcp: "gcp",
  api: "api",
  apis: "api",
  css: "css",
  sql: "sql",
  nosql: "nosql",
  html: "html",
  json: "json",
  xml: "xml",
  yaml: "yaml",
  jwt: "jwt",
  oauth: "oauth",
  saml: "saml",
  ldap: "ldap",
  smtp: "smtp",
  http: "http",
  https: "http",
  grpc: "grpc",
  mqtt: "mqtt",
  url: "url",
  urls: "url",
  uri: "uri",
  uris: "uri",
  sdk: "sdk",
  sdks: "sdk",
  cli: "cli",
  clis: "cli",
  ide: "ide",
  ides: "ide",
  orm: "orm",
  orms: "orm",
  etl: "etl",
  kpi: "kpi",
  kpis: "kpi",
  roi: "roi",
  sla: "sla",
  slas: "sla",
  hipaa: "hipaa",
  gaap: "gaap",
  gdpr: "gdpr",
  sox: "sox",
  pci: "pci",
  // Container / orchestration canonical forms
  kubernetes: "k8s",
  k8s: "k8s",
  docker: "docker",
  terraform: "terraform"
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
  let result = text.toLowerCase().trim().replace(/\s+/g, " ");

  // Apply synonyms longest-first
  for (const key of SORTED_SYNONYM_KEYS) {
    const value = SYNONYMS[key];
    if (key.includes(" ")) {
      // Multi-word synonym: simple string replacement
      result = result.replaceAll(key, value);
    } else {
      // Single-word synonym: word-boundary regex to avoid partial matches.
      // Escape dots in keys like "react.js" for regex safety.
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, "g");
      result = result.replace(regex, value);
    }
  }

  // Re-collapse whitespace in case synonym replacement left gaps
  result = result.trim().replace(/\s+/g, " ");

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
  return tag.startsWith("VB");
}

export function extractTerms(text: string): Set<string> {
  const normalised = normalise(text);
  const tokens = tokenize(normalised);

  // Filter stop words
  const filtered = tokens.filter(t => !STOP_WORDS.has(t));

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
