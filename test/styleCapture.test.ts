import { describe, expect, it } from 'vitest';
import {
  createDebugPrintHtml,
  getResolvedRuntimeTypographyCss,
  getTargetedRuntimePrintCss
} from '../src/printing/styleCapture';

describe('Obsidian appearance capture', () => {
  it('captures ordinary theme rules that match rendered Markdown', () => {
    const style = document.createElement('style');
    style.textContent = `
      .markdown-rendered h2 { color: var(--heading-color); margin-block: 1.5em 0.5em; }
      .workspace-leaf.mod-active .view-content { display: none; }
    `;
    const root = document.createElement('article');
    root.className = 'cimu-print-document markdown-rendered';
    root.innerHTML = '<h2>Theme heading</h2>';
    document.documentElement.style.setProperty('--heading-color', 'rgb(26, 86, 219)');
    document.head.appendChild(style);

    try {
      const css = getTargetedRuntimePrintCss(root);
      expect(css).toContain('.markdown-rendered h2');
      expect(css).toContain('--heading-color: rgb(26, 86, 219);');
      expect(css).not.toContain('.workspace-leaf.mod-active .view-content');
    } finally {
      style.remove();
      document.documentElement.style.removeProperty('--heading-color');
    }
  });

  it('keeps custom theme classes and uses their light print variant', () => {
    const previousHtml = document.documentElement.className;
    const previousBody = document.body.className;
    const style = document.createElement('style');
    style.textContent = `
      body.theme-dark.anp-theme .markdown-rendered h1 { color: white; }
      body.theme-light.anp-theme .markdown-rendered h1 { color: navy; }
    `;
    const root = document.createElement('article');
    root.className = 'cimu-print-document markdown-rendered';
    root.innerHTML = '<h1>Heading</h1>';
    document.documentElement.className = 'theme-dark mod-macos anp-theme';
    document.body.className = 'workspace theme-dark anp-theme';
    document.head.appendChild(style);

    try {
      const css = getTargetedRuntimePrintCss(root);
      const html = createDebugPrintHtml(root, css, 'Theme test');
      expect(css).toContain('body.theme-light.anp-theme .markdown-rendered h1');
      expect(css).not.toContain('body.theme-dark.anp-theme .markdown-rendered h1');
      expect(html).toContain('<html class="mod-macos anp-theme theme-light">');
      expect(html).toContain('class="cimu-print-host workspace anp-theme theme-light"');
    } finally {
      style.remove();
      document.documentElement.className = previousHtml;
      document.body.className = previousBody;
    }
  });

  it('captures variables scoped to the print context', () => {
    const previousHtml = document.documentElement.className;
    const style = document.createElement('style');
    style.textContent = `
      .anp-h2-peach .print { --h2-color: rgb(var(--theme-peach)); }
      .markdown-rendered h2 { color: var(--h2-color); }
    `;
    const root = document.createElement('article');
    root.className = 'cimu-print-document markdown-rendered';
    root.innerHTML = '<h2>Colored heading</h2>';
    document.documentElement.className = 'theme-light anp-h2-peach';
    document.documentElement.style.setProperty('--theme-peach', '249, 153, 145');
    document.head.appendChild(style);

    try {
      const css = getTargetedRuntimePrintCss(root);
      expect(css).toContain('.anp-h2-peach .print');
      expect(css).toContain('.markdown-rendered h2');
      expect(css).toContain('--theme-peach: 249, 153, 145;');
    } finally {
      style.remove();
      document.documentElement.style.removeProperty('--theme-peach');
      document.documentElement.className = previousHtml;
    }
  });

  it('keeps matching selectors from a mixed selector list without app-shell selectors', () => {
    const style = document.createElement('style');
    style.textContent = `
      html, body, .markdown-rendered, :is(.callout, .notice[data-kind="a,b"]) {
        color: slateblue;
      }
    `;
    const root = document.createElement('article');
    root.className = 'cimu-print-document markdown-rendered';
    root.innerHTML = '<div class="callout">Callout</div>';
    document.head.appendChild(style);

    try {
      const css = getTargetedRuntimePrintCss(root);
      expect(css).toContain('.markdown-rendered');
      expect(css).toContain(':is(.callout, .notice[data-kind="a,b"])');
      expect(css).not.toMatch(/(^|\n)html,/);
      expect(css).not.toMatch(/(^|\n)body,/);
    } finally {
      style.remove();
    }
  });

  it('resolves nested font variables for the isolated PDF window', () => {
    const previousText = document.documentElement.style.getPropertyValue('--font-text');
    const previousOverride = document.documentElement.style.getPropertyValue('--font-text-override');
    document.documentElement.style.setProperty('--font-text', 'var(--font-text-override)');
    document.documentElement.style.setProperty('--font-text-override', '"LXGW WenKai"');

    try {
      const root = document.createElement('article');
      root.className = 'cimu-print-document markdown-rendered';
      root.innerHTML = '<p>Typography</p>';
      const css = getTargetedRuntimePrintCss(root);
      expect(css).toContain('--font-text: var(--font-text-override);');
      expect(css).toContain('--font-text-override: "LXGW WenKai";');
      expect(css).toContain('font-family: var(--cimu-print-text-font)');
    } finally {
      document.documentElement.style.setProperty('--font-text', previousText);
      document.documentElement.style.setProperty('--font-text-override', previousOverride);
    }
  });

  it('puts an explicitly selected print font before the current Obsidian font', () => {
    const previousFont = document.body.style.fontFamily;
    document.body.style.fontFamily = '"LXGW WenKai", serif';
    try {
      const css = getResolvedRuntimeTypographyCss(document.createElement('article'), 'Songti SC');
      expect(css).toContain('--cimu-print-text-font: "Songti SC", "LXGW WenKai", serif;');
    } finally {
      document.body.style.fontFamily = previousFont;
    }
  });
});
