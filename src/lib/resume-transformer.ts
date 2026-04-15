import type { ResumeData } from './types.js';

/**
 * Strips all HTML tags from a string, collapses whitespace, and trims.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts the text content of each `<li>` element from an HTML string.
 * Inner HTML tags are stripped from the extracted content.
 */
function extractBullets(html: string): string[] {
  const bullets: string[] = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let match: RegExpExecArray | null;

  while ((match = liRegex.exec(html)) !== null) {
    const cleaned = stripHtml(match[1]);
    if (cleaned) {
      bullets.push(cleaned);
    }
  }

  return bullets;
}

/**
 * Safely reads a string property from an unknown object.
 * Returns an empty string if the property is missing or not a string.
 */
function getString(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  return typeof value === 'string' ? value : '';
}

/**
 * Converts a structured Krafter resume object into the flat `ResumeData` format
 * used for scoring, ATS matching, and other analysis.
 *
 * The function is fully defensive -- it never throws on malformed input.
 * Missing or unexpected fields are silently skipped.
 *
 * @param resume - A Krafter resume object (the shape returned by `getResume()`)
 * @returns A flattened `ResumeData` with `rawText`, `bullets`, and `sections`
 */
export function toResumeData(resume: Record<string, unknown>): ResumeData {
  const textParts: string[] = [];
  const allBullets: string[] = [];
  const sectionNames: string[] = [];

  // --- Personal fields ---
  const personalFields = ['firstName', 'lastName', 'jobTitle', 'professionalSummary'];
  for (const field of personalFields) {
    const value = getString(resume, field);
    if (value) {
      textParts.push(stripHtml(value));
    }
  }

  // --- Sections ---
  const sections = resume['sections'];
  if (Array.isArray(sections)) {
    for (const section of sections) {
      if (section == null || typeof section !== 'object') continue;

      const sec = section as Record<string, unknown>;

      // Section name
      const sectionName = getString(sec, 'name');
      if (sectionName) {
        sectionNames.push(sectionName.toLowerCase());
        textParts.push(sectionName);
      }

      // Items within the section
      const items = sec['items'];
      if (!Array.isArray(items)) continue;

      for (const item of items) {
        if (item == null || typeof item !== 'object') continue;

        const it = item as Record<string, unknown>;

        // Structured fields: title, subtitle, dates
        const title = getString(it, 'title');
        const subtitle = getString(it, 'subtitle');
        const startDate = getString(it, 'startDate');
        const endDate = getString(it, 'endDate');

        if (title) textParts.push(title);
        if (subtitle) textParts.push(subtitle);
        if (startDate) textParts.push(startDate);
        if (endDate) textParts.push(endDate);

        // Skill-style items (name only)
        const itemName = getString(it, 'name');
        if (itemName) textParts.push(itemName);

        // Description (HTML with potential bullet points)
        const description = getString(it, 'description');
        if (description) {
          // Extract bullets from <li> elements
          const bullets = extractBullets(description);
          allBullets.push(...bullets);

          // Add stripped description to rawText
          textParts.push(stripHtml(description));
        }
      }
    }
  }

  const rawText = textParts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

  return {
    rawText,
    bullets: allBullets,
    sections: sectionNames,
  };
}
