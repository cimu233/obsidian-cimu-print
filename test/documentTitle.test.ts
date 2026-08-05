import { describe, expect, it } from 'vitest';
import { extractFirstHeading, resolveDocumentTitle, sanitizePdfFilename } from '../src/printing/documentTitle';

describe('document titles', () => {
  it('skips YAML and fenced code while reading the first heading', () => {
    const markdown = '---\ntitle: Metadata\n---\n```md\n# Hidden\n```\n# Printed title';
    expect(extractFirstHeading(markdown)).toBe('Printed title');
    expect(resolveDocumentTitle(markdown, 'fallback', 'first-heading')).toBe('Printed title');
  });

  it('sanitizes reserved and path-sensitive file names', () => {
    expect(sanitizePdfFilename('CON', 'fallback')).toBe('_CON');
    expect(sanitizePdfFilename('A/B:C', 'fallback')).toBe('A／B：C');
  });
});
