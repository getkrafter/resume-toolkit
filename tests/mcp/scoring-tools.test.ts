import { describe, it, expect } from 'vitest';
import { getScoringTools } from '../../src/mcp/tools/scoring.js';

describe('scoring tools', () => {
  const tools = getScoringTools();
  const scoreResumeTool = tools.find((t) => t.name === 'score_resume')!;
  const scoreAtsTool = tools.find((t) => t.name === 'score_ats')!;

  // ------------------------------------------------------------------
  // Tool registration
  // ------------------------------------------------------------------

  it('exports exactly two tools', () => {
    expect(tools).toHaveLength(2);
  });

  it('score_resume tool exists with correct metadata', () => {
    expect(scoreResumeTool).toBeDefined();
    expect(scoreResumeTool.name).toBe('score_resume');
    expect(scoreResumeTool.description).toBeTruthy();
  });

  it('score_ats tool exists with correct metadata', () => {
    expect(scoreAtsTool).toBeDefined();
    expect(scoreAtsTool.name).toBe('score_ats');
    expect(scoreAtsTool.description).toBeTruthy();
  });

  // ------------------------------------------------------------------
  // score_resume tool
  // ------------------------------------------------------------------

  it('score_resume returns valid MCP result format', async () => {
    const result = await scoreResumeTool.handler({
      resumeText:
        'Spearheaded migration to microservices, reducing latency by 40%.\nLed team of 8 engineers.',
    });

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveProperty('total');
    expect(parsed).toHaveProperty('mode', 'without-jd');
    expect(parsed).toHaveProperty('breakdown');
    expect(parsed).toHaveProperty('flags');
  });

  it('score_resume with JD returns with-jd mode', async () => {
    const result = await scoreResumeTool.handler({
      resumeText: 'Built microservices with Kubernetes and TypeScript',
      jdText: 'Looking for microservices engineer with Kubernetes experience',
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.mode).toBe('with-jd');
    expect(parsed.ats).not.toBeNull();
  });

  it('score_resume returns numeric total between 0 and 100', async () => {
    const result = await scoreResumeTool.handler({
      resumeText:
        'Spearheaded migration to microservices, reducing latency by 40%.\nLed team of 8 engineers delivering critical features on schedule.',
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(typeof parsed.total).toBe('number');
    expect(parsed.total).toBeGreaterThanOrEqual(0);
    expect(parsed.total).toBeLessThanOrEqual(100);
  });

  it('score_resume handles empty input', async () => {
    const result = await scoreResumeTool.handler({ resumeText: '' });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.total).toBe(0);
  });

  it('score_resume parses bullet points from raw text', async () => {
    const result = await scoreResumeTool.handler({
      resumeText: [
        'Experience',
        '- Spearheaded migration to microservices, reducing latency by 40%',
        '- Led team of 8 engineers',
        '* Designed REST APIs serving 10M requests/day',
        '1. Built CI/CD pipeline reducing deploy time by 60%',
      ].join('\n'),
    });

    const parsed = JSON.parse(result.content[0].text);
    // Should have parsed 4 bullets (the - , * , and numbered items)
    expect(parsed.total).toBeGreaterThan(0);
  });

  it('score_resume detects section headings', async () => {
    const result = await scoreResumeTool.handler({
      resumeText: [
        'EXPERIENCE',
        '- Spearheaded migration to microservices, reducing latency by 40%',
        'EDUCATION',
        '- BS Computer Science, Stanford University',
        'SKILLS',
        '- TypeScript, Python, Kubernetes, AWS',
      ].join('\n'),
    });

    const parsed = JSON.parse(result.content[0].text);
    // Section completeness should be non-zero since we have Experience, Education, Skills
    expect(parsed.breakdown.sectionCompleteness.score).toBeGreaterThan(0);
  });

  // ------------------------------------------------------------------
  // score_ats tool
  // ------------------------------------------------------------------

  it('score_ats returns ATSResult', async () => {
    const result = await scoreAtsTool.handler({
      resumeText: 'Built microservices with Kubernetes and TypeScript',
      jdText: 'Senior Kubernetes TypeScript engineer for microservices',
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveProperty('score');
    expect(parsed).toHaveProperty('matched');
    expect(parsed).toHaveProperty('missing');
    expect(parsed).toHaveProperty('details');
  });

  it('score_ats returns numeric score between 0 and 100', async () => {
    const result = await scoreAtsTool.handler({
      resumeText:
        'Built microservices with Kubernetes, TypeScript, and Docker in AWS',
      jdText:
        'Looking for engineer with Kubernetes, TypeScript, Docker, AWS, and microservices experience',
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(typeof parsed.score).toBe('number');
    expect(parsed.score).toBeGreaterThanOrEqual(0);
    expect(parsed.score).toBeLessThanOrEqual(100);
  });

  it('score_ats returns null for empty JD', async () => {
    const result = await scoreAtsTool.handler({
      resumeText: 'Some resume text here',
      jdText: '',
    });

    const parsed = JSON.parse(result.content[0].text);
    // scoreATS returns null for empty JD, which gets serialized as null
    expect(parsed).toBeNull();
  });

  it('score_ats matched array contains keywords from both texts', async () => {
    const result = await scoreAtsTool.handler({
      resumeText: 'Expert in Kubernetes and Docker containerization',
      jdText: 'Requires Kubernetes and Docker experience',
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.matched.length).toBeGreaterThan(0);
  });

  // ------------------------------------------------------------------
  // parseRawText edge cases (tested through score_resume handler)
  // ------------------------------------------------------------------

  it('score_resume handles bullet markers: dash, bullet char, asterisk', async () => {
    const dashResult = await scoreResumeTool.handler({
      resumeText: '- Implemented feature reducing errors by 30%',
    });
    const bulletResult = await scoreResumeTool.handler({
      resumeText: '\u2022 Implemented feature reducing errors by 30%',
    });
    const asteriskResult = await scoreResumeTool.handler({
      resumeText: '* Implemented feature reducing errors by 30%',
    });

    const dashParsed = JSON.parse(dashResult.content[0].text);
    const bulletParsed = JSON.parse(bulletResult.content[0].text);
    const asteriskParsed = JSON.parse(asteriskResult.content[0].text);

    // All three should produce comparable scores since the bullet content is identical
    expect(dashParsed.total).toBeGreaterThan(0);
    expect(bulletParsed.total).toBeGreaterThan(0);
    expect(asteriskParsed.total).toBeGreaterThan(0);
  });

  it('score_resume handles numbered list bullets', async () => {
    const result = await scoreResumeTool.handler({
      resumeText: [
        '1. Spearheaded migration to microservices, reducing latency by 40%',
        '2. Led team of 8 engineers',
        '3. Designed REST APIs serving 10M requests/day',
      ].join('\n'),
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.total).toBeGreaterThan(0);
  });

  it('score_resume with only whitespace returns zero total', async () => {
    const result = await scoreResumeTool.handler({ resumeText: '   \n  \n  ' });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.total).toBe(0);
  });
});
