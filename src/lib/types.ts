export interface ResumeData {
  rawText: string;
  bullets: string[];
  sections: string[];
}

export interface ATSResult {
  score: number;
  matched: string[];
  missing: string[];
  details: {
    bigramsMatched: string[];
    unigramsMatched: string[];
    bigramsMissing: string[];
    unigramsMissing: string[];
  };
}

export interface ScoreDimension {
  score: number;
  weight: number;
  weightedScore: number;
}

export type ScoreMode = 'with-jd' | 'without-jd';

export interface ResumeScore {
  total: number;
  mode: ScoreMode;
  breakdown: Record<string, ScoreDimension>;
  ats: ATSResult | null;
  flags: string[];
}

export type VerbTier = 1 | 2 | 3 | null;
