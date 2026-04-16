# @getkrafter/resume-toolkit

Deterministic resume scoring, ATS keyword matching, and guided resume improvement. Works as an MCP server, a scoring library, and an AI skill for Claude Code, Cursor, and Windsurf.

**Same input always produces the same score.** The AI handles parsing and explanation — the scoring is pure math.

## Quick Start — Skill (no account needed)

### All platforms (Claude Code, Cursor, Windsurf, OpenCode, Codex)

```bash
npx skills add getkrafter/resume-toolkit
```

Then use `/score` in any conversation to start.

## What You Can Do

### Score your resume for general quality

Just run `/score` and paste your resume when asked. You'll get a breakdown across 5 dimensions — measurable results, action verbs, bullet quality, section coverage — with specific before/after suggestions for your weakest areas.

```
/score
> [paste your resume]
> [skip the JD prompt]
```

### Score against a specific job description

Provide a JD to unlock ATS keyword matching. You'll see which keywords you're hitting, which are missing, and exactly which bullets to tweak to close the gaps — with confidence notes so you never add something you didn't actually do.

```
/score
> [paste your resume]
> [paste the job description]
```

### Score from a file

Point to a file on disk instead of pasting:

```
/score
> my resume is at ~/Documents/resume.pdf
```

### Score a Krafter resume

If you have the MCP server configured with a Krafter API key, pull your resume directly:

```
/score
> score my Krafter resume
```

### Walk through every bullet with a guided interview

After seeing your scores, say "yes" when asked if you'd like to improve every bullet. The skill walks you through each one, asking for your real numbers — team sizes, user counts, performance gains — one question at a time. You pick from suggested ranges or type your own answer. It then crafts the improved bullet using your actual experience.

This is the core value: you don't need to be a resume writer. Just answer the questions honestly and the skill frames your experience in the strongest truthful way.

## Quick Start — MCP Server

### Without API key (scoring tools only)

```json
{
  "mcpServers": {
    "krafter": {
      "command": "npx",
      "args": ["@getkrafter/resume-toolkit"]
    }
  }
}
```

### With API key (scoring + Krafter CRUD)

```json
{
  "mcpServers": {
    "krafter": {
      "command": "npx",
      "args": ["@getkrafter/resume-toolkit"],
      "env": {
        "KRAFTER_API_KEY": "sk-your-key-here"
      }
    }
  }
}
```

Generate an API key at [krafter.vercel.app](https://krafter.vercel.app) → Settings → AI Integrations.

## Library Usage

```bash
npm install @getkrafter/resume-toolkit
```

```typescript
import { scoreResume, scoreATS, toResumeData } from '@getkrafter/resume-toolkit';

// Score a resume
const result = scoreResume(
  { rawText: '...', bullets: ['...'], sections: ['experience', 'skills'] },
  'Job description text...' // optional
);

console.log(result.total);     // 0-100
console.log(result.mode);      // 'with-jd' or 'without-jd'
console.log(result.breakdown); // per-dimension scores
console.log(result.flags);     // diagnostic messages

// ATS keyword match only
const ats = scoreATS(resumeText, jdText);
console.log(ats?.matched);  // keywords found
console.log(ats?.missing);  // keywords missing

// Convert Krafter resume object to scoreable format
const resumeData = toResumeData(krafterResumeObject);
```

## MCP Tools

### Public (no auth)

| Tool | Description |
|---|---|
| `score_resume` | Full quality score (0-100) across 5 dimensions with breakdown and flags |
| `score_ats` | ATS keyword match with bigram/unigram analysis |

### Krafter (API key required)

| Tool | Description |
|---|---|
| `score_krafter_resume` | Fetch resume from Krafter → score in one call |
| `get_resume` | Fetch a resume by ID |
| `list_resumes` | List all your resumes |
| `create_resume` | Create a new resume |
| `update_resume` | Update an existing resume |
| `delete_resume` | Delete a resume |
| `duplicate_resume` | Clone a resume |
| `update_settings` | Update visual settings |
| `update_section` | Update a specific section |
| `list_templates` | List available templates |
| `get_resume_schema` | Get the resume data schema |

## Scoring Dimensions

| Dimension | Weight (with JD) | What it measures |
|---|---|---|
| Quantification | 25% | Fraction of bullets with numbers/metrics |
| Verb Strength | 20% | Quality of action verbs (tier1 > tier2 > tier3) |
| ATS Match | 30% | Keyword overlap with job description |
| Bullet Structure | 15% | Verb + number + detail pattern |
| Section Completeness | 10% | Presence of expected resume sections |

When no JD is provided, the 30% ATS weight redistributes proportionally across the other dimensions.

## License

MIT
