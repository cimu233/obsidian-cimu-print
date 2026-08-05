import { describe, expect, it } from 'vitest';
import { removeYamlHeader } from '../src/content/markdownSource';

describe('markdown print source', () => {
  it('removes a leading YAML block and keeps document content', () => {
    expect(removeYamlHeader('---\ntitle: Demo\n---\n# Body')).toBe('# Body');
  });

  it('leaves Markdown without YAML unchanged', () => {
    expect(removeYamlHeader('# Body')).toBe('# Body');
  });
});
