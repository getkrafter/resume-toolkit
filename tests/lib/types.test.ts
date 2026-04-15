import { describe, it, expectTypeOf } from 'vitest';
import type { ResumeData, ATSResult, ResumeScore } from '../../src/lib/types.js';

describe('types', () => {
  it('ResumeData has required fields', () => {
    expectTypeOf<ResumeData>().toHaveProperty('rawText');
    expectTypeOf<ResumeData>().toHaveProperty('bullets');
    expectTypeOf<ResumeData>().toHaveProperty('sections');
  });

  it('ResumeScore includes mode field', () => {
    expectTypeOf<ResumeScore>().toHaveProperty('mode');
    expectTypeOf<ResumeScore>().toHaveProperty('total');
    expectTypeOf<ResumeScore>().toHaveProperty('breakdown');
    expectTypeOf<ResumeScore>().toHaveProperty('ats');
    expectTypeOf<ResumeScore>().toHaveProperty('flags');
  });

  it('ATSResult has details breakdown', () => {
    expectTypeOf<ATSResult>().toHaveProperty('score');
    expectTypeOf<ATSResult>().toHaveProperty('matched');
    expectTypeOf<ATSResult>().toHaveProperty('missing');
    expectTypeOf<ATSResult>().toHaveProperty('details');
  });
});
