import { freezeCanvasPixels } from '../content/canvasFreeze';
import { serializePrintFontFamily } from './printFonts';

const PRINT_BODY_CLASSES = ['cimu-print-host', 'theme-light', 'print'];
const RELEVANT_SELECTOR = /(?:callout|mermaid|math|mjx|code|pre|table|blockquote|token|language-|markdown-rendered)/i;

export function getTargetedRuntimePrintCss(root?: ParentNode, preferredFont = ''): string {
  const rules: string[] = [];
  const seen = new Set<string>();
  for (const sheet of Array.from(document.styleSheets)) {
    collectSheet(sheet as CSSStyleSheet, root, rules, seen);
  }
  return [getResolvedRuntimeTypographyCss(root, preferredFont), ...rules].join('\n');
}

export function getResolvedRuntimeTypographyCss(root?: ParentNode, preferredFont = ''): string {
  const content = root instanceof HTMLElement ? root : document.body;
  const computed = getComputedStyle(content);
  const selected = serializePrintFontFamily(preferredFont);
  const bodyFont = selected || computed.fontFamily || 'sans-serif';
  const code = content.querySelector<HTMLElement>('code, pre');
  const codeFont = code ? getComputedStyle(code).fontFamily : 'monospace';
  return `
:root {
  --cimu-print-text-font: ${bodyFont};
  --cimu-print-code-font: ${codeFont || 'monospace'};
}
.cimu-print-document { font-family: var(--cimu-print-text-font) !important; }
.cimu-print-document :where(h1,h2,h3,h4,h5,h6,p,li,dt,dd,blockquote,table,th,td,a,strong,em) {
  font-family: var(--cimu-print-text-font) !important;
}
.cimu-print-document :where(code,pre) { font-family: var(--cimu-print-code-font) !important; }
`;
}

export function createDebugPrintHtml(
  content: HTMLElement,
  css: string,
  title = 'Cimu Print',
  bodyClasses: string[] = [],
  includeThemeClasses = true
): string {
  const html = document.createElement('html');
  html.className = includeThemeClasses ? 'theme-light' : '';
  const head = document.createElement('head');
  const charset = document.createElement('meta');
  charset.setAttribute('charset', 'utf-8');
  const titleNode = document.createElement('title');
  titleNode.textContent = title;
  const style = document.createElement('style');
  style.textContent = css;
  head.append(charset, titleNode, style);

  const body = document.createElement('body');
  if (includeThemeClasses) {
    body.classList.add(...PRINT_BODY_CLASSES);
  }
  body.classList.add(...bodyClasses);
  const clone = content.cloneNode(true) as HTMLElement;
  freezeCanvasPixels(content, clone);
  clone.classList.add('print');
  body.appendChild(clone);
  html.append(head, body);
  return `<!doctype html>${html.outerHTML}`;
}

function collectSheet(
  sheet: CSSStyleSheet,
  root: ParentNode | undefined,
  output: string[],
  seen: Set<string>
): void {
  let rules: CSSRuleList;
  try {
    rules = sheet.cssRules;
  } catch {
    return;
  }
  collectRules(rules, root, output, seen);
}

function collectRules(
  rules: CSSRuleList,
  root: ParentNode | undefined,
  output: string[],
  seen: Set<string>
): void {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      const selectors = splitSelectors(rule.selectorText)
        .filter((selector) => RELEVANT_SELECTOR.test(selector))
        .filter((selector) => selectorMatches(selector, root));
      if (selectors.length > 0) {
        addRule(`${selectors.join(',')} { ${rule.style.cssText} }`, output, seen);
      }
      continue;
    }
    if (rule instanceof CSSMediaRule) {
      const nested: string[] = [];
      collectRules(rule.cssRules, root, nested, seen);
      if (nested.length > 0) {
        output.push(`@media ${rule.conditionText} { ${nested.join('\n')} }`);
      }
    }
  }
}

function selectorMatches(selector: string, root?: ParentNode): boolean {
  if (!root || !('querySelector' in root)) {
    return true;
  }
  const simplified = selector
    .replace(/:hover|:focus|:active|:visited|:focus-visible/g, '')
    .replace(/::[\w-]+/g, '');
  try {
    return root instanceof Element && root.matches(simplified)
      || Boolean(root.querySelector(simplified));
  } catch {
    return false;
  }
}

function splitSelectors(selectorText: string): string[] {
  return selectorText.split(',').map((selector) => selector.trim()).filter(Boolean);
}

function addRule(rule: string, output: string[], seen: Set<string>): void {
  if (!seen.has(rule)) {
    seen.add(rule);
    output.push(rule);
  }
}
