# @getkrafter/resume-toolkit

Deterministic resume scoring, ATS keyword matching, and AI-powered resume tailoring. Works as an MCP server, a scoring library, and AI skills for Claude Code, Cursor, and Windsurf.

**Same input always produces the same score.** The AI handles parsing and explanation — the scoring is pure math.

## Quick Start — Skills (no account needed)

### All platforms (Claude Code, Cursor, Windsurf, OpenCode, Codex)

```bash
npx skills add getkrafter/resume-toolkit
```

Then use `/score` or `/tailor` in any conversation.

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

Generate an API key at [krafter.app](https://krafter.app) → Settings → AI Integrations.

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

## Skills

| Skill | Description |
|---|---|
| `/score` | Guided resume scoring — paste or provide a resume, optionally add a JD, get a detailed score breakdown with actionable advice |
| `/tailor` | Gap analysis against a JD — identifies missing keywords, suggests truth-preserving rewrites with before/after format |

## Scoring Dimensions

| Dimension | Weight (with JD) | What it measures |
|---|---|---|
| Quantification | 25% | Fraction of bullets with numbers/metrics |
| Verb Strength | 20% | Quality of action verbs (tier1 > tier2 > tier3) |
| ATS Match | 30% | Keyword overlap with job description |
| Bullet Structure | 15% | Verb + number + detail pattern |
| Section Completeness | 10% | Presence of expected resume sections |

When no JD is provided, the 30% ATS weight redistributes proportionally across the other dimensions.

## Contributing

```bash
git clone https://github.com/getkrafter/resume-toolkit.git
cd resume-toolkit
npm install
npm test        # run tests
npm run build   # compile TypeScript
```

Commits follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat: ...` → minor version bump
- `fix: ...` → patch version bump
- `feat!: ...` → major version bump

## License

MIT
