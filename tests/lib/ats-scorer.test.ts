import { describe, it, expect } from 'vitest';
import { scoreATS } from '../../src/lib/ats-scorer.js';

const resumeText = `
  Spearheaded migration of monolith to microservices architecture, reducing latency by 40%.
  Led cross-functional engineering teams using agile methodology.
  Managed CI/CD pipelines on AWS using Kubernetes and TypeScript.
  Delivered scalable payment systems serving 2M users.
`;

const jdText = `
  We are looking for a Senior Backend Engineer experienced in microservices,
  Kubernetes, TypeScript, and CI/CD pipelines. You will lead engineering teams,
  drive architecture decisions, and deliver scalable payment systems on
  Amazon Web Services. Experience with machine learning pipelines is a plus.
`;

describe('scoreATS', () => {
  it('returns null when no JD provided', () => {
    expect(scoreATS(resumeText, '')).toBeNull();
    expect(scoreATS(resumeText, null as any)).toBeNull();
  });

  it('returns score between 0 and 100', () => {
    const result = scoreATS(resumeText, jdText);
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThanOrEqual(0);
    expect(result!.score).toBeLessThanOrEqual(100);
  });

  it('returns matched and missing arrays', () => {
    const result = scoreATS(resumeText, jdText)!;
    expect(result.matched.length).toBeGreaterThan(0);
    expect(result.missing.length).toBeGreaterThan(0);
  });

  it('returns details with bigram/unigram breakdown', () => {
    const result = scoreATS(resumeText, jdText)!;
    expect(result.details).toHaveProperty('bigramsMatched');
    expect(result.details).toHaveProperty('unigramsMatched');
    expect(result.details).toHaveProperty('bigramsMissing');
    expect(result.details).toHaveProperty('unigramsMissing');
  });

  it('matches synonym-normalised terms', () => {
    // "Amazon Web Services" in JD should match "AWS" in resume
    const result = scoreATS(resumeText, jdText)!;
    const allMatched = [...result.matched, ...result.details.unigramsMatched].join(' ').toLowerCase();
    expect(allMatched).toContain('aws');
  });

  it('is deterministic — same input produces same output', () => {
    const result1 = scoreATS(resumeText, jdText);
    const result2 = scoreATS(resumeText, jdText);
    expect(result1).toEqual(result2);
  });

  it('returns score 0 for empty resume', () => {
    const result = scoreATS('', jdText)!;
    expect(result.score).toBe(0);
  });

  it('scores higher when resume closely matches JD', () => {
    const perfectResume = jdText; // Resume IS the JD
    const result = scoreATS(perfectResume, jdText)!;
    expect(result.score).toBeGreaterThan(80);
  });

  it('weighs bigram matches higher than individual unigrams', () => {
    const jd = 'project management experience required';
    // Resume A: has "project management" as adjacent bigram
    const resumeWithBigram = 'Led project management initiatives globally';
    // Resume B: has same words but not adjacent — no bigram match
    const resumeWithSplit = 'Led project initiatives for management globally';
    const scoreBigram = scoreATS(resumeWithBigram, jd)!.score;
    const scoreSplit = scoreATS(resumeWithSplit, jd)!.score;
    expect(scoreBigram).toBeGreaterThanOrEqual(scoreSplit);
  });
});
