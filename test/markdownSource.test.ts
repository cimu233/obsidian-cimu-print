import { describe, expect, it } from 'vitest';
import { removeYamlHeader, renderMarkdownSource } from '../src/content/markdownSource';

describe('Markdown print source', () => {
  it('removes a leading YAML block and keeps document content', () => {
    expect(removeYamlHeader('---\ntitle: Demo\n---\n# Body')).toBe('# Body');
  });

  it('leaves Markdown without YAML unchanged', () => {
    expect(removeYamlHeader('# Body')).toBe('# Body');
  });

  it('unloads its rendering component after producing static print content', async () => {
    const result = await renderMarkdownSource('Hello', false, {} as never);
    const target = globalThis as typeof globalThis & {
      __componentLoads?: number;
      __componentUnloads?: number;
    };

    expect(result?.textContent).toBe('Hello');
    expect(target.__componentLoads).toBe(1);
    expect(target.__componentUnloads).toBe(1);
  });

  it('parses Mermaid SVG without assigning markup through innerHTML', async () => {
    const result = await renderMarkdownSource('```mermaid\ngraph TD; A-->B\n```', false, {} as never);

    expect(result?.querySelector('.cimu-print-diagram > svg')).not.toBeNull();
    expect(result?.querySelector('pre code.language-mermaid')).toBeNull();
  });
});
