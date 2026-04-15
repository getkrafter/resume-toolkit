import { describe, it, expect } from 'vitest';
import { toResumeData } from '../../src/lib/resume-transformer.js';

const mockResume = {
  firstName: 'John',
  lastName: 'Doe',
  jobTitle: 'Senior Software Engineer',
  professionalSummary: '<p>Experienced engineer with <strong>10 years</strong> in full-stack development.</p>',
  sections: [
    {
      name: 'Experience',
      type: 'work',
      items: [
        {
          title: 'Senior Engineer',
          subtitle: 'Acme Corp',
          startDate: '2020-01',
          endDate: 'Present',
          description: '<ul><li>Spearheaded migration to microservices, reducing latency by 40%</li><li>Led team of 8 engineers across 3 time zones</li></ul>',
        },
        {
          title: 'Software Engineer',
          subtitle: 'StartupCo',
          startDate: '2017-06',
          endDate: '2019-12',
          description: '<ul><li>Built real-time data pipeline processing 2M events/day</li></ul>',
        },
      ],
    },
    {
      name: 'Education',
      type: 'education',
      items: [
        {
          title: 'B.S. Computer Science',
          subtitle: 'MIT',
          startDate: '2013-09',
          endDate: '2017-05',
          description: '',
        },
      ],
    },
    {
      name: 'Skills',
      type: 'skills',
      items: [
        { name: 'TypeScript' },
        { name: 'React' },
        { name: 'Node.js' },
        { name: 'Kubernetes' },
      ],
    },
  ],
};

describe('toResumeData', () => {
  it('extracts bullets from HTML li elements', () => {
    const result = toResumeData(mockResume);
    expect(result.bullets).toContain('Spearheaded migration to microservices, reducing latency by 40%');
    expect(result.bullets).toContain('Led team of 8 engineers across 3 time zones');
    expect(result.bullets).toContain('Built real-time data pipeline processing 2M events/day');
    expect(result.bullets).toHaveLength(3);
  });

  it('strips HTML tags from all text', () => {
    const result = toResumeData(mockResume);
    expect(result.rawText).not.toContain('<p>');
    expect(result.rawText).not.toContain('<strong>');
    expect(result.rawText).not.toContain('<ul>');
    expect(result.rawText).not.toContain('<li>');
  });

  it('concatenates all text fields into rawText', () => {
    const result = toResumeData(mockResume);
    expect(result.rawText).toContain('John');
    expect(result.rawText).toContain('Doe');
    expect(result.rawText).toContain('Senior Software Engineer');
    expect(result.rawText).toContain('10 years');
    expect(result.rawText).toContain('TypeScript');
    expect(result.rawText).toContain('Kubernetes');
  });

  it('extracts section heading names into sections array', () => {
    const result = toResumeData(mockResume);
    expect(result.sections).toContain('experience');
    expect(result.sections).toContain('education');
    expect(result.sections).toContain('skills');
  });

  it('returns empty-but-valid ResumeData for empty input', () => {
    const result = toResumeData({});
    expect(result.rawText).toBe('');
    expect(result.bullets).toEqual([]);
    expect(result.sections).toEqual([]);
  });

  it('handles missing fields gracefully', () => {
    const partial = { firstName: 'Jane', sections: [] };
    expect(() => toResumeData(partial)).not.toThrow();
    const result = toResumeData(partial);
    expect(result.rawText).toContain('Jane');
  });

  it('handles sections with different item types', () => {
    const resume = {
      sections: [
        {
          name: 'Projects',
          type: 'projects',
          items: [
            {
              title: 'Open Source Tool',
              description: '<ul><li>Created CLI tool with 5K+ GitHub stars</li></ul>',
            },
          ],
        },
      ],
    };
    const result = toResumeData(resume);
    expect(result.bullets).toContain('Created CLI tool with 5K+ GitHub stars');
    expect(result.sections).toContain('projects');
  });
});
