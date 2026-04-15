import { describe, it, expect } from 'vitest';
import { scoreResume } from '../../src/lib/resume-scorer.js';
import type { ResumeData } from '../../src/lib/types.js';

const fullResume: ResumeData = {
  rawText:
    'John Doe Senior Software Engineer Experienced engineer with 10 years in full-stack development. Spearheaded migration to microservices reducing latency by 40%. Led team of 8 engineers across 3 time zones. Built real-time data pipeline processing 2M events per day. Managed CI/CD pipelines on AWS using Kubernetes and TypeScript. Delivered scalable payment systems serving 2M users. Experience Education Skills',
  bullets: [
    'Spearheaded migration to microservices architecture, reducing latency by 40%',
    'Led team of 8 engineers across 3 time zones to deliver platform on schedule',
    'Built real-time data pipeline processing 2M events per day',
    'Managed CI/CD pipelines on AWS using Kubernetes and TypeScript',
    'Delivered scalable payment systems serving 2M users',
  ],
  sections: ['experience', 'education', 'skills'],
};

const jdText = `
  Senior Backend Engineer experienced in microservices,
  Kubernetes, TypeScript, and CI/CD pipelines.
`;

const emptyResume: ResumeData = {
  rawText: '',
  bullets: [],
  sections: [],
};

