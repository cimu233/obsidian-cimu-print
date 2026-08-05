import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/types';
import { generatePrintStyles } from '../src/printing/printStyles';

function createApp(snippets: unknown) {
  return {
    customCss: { snippets },
    vault: {
      configDir: '.obsidian',
      adapter: {
        read: vi.fn(async (path: string) => path.endsWith('/snippets/print.css')
          ? '.cimu-print-document { color: rebeccapurple; }'
          : '')
      }
    }
  };
}

describe('generatePrintStyles', () => {
  it('accepts the array-shaped snippet list used by Obsidian 1.13', async () => {
    const app = createApp(['print']);

    const css = await generatePrintStyles(
      app as never,
      { id: 'cimu-print', dir: '.obsidian/plugins/cimu-print' } as never,
      { ...DEFAULT_SETTINGS }
    );

    expect(css).toContain('color: rebeccapurple');
  });

  it('continues to accept Set-shaped snippet collections', async () => {
    const app = createApp(new Set(['print']));

    const css = await generatePrintStyles(
      app as never,
      { id: 'cimu-print', dir: '.obsidian/plugins/cimu-print' } as never,
      { ...DEFAULT_SETTINGS }
    );

    expect(css).toContain('color: rebeccapurple');
  });

  it('leaves content unscaled so PDF output owns the scale factor', async () => {
    const app = createApp([]);

    const css = await generatePrintStyles(
      app as never,
      { id: 'cimu-print', dir: '.obsidian/plugins/cimu-print' } as never,
      { ...DEFAULT_SETTINGS, printScalePercent: 75 }
    );

    expect(css).toContain('@page { size: A4');
    expect(css).not.toContain('zoom:');
  });
});
