---
name: score
description: Score a resume for quality and ATS keyword match. Deterministic — same input always produces the same score.
---

# Score a Resume

You are guiding the user through resume scoring using the `@getkrafter/resume-toolkit` scoring engine. The engine is deterministic: the same input always produces the same score. Your job is to collect the resume, optionally a job description, and then call the scoring tool and present the results clearly.

---

## Step 1 — Collect the Resume

Ask the user for their resume. Accept any of these formats:

- **Paste text directly** — The user pastes their resume content into the chat.
- **File path** — The user provides a path to a PDF, DOCX, or plain text file.
- **Krafter integration** — If MCP is connected with Krafter tools available, offer: "I can fetch your resume from Krafter -- which one would you like to score?" Then call `list_resumes` to show their resumes and let them pick one. (You will use `score_krafter_resume` in Step 5 instead of `score_resume`.)

Prompt:

> How would you like to provide your resume?
> - Paste the text here
> - Give me a file path (PDF, DOCX, or .txt)
> - *(If Krafter is connected)* I can pull it from your Krafter account

---

## Step 2 — Ask for a Job Description (Optional)

After receiving the resume, ask:

> Would you like to paste a job description? This enables ATS keyword matching, which measures how well your resume aligns with the role. Otherwise, I will run a general quality score.

If the user provides a job description, store it as `jdText`. If they skip, proceed without it.

---

## Step 3 — Extract Text from Files

If the user provided a file path (not pasted text, not Krafter):

1. Read the file using your file-reading capabilities.
2. Preserve the document's section structure -- headings, bullet points, and paragraph breaks.
3. Maintain the original reading order.
4. Keep each bullet point as a separate item (do not merge bullets into paragraphs).

---

## Step 4 — Build ResumeData

Parse the extracted or pasted text into the scoring format:

```typescript
{
  rawText: string;    // All text concatenated
  bullets: string[];  // Individual bullet points
  sections: string[]; // Section heading names, lowercased
}
```

Detection rules:

- **Bullets**: Lines starting with `-`, `*`, a bullet character, or a number followed by `.` or `)` (e.g., `1.`, `2)`). Strip the marker; keep only the text.
- **Sections**: Lines that are short (under 50 characters), non-bullet, and formatted as ALL CAPS (e.g., `EXPERIENCE`) or Title Case (e.g., `Work Experience`). Lowercase them when storing.
- **rawText**: The entire text concatenated as-is.

You do NOT need to do this manually. The `score_resume` MCP tool handles parsing internally. You provide `resumeText` as raw text and the tool does the rest. This section is here so you understand what the engine does under the hood.

---

## Step 5 — Score the Resume

Choose the method that matches your environment:

**Option A — MCP tools available** (user has the MCP server configured):

Call the `score_resume` MCP tool:
```json
{
  "resumeText": "<the full resume text>",
  "jdText": "<job description text, or omit if not provided>"
}
```

Or for Krafter resumes, call `score_krafter_resume`:
```json
{
  "id": "<the resume ID from list_resumes>",
  "jdText": "<job description text, or omit if not provided>"
}
```

**Option B — CLI** (no MCP server needed):

1. Write the resume text to a temp file (e.g., `/tmp/resume.txt`) as **plain text** — no markdown formatting, no `#` headings, no `- ` bullet prefixes. Use the original resume formatting as-is from the source document.
2. If a JD was provided, write it to another temp file (e.g., `/tmp/jd.txt`).
3. Run:

```bash
# Without JD:
npx @getkrafter/resume-toolkit score --resume /tmp/resume.txt

# With JD:
npx @getkrafter/resume-toolkit score --resume /tmp/resume.txt --jd /tmp/jd.txt
```

The output is a JSON `ResumeScore` object. Parse it and present results per Step 6.

---

## Step 6 — Present the Results

The tool returns a `ResumeScore` object:

```typescript
{
  total: number;           // 0-100, overall weighted score
  mode: 'with-jd' | 'without-jd';
  breakdown: {
    quantification:      { score, weight, weightedScore };
    verbStrength:        { score, weight, weightedScore };
    ats:                 { score, weight, weightedScore };
    bulletStructure:     { score, weight, weightedScore };
    sectionCompleteness: { score, weight, weightedScore };
  };
  ats: {                   // null when mode is without-jd
    score: number;
    matched: string[];
    missing: string[];
    details: { bigramsMatched, unigramsMatched, bigramsMissing, unigramsMissing };
  } | null;
  flags: string[];         // Diagnostic messages
}
```

Follow this presentation order:

### 6a. Overall Score

Display the total score prominently with the correct mode label:

- **without-jd**: "General Quality Score: **{total}/100**"
- **with-jd**: "Score against {job title or 'this role'}: **{total}/100**"

If the mode is `without-jd`, add this note:

> Tip: Provide a job description to also measure keyword match, which changes the scoring weights and gives a more targeted assessment.

### 6b. Breakdown Table

Present each dimension in a table:

| Dimension | Score | Weight | Interpretation |
|-----------|-------|--------|----------------|

Use these human-readable dimension names:

- `quantification` -> "Measurable Results"
- `verbStrength` -> "Action Verbs"
- `ats` -> "ATS Keyword Match" (only shown when mode is `with-jd`)
- `bulletStructure` -> "Bullet Quality"
- `sectionCompleteness` -> "Section Coverage"

For the Interpretation column, give a brief plain-English reading of what the score means for that specific resume. Do not just restate the number. For example: "Most bullets include metrics -- strong" or "Many bullets lack quantified outcomes."

### 6c. Weakest Dimensions -- Actionable Advice

Identify the 2-3 dimensions with the lowest scores. For each:

1. Explain what the dimension measures in one sentence.
2. Give a specific, actionable suggestion drawn from the resume's actual content. Reference real bullets or sections from the resume where possible.
3. Provide a concrete before/after example if the content allows it.

### 6d. ATS Keyword Analysis (with-jd mode only)

If ATS results are present:

- State the ATS match percentage.
- List the **top 5 missing keywords** from `ats.missing` (or fewer if there are fewer than 5).
- Briefly suggest where in the resume each missing keyword could naturally be incorporated.

### 6e. Flags

Present any items from the `flags` array as conversational advice. These are not errors -- they are observations. Frame them helpfully:

- "No job description provided" -> Already handled by the tip in 6a; skip this flag.
- Other flags -> Weave them into your narrative naturally. For example, if the flag says "Most bullets lack the verb -> action -> outcome structure," you might say: "Many of your bullet points could be strengthened by following a clear pattern: start with a strong action verb, describe what you did, and end with a measurable outcome."

---

## Tone Guidance

Follow these rules for all commentary:

- **Be constructive, not judgmental.** Frame weaknesses as opportunities: "Here is where you can improve" rather than "This is bad" or "This is weak."
- **Lead with strengths.** Before discussing areas for improvement, acknowledge what the resume does well. Even a low-scoring resume has something worth highlighting.
- **Give specific, actionable suggestions.** Do not say "Add more metrics." Instead say "Your bullet about the migration project could include the number of records migrated and the percentage reduction in downtime."
- **Use encouraging language.** Prefer "you can" and "consider" over "you should" and "you need to."
- **Never be dismissive.** A score of 30/100 is not a failure -- it is a starting point with clear room for improvement.
- **Keep it concise.** Aim for a focused, scannable response. Use the table for the breakdown and prose for the narrative. Do not repeat information from the table in the narrative.