describe('scoreResume', () => {
  it('returns ResumeScore with all required fields', () => {
    const result = scoreResume(fullResume);
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('mode');
    expect(result).toHaveProperty('breakdown');
    expect(result).toHaveProperty('ats');
    expect(result).toHaveProperty('flags');
  });

  it('mode is without-jd when no JD provided', () => {
    const result = scoreResume(fullResume);
    expect(result.mode).toBe('without-jd');
    expect(result.ats).toBeNull();
  });

  it('mode is with-jd when JD provided', () => {
    const result = scoreResume(fullResume, jdText);
    expect(result.mode).toBe('with-jd');
    expect(result.ats).not.toBeNull();
  });

  it('redistributes weights when no JD', () => {
    const result = scoreResume(fullResume);
    expect(result.breakdown['ats'].weight).toBe(0);
    // Other weights should sum to ~1.0
    const otherWeights = Object.entries(result.breakdown)
      .filter(([key]) => key !== 'ats')
      .reduce((sum, [, dim]) => sum + dim.weight, 0);
    expect(otherWeights).toBeCloseTo(1.0, 1);
  });

  it('total is 0 for empty resume with empty flag', () => {
    const result = scoreResume(emptyResume);
    expect(result.total).toBe(0);
    expect(result.flags).toContain('Resume appears empty');
  });

  it('flags unusually short resume', () => {
    const shortResume: ResumeData = {
      rawText:
        'John Doe engineer some words here and there but not fifty words total',
      bullets: [],
      sections: [],
    };
    const result = scoreResume(shortResume);
    expect(result.flags).toContain('Resume is unusually short');
  });

  it('tier1 verbs score higher than tier3', () => {
    const tier1Resume: ResumeData = {
      rawText: 'experience education skills',
      bullets: [
        'Spearheaded migration of the entire platform to cloud infrastructure',
      ],
      sections: ['experience', 'education', 'skills'],
    };
    const tier3Resume: ResumeData = {
      rawText: 'experience education skills',
      bullets: [
        'Helped with migration of the entire platform to cloud infrastructure',
      ],
      sections: ['experience', 'education', 'skills'],
    };
    const score1 = scoreResume(tier1Resume);
    const score3 = scoreResume(tier3Resume);
    expect(score1.breakdown['verbStrength'].score).toBeGreaterThan(
      score3.breakdown['verbStrength'].score,
    );
  });

  it('verb detection uses word boundaries — led does not match ledger', () => {
    const resume: ResumeData = {
      rawText: 'experience education skills',
      bullets: [
        'Ledger entries were reconciled across all accounts in the system',
      ],
      sections: ['experience', 'education', 'skills'],
    };
    const result = scoreResume(resume);
    // "ledger" should NOT be matched as "led" (tier2 verb)
    // The first word "Ledger" stems differently from "led"
    expect(result.breakdown['verbStrength'].score).toBeLessThan(60);
  });

  it('bullets with numbers score higher in quantification', () => {
    const withNumbers: ResumeData = {
      rawText: 'experience education skills',
      bullets: [
        'Reduced costs by 30%',
        'Increased revenue by $2M',
        'Led 5 engineers',
      ],
      sections: ['experience', 'education', 'skills'],
    };
    const withoutNumbers: ResumeData = {
      rawText: 'experience education skills',
      bullets: [
        'Reduced costs significantly',
        'Increased revenue greatly',
        'Led engineers',
      ],
      sections: ['experience', 'education', 'skills'],
    };
    const score1 = scoreResume(withNumbers);
    const score2 = scoreResume(withoutNumbers);
    expect(score1.breakdown['quantification'].score).toBeGreaterThan(
      score2.breakdown['quantification'].score,
    );
  });

  it('section completeness scores required sections higher', () => {
    const requiredOnly: ResumeData = {
      rawText: 'text',
      bullets: [],
      sections: ['experience', 'education', 'skills'],
    };
    const recommendedOnly: ResumeData = {
      rawText: 'text',
      bullets: [],
      sections: ['summary', 'projects', 'certifications'],
    };
    const score1 = scoreResume(requiredOnly);
    const score2 = scoreResume(recommendedOnly);
    expect(score1.breakdown['sectionCompleteness'].score).toBeGreaterThan(
      score2.breakdown['sectionCompleteness'].score,
    );
  });

  it('is deterministic', () => {
    const result1 = scoreResume(fullResume, jdText);
    const result2 = scoreResume(fullResume, jdText);
    expect(result1).toEqual(result2);
  });

  it('total is between 0 and 100', () => {
    const result = scoreResume(fullResume, jdText);
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it('includes no-JD flag when JD not provided', () => {
    const result = scoreResume(fullResume);
    expect(result.flags).toContain(
      'No job description provided — ATS score excluded, weights redistributed.',
    );
  });

  // -------------------------------------------------------------------------
  // Additional edge-case and sub-scorer tests
  // -------------------------------------------------------------------------

  describe('scoreQuantification', () => {
    it('returns 100 when all bullets have numbers', () => {
      const resume: ResumeData = {
        rawText: 'experience education skills',
        bullets: [
          'Reduced costs by 30%',
          'Led 8 engineers',
          'Processed 2M events daily',
        ],
        sections: ['experience', 'education', 'skills'],
      };
      const result = scoreResume(resume);
      expect(result.breakdown['quantification'].score).toBe(100);
    });

    it('returns 0 when no bullets have numbers', () => {
      const resume: ResumeData = {
        rawText: 'experience education skills',
        bullets: [
          'Reduced costs significantly',
          'Led a team of engineers',
          'Processed events daily',
        ],
        sections: ['experience', 'education', 'skills'],
      };
      const result = scoreResume(resume);
      expect(result.breakdown['quantification'].score).toBe(0);
    });

    it('returns 0 when bullets array is empty', () => {
      const resume: ResumeData = {
        rawText: 'experience education skills',
        bullets: [],
        sections: ['experience', 'education', 'skills'],
      };
      const result = scoreResume(resume);
      expect(result.breakdown['quantification'].score).toBe(0);
    });
  });

  describe('scoreVerbStrength', () => {
    it('scores 100 for tier1 verbs', () => {
      const resume: ResumeData = {
        rawText: 'experience education skills',
        bullets: [
          'Spearheaded migration of the entire platform to cloud',
          'Orchestrated cross-team collaboration across 5 departments',
        ],
        sections: ['experience', 'education', 'skills'],
      };
      const result = scoreResume(resume);
      expect(result.breakdown['verbStrength'].score).toBe(100);
    });

    it('scores 60 for tier2 verbs', () => {
      const resume: ResumeData = {
        rawText: 'experience education skills',
        bullets: [
          'Managed a team of engineers to deliver on schedule',
          'Developed a new feature for the product pipeline',
        ],
        sections: ['experience', 'education', 'skills'],
      };
      const result = scoreResume(resume);
      expect(result.breakdown['verbStrength'].score).toBe(60);
    });

    it('scores 20 for tier3 verbs', () => {
      const resume: ResumeData = {
        rawText: 'experience education skills',
        bullets: [
          'Helped with the migration of the platform to cloud',
          'Assisted in development of new features for the product',
        ],
        sections: ['experience', 'education', 'skills'],
      };
      const result = scoreResume(resume);
      expect(result.breakdown['verbStrength'].score).toBe(20);
    });

    it('scores 40 for unrecognized verbs', () => {
      const resume: ResumeData = {
        rawText: 'experience education skills',
        bullets: [
          'Configured network settings for optimal throughput',
          'Tested applications to ensure quality requirements were met',
        ],
        sections: ['experience', 'education', 'skills'],
      };
      const result = scoreResume(resume);
      expect(result.breakdown['verbStrength'].score).toBe(40);
    });

    it('returns 0 for empty bullets', () => {
      const resume: ResumeData = {
        rawText: 'experience education skills',
        bullets: [],
        sections: ['experience', 'education', 'skills'],
      };
      const result = scoreResume(resume);
      expect(result.breakdown['verbStrength'].score).toBe(0);
    });
  });

  describe('scoreBulletStructure', () => {
    it('returns 100 when all bullets are strong', () => {
      const resume: ResumeData = {
        rawText: 'experience education skills',
        bullets: [
          'Spearheaded migration to microservices architecture reducing latency by 40 percent across systems',
          'Led team of 8 engineers across 3 time zones to deliver on schedule',
        ],
        sections: ['experience', 'education', 'skills'],
      };
      const result = scoreResume(resume);
      expect(result.breakdown['bulletStructure'].score).toBe(100);
    });

    it('returns 0 when no bullets are strong', () => {
      const resume: ResumeData = {
        rawText: 'experience education skills',
        bullets: ['Did stuff', 'Made things'],
        sections: ['experience', 'education', 'skills'],
      };
      const result = scoreResume(resume);
      expect(result.breakdown['bulletStructure'].score).toBe(0);
    });

    it('returns 0 for empty bullets', () => {
      const resume: ResumeData = {
        rawText: 'experience education skills',
        bullets: [],
        sections: ['experience', 'education', 'skills'],
      };
      const result = scoreResume(resume);
      expect(result.breakdown['bulletStructure'].score).toBe(0);
    });
  });

  describe('scoreSectionCompleteness', () => {
    it('scores 60 for all required sections only', () => {
      const resume: ResumeData = {
        rawText: 'text',
        bullets: [],
        sections: ['experience', 'education', 'skills'],
      };
      const result = scoreResume(resume);
      expect(result.breakdown['sectionCompleteness'].score).toBe(60);
    });

    it('caps at 100 with all sections', () => {
      const resume: ResumeData = {
        rawText: 'text',
        bullets: [],
        sections: [
          'experience',
          'education',
          'skills',
          'summary',
          'projects',
          'certifications',
        ],
      };
      const result = scoreResume(resume);
      expect(result.breakdown['sectionCompleteness'].score).toBe(100);
    });

    it('matches substrings (e.g. "work experience" matches "experience")', () => {
      const resume: ResumeData = {
        rawText: 'text',
        bullets: [],
        sections: ['work experience', 'education', 'technical skills'],
      };
      const result = scoreResume(resume);
      // "work experience" matches "experience" (20), "education" (20), "technical skills" matches "skills" (20) = 60
      expect(result.breakdown['sectionCompleteness'].score).toBe(60);
    });

    it('returns 0 for no sections', () => {
      const resume: ResumeData = {
        rawText: 'text',
        bullets: [],
        sections: [],
      };
      const result = scoreResume(resume);
      expect(result.breakdown['sectionCompleteness'].score).toBe(0);
    });
  });

  describe('weight distribution', () => {
    it('uses correct weights with JD', () => {
      const result = scoreResume(fullResume, jdText);
      expect(result.breakdown['quantification'].weight).toBeCloseTo(0.25, 2);
      expect(result.breakdown['verbStrength'].weight).toBeCloseTo(0.2, 2);
      expect(result.breakdown['ats'].weight).toBeCloseTo(0.3, 2);
      expect(result.breakdown['bulletStructure'].weight).toBeCloseTo(0.15, 2);
      expect(result.breakdown['sectionCompleteness'].weight).toBeCloseTo(
        0.1,
        2,
      );
    });

    it('redistributes weights proportionally without JD', () => {
      const result = scoreResume(fullResume);
      // Without JD, ATS weight is 0 and others scale up: each * (1 / 0.70)
      expect(result.breakdown['ats'].weight).toBe(0);
      expect(result.breakdown['quantification'].weight).toBeCloseTo(
        0.25 / 0.7,
        2,
      );
      expect(result.breakdown['verbStrength'].weight).toBeCloseTo(
        0.2 / 0.7,
        2,
      );
      expect(result.breakdown['bulletStructure'].weight).toBeCloseTo(
        0.15 / 0.7,
        2,
      );
      expect(result.breakdown['sectionCompleteness'].weight).toBeCloseTo(
        0.1 / 0.7,
        2,
      );
    });

    it('all weights sum to 1.0 with JD', () => {
      const result = scoreResume(fullResume, jdText);
      const totalWeight = Object.values(result.breakdown).reduce(
        (sum, dim) => sum + dim.weight,
        0,
      );
      expect(totalWeight).toBeCloseTo(1.0, 2);
    });

    it('all weights sum to 1.0 without JD', () => {
      const result = scoreResume(fullResume);
      const totalWeight = Object.values(result.breakdown).reduce(
        (sum, dim) => sum + dim.weight,
        0,
      );
      expect(totalWeight).toBeCloseTo(1.0, 2);
    });
  });

  describe('flags', () => {
    it('flags low quantification score', () => {
      const resume: ResumeData = {
        rawText: 'experience education skills some additional words to pad this text',
        bullets: [
          'Reduced costs significantly across all departments',
          'Led engineers to deliver product on time and budget',
          'Processed events in real time with low overhead',
        ],
        sections: ['experience', 'education', 'skills'],
      };
      const result = scoreResume(resume);
      expect(result.flags).toContain(
        'Fewer than 40% of bullets contain measurable results. Add numbers, percentages, or metrics.',
      );
    });

    it('flags low verb strength score', () => {
      const resume: ResumeData = {
        rawText: 'experience education skills some additional words to pad this text',
        bullets: [
          'Helped with the migration of the platform to cloud',
          'Assisted in development of new features for the product',
          'Participated in code reviews and team meetings regularly',
        ],
        sections: ['experience', 'education', 'skills'],
      };
      const result = scoreResume(resume);
      expect(result.flags).toContain(
        'Action verb quality is low. Replace weak/passive openers with strong action verbs.',
      );
    });

    it('flags low bullet structure score', () => {
      const resume: ResumeData = {
        rawText: 'experience education skills some additional words to pad this text',
        bullets: ['Did stuff', 'Made things', 'Fixed bugs'],
        sections: ['experience', 'education', 'skills'],
      };
      const result = scoreResume(resume);
      expect(result.flags).toContain(
        'Most bullets lack the verb -> action -> outcome structure.',
      );
    });

    it('flags missing summary/profile section', () => {
      const resume: ResumeData = {
        rawText: 'experience education skills some additional words to pad this text',
        bullets: [],
        sections: ['experience', 'education', 'skills'],
      };
      const result = scoreResume(resume);
      expect(result.flags).toContain('No summary/profile section found.');
    });

    it('does not flag summary/profile when present', () => {
      const resume: ResumeData = {
        rawText: 'experience education skills summary some additional words to pad this',
        bullets: [],
        sections: ['experience', 'education', 'skills', 'summary'],
      };
      const result = scoreResume(resume);
      expect(result.flags).not.toContain(
        'No summary/profile section found.',
      );
    });

    it('does not flag summary/profile when profile is present', () => {
      const resume: ResumeData = {
        rawText: 'experience education skills profile some additional words to pad this',
        bullets: [],
        sections: ['experience', 'education', 'skills', 'profile'],
      };
      const result = scoreResume(resume);
      expect(result.flags).not.toContain(
        'No summary/profile section found.',
      );
    });

    it('flags low ATS score with missing terms', () => {
      const sparseResume: ResumeData = {
        rawText: 'John Doe Software Engineer basic resume with minimal content and not many relevant keywords at all for this position or any other similar role',
        bullets: [],
        sections: [],
      };
      const detailedJd = `
        We need a Senior Backend Engineer with expertise in microservices,
        Kubernetes, Docker, TypeScript, CI/CD pipelines, PostgreSQL,
        Redis, GraphQL, REST APIs, and machine learning.
      `;
      const result = scoreResume(sparseResume, detailedJd);
      if (result.ats && result.ats.score < 50) {
        const lowAtsFlag = result.flags.find((f) =>
          f.startsWith('Low ATS match'),
        );
        expect(lowAtsFlag).toBeDefined();
      }
    });
  });

  describe('breakdown weightedScore calculation', () => {
    it('weightedScore equals score * weight for each dimension', () => {
      const result = scoreResume(fullResume, jdText);
      for (const [, dim] of Object.entries(result.breakdown)) {
        expect(dim.weightedScore).toBeCloseTo(dim.score * dim.weight, 1);
      }
    });

    it('total equals sum of all weightedScores', () => {
      const result = scoreResume(fullResume, jdText);
      const calculatedTotal = Object.values(result.breakdown).reduce(
        (sum, dim) => sum + dim.weightedScore,
        0,
      );
      expect(result.total).toBeCloseTo(calculatedTotal, 1);
    });
  });

  describe('full resume with JD integration', () => {
    it('full resume with matching JD scores well', () => {
      const result = scoreResume(fullResume, jdText);
      // Full resume with strong bullets and a matching JD should score decently
      expect(result.total).toBeGreaterThan(40);
    });

    it('ATS result is populated when JD provided', () => {
      const result = scoreResume(fullResume, jdText);
      expect(result.ats).not.toBeNull();
      expect(result.ats!.score).toBeGreaterThanOrEqual(0);
      expect(result.ats!.score).toBeLessThanOrEqual(100);
      expect(result.ats!.matched).toBeDefined();
      expect(result.ats!.missing).toBeDefined();
    });
  });
});
