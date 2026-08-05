import { freezeCanvasPixels } from '../content/canvasFreeze';
import { serializePrintFontFamily } from './printFonts';

const ALWAYS_CAPTURE_PATTERNS = [
  /mjx-/i,
  /mathjax/i,
  /mermaid/i,
  /(^|[^a-z-])pre([^a-z-]|$)/i,
  /(^|[^a-z-])code([^a-z-]|$)/i,
  /(^|[^a-z-])callout([^a-z-]|$)/i,
  /data-callout/i,
  /callout-title/i,
  /callout-content/i,
  /callout-icon/i,
  /callout-fold/i,
  /\.token\b/i,
  /language-/i
];
const VARIABLE_REFERENCE = /var\((--[\w-]+)/g;
const MATCH_ROOT_ATTRIBUTE = 'data-cimu-print-match-root';
const THEME_CLASS_PATTERN = /\btheme-(?:dark|light)\b/g;
const LIGHT_THEME_CLASS = 'theme-light';
const PRINT_CONTEXT_CLASS = 'print';
const PRINT_BODY_CLASS = 'cimu-print-host';
const CORE_VARIABLES = [
  '--font-text',
  '--font-text-override',
  '--font-text-theme',
  '--font-interface',
  '--font-monospace',
  '--anp-editor-font-rv'
];

interface SelectorMatchContext {
  structuralMarkers: Set<string>;
  document: Document | null;
}

export function getTargetedRuntimePrintCss(
  root?: ParentNode,
  preferredFont = ''
): string {
  const rules: string[] = [];
  const seen = new Set<string>();
  const variables = new Set<string>(CORE_VARIABLES);
  const matchContext = createSelectorMatchContext(root);

  for (const sheet of Array.from(document.styleSheets)) {
    collectStyleSheet(sheet, root, matchContext, rules, seen, variables);
  }

  return [
    buildVariableCss(variables),
    getResolvedRuntimeTypographyCss(root, preferredFont),
    ...rules
  ].filter((part) => part.trim()).join('\n');
}

export function getResolvedRuntimeTypographyCss(
  root?: ParentNode,
  preferredFont = ''
): string {
  let textFont = '';
  let codeFont = '';

  withLightThemeClasses(() => {
    const connectedRoot = root instanceof HTMLElement && root.isConnected ? root : null;
    textFont = firstComputedFontFamily([
      connectedRoot,
      document.querySelector<HTMLElement>('.workspace-leaf.mod-active .markdown-preview-view'),
      document.querySelector<HTMLElement>('.workspace-leaf.mod-active .markdown-source-view'),
      document.querySelector<HTMLElement>('.workspace-leaf.mod-active .markdown-rendered'),
      document.body,
      document.documentElement
    ]);
    codeFont = firstComputedFontFamily([
      connectedRoot?.querySelector<HTMLElement>('code, pre') ?? null,
      document.querySelector<HTMLElement>('.workspace-leaf.mod-active code'),
      document.querySelector<HTMLElement>('.workspace-leaf.mod-active pre')
    ]);
  });

  const inheritedTextFont = textFont || 'var(--font-text, var(--font-interface, sans-serif))';
  const selectedFont = serializePrintFontFamily(preferredFont);
  const resolvedTextFont = selectedFont
    ? `${selectedFont}, ${inheritedTextFont}`
    : inheritedTextFont;
  const resolvedCodeFont = codeFont || 'var(--font-monospace, monospace)';

  return `
:root {
  --cimu-print-text-font: ${resolvedTextFont};
  --cimu-print-code-font: ${resolvedCodeFont};
}
body.${PRINT_BODY_CLASS},
body.${PRINT_BODY_CLASS} .cimu-print-document,
body.${PRINT_BODY_CLASS} .cimu-print-view {
  font-family: var(--cimu-print-text-font) !important;
}
body.${PRINT_BODY_CLASS} .cimu-print-document :where(h1,h2,h3,h4,h5,h6,p,li,dt,dd,blockquote,table,th,td,a,strong,em),
body.${PRINT_BODY_CLASS} .cimu-print-view :where(h1,h2,h3,h4,h5,h6,p,li,dt,dd,blockquote,table,th,td,a,strong,em) {
  font-family: var(--cimu-print-text-font) !important;
}
body.${PRINT_BODY_CLASS} :where(code,pre) {
  font-family: var(--cimu-print-code-font) !important;
}
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
  html.className = includeThemeClasses ? toLightThemeClassName(document.documentElement.className) : '';

  const head = document.createElement('head');
  const charset = document.createElement('meta');
  charset.setAttribute('charset', 'utf-8');
  const titleNode = document.createElement('title');
  titleNode.textContent = title;
  const style = document.createElement('style');
  style.textContent = css;
  head.append(charset, titleNode, style);

  const body = document.createElement('body');
  applyPrintBodyClasses(body, includeThemeClasses);
  body.classList.add(...bodyClasses);
  const clone = content.cloneNode(true) as HTMLElement;
  freezeCanvasPixels(content, clone);
  clone.classList.add(PRINT_CONTEXT_CLASS);
  body.appendChild(clone);

  html.append(head, body);
  return `<!doctype html>${html.outerHTML}`;
}

function collectStyleSheet(
  sheet: StyleSheet,
  root: ParentNode | undefined,
  matchContext: SelectorMatchContext,
  output: string[],
  seen: Set<string>,
  variables: Set<string>
): void {
  let rules: CSSRuleList;
  try {
    rules = (sheet as CSSStyleSheet).cssRules;
  } catch {
    return;
  }
  collectRules(rules, root, matchContext, output, seen, variables);
}

function collectRules(
  rules: CSSRuleList,
  root: ParentNode | undefined,
  matchContext: SelectorMatchContext,
  output: string[],
  seen: Set<string>,
  variables: Set<string>
): void {
  for (const rule of Array.from(rules)) {
    if (rule.type === CSSRule.STYLE_RULE) {
      const styleRule = rule as CSSStyleRule;
      const selectors = splitSelectorList(styleRule.selectorText)
        .filter((selector) => matchesPrintedContent(selector, root, matchContext));
      if (selectors.length > 0) {
        const text = `${selectors.join(',\n')} { ${styleRule.style.cssText} }`;
        addRule(text, output, seen);
        collectVariables(text, variables);
      }
      continue;
    }

    if (rule.type === CSSRule.IMPORT_RULE) {
      const importRule = rule as CSSImportRule;
      if (importRule.styleSheet) {
        collectStyleSheet(importRule.styleSheet, root, matchContext, output, seen, variables);
      }
      continue;
    }

    const groupingRule = rule as CSSRule & { cssRules?: CSSRuleList };
    if (!groupingRule.cssRules) {
      continue;
    }

    const nested: string[] = [];
    collectRules(groupingRule.cssRules, root, matchContext, nested, seen, variables);
    if (nested.length === 0) {
      continue;
    }

    const brace = rule.cssText.indexOf('{');
    const prelude = brace >= 0 ? rule.cssText.slice(0, brace).trim() : '';
    if (prelude) {
      addRule(`${prelude} {\n${nested.join('\n')}\n}`, output, seen);
    }
  }
}

function splitSelectorList(selectorText: string): string[] {
  const selectors: string[] = [];
  let current = '';
  let quote = '';
  let depth = 0;
  let escaped = false;

  for (const character of selectorText) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === '\\') {
      current += character;
      escaped = true;
      continue;
    }
    if (quote) {
      current += character;
      if (character === quote) {
        quote = '';
      }
      continue;
    }
    if (character === '"' || character === "'") {
      current += character;
      quote = character;
      continue;
    }
    if (character === '(' || character === '[') {
      depth += 1;
      current += character;
      continue;
    }
    if (character === ')' || character === ']') {
      depth = Math.max(0, depth - 1);
      current += character;
      continue;
    }
    if (character === ',' && depth === 0) {
      if (current.trim()) {
        selectors.push(current.trim());
      }
      current = '';
      continue;
    }
    current += character;
  }

  if (current.trim()) {
    selectors.push(current.trim());
  }
  return selectors;
}

function matchesPrintedContent(
  selector: string,
  root: ParentNode | undefined,
  matchContext: SelectorMatchContext
): boolean {
  return ALWAYS_CAPTURE_PATTERNS.some((pattern) => pattern.test(selector))
    || selectorMatchesContent(selector, root, matchContext);
}

function selectorMatchesContent(
  selector: string,
  root: ParentNode | undefined,
  matchContext: SelectorMatchContext
): boolean {
  if (!root) {
    return false;
  }
  if (queryAgainstRoot(selector, root)) {
    return true;
  }

  const normalized = selector
    .replace(/:hover|:focus|:active|:visited|:focus-visible/g, '')
    .replace(/::[\w-]+/g, '');
  if (normalized !== selector && queryAgainstRoot(normalized, root)) {
    return true;
  }
  return queryAgainstMatchDocument(normalized, matchContext);
}

function queryAgainstRoot(selector: string, root: ParentNode): boolean {
  try {
    const element = root as Element;
    if (typeof element.matches === 'function' && element.matches(selector)) {
      return true;
    }
    return Boolean(root.querySelector(selector));
  } catch {
    return false;
  }
}

function createSelectorMatchContext(root?: ParentNode): SelectorMatchContext {
  const element = root as Element | undefined;
  if (!element || typeof element.cloneNode !== 'function') {
    return { structuralMarkers: new Set(), document: null };
  }

  const matchDocument = document.implementation.createHTMLDocument('Cimu Print Selector Match');
  matchDocument.documentElement.className = toLightThemeClassName(document.documentElement.className);
  matchDocument.body.className = toLightThemeClassName(document.body.className);
  const clone = element.cloneNode(true) as HTMLElement;
  clone.classList.add(PRINT_CONTEXT_CLASS);
  clone.setAttribute(MATCH_ROOT_ATTRIBUTE, '');
  matchDocument.body.appendChild(clone);

  return {
    structuralMarkers: collectStructuralMarkers(clone),
    document: matchDocument
  };
}

function queryAgainstMatchDocument(
  selector: string,
  matchContext: SelectorMatchContext
): boolean {
  if (!matchContext.document) {
    return false;
  }
  if (!selectorContainsStructuralMarker(selector, matchContext.structuralMarkers)
    && !selector.includes(`.${PRINT_CONTEXT_CLASS}`)) {
    return false;
  }

  try {
    const match = matchContext.document.querySelector(selector);
    if (!match) {
      return false;
    }
    if (match.closest(`[${MATCH_ROOT_ATTRIBUTE}]`)) {
      return true;
    }
    return selector.includes(`.${PRINT_CONTEXT_CLASS}`)
      && (match === matchContext.document.body || match === matchContext.document.documentElement);
  } catch {
    return false;
  }
}

function collectStructuralMarkers(root: Element): Set<string> {
  const markers = new Set<string>();
  for (const element of [root, ...Array.from(root.querySelectorAll('*'))]) {
    element.classList.forEach((className) => markers.add(`.${className}`));
    if (element.id) {
      markers.add(`#${element.id}`);
    }
  }
  return markers;
}

function selectorContainsStructuralMarker(selector: string, markers: Set<string>): boolean {
  for (const marker of markers) {
    if (selector.includes(marker)) {
      return true;
    }
  }
  return false;
}

function collectVariables(css: string, variables: Set<string>): void {
  let match = VARIABLE_REFERENCE.exec(css);
  while (match) {
    variables.add(match[1]);
    match = VARIABLE_REFERENCE.exec(css);
  }
  VARIABLE_REFERENCE.lastIndex = 0;
}

function buildVariableCss(variables: Set<string>): string {
  const resolved = new Map<string, string>();

  withLightThemeClasses(() => {
    const sources = [
      document.querySelector<HTMLElement>('.app-container'),
      document.querySelector<HTMLElement>('.workspace-leaf.mod-active .markdown-preview-view'),
      document.querySelector<HTMLElement>('.workspace-leaf.mod-active .markdown-source-view'),
      document.body,
      document.documentElement
    ].filter((element): element is HTMLElement => Boolean(element));
    const computedSources = sources.map((element) => getComputedStyle(element));
    const pending = [...variables];
    const visited = new Set<string>();

    while (pending.length > 0) {
      const name = pending.shift()!;
      if (visited.has(name)) {
        continue;
      }
      visited.add(name);
      for (const styles of computedSources) {
        const value = styles.getPropertyValue(name).trim();
        if (!value) {
          continue;
        }
        resolved.set(name, value);
        const previousSize = variables.size;
        collectVariables(value, variables);
        if (variables.size > previousSize) {
          for (const dependency of variables) {
            if (!visited.has(dependency)) {
              pending.push(dependency);
            }
          }
        }
        break;
      }
    }
  });

  if (resolved.size === 0) {
    return '';
  }
  const declarations = Array.from(resolved.entries())
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');
  return `:root {\n${declarations}\n}`;
}

function firstComputedFontFamily(elements: Array<HTMLElement | null>): string {
  for (const element of elements) {
    if (!element) {
      continue;
    }
    const family = getComputedStyle(element).fontFamily.trim();
    if (family && family.toLowerCase() !== 'depends on user agent') {
      return family;
    }
  }
  return '';
}

function withLightThemeClasses<T>(callback: () => T): T {
  const htmlClasses = document.documentElement.className;
  const bodyClasses = document.body.className;
  document.documentElement.className = toLightThemeClassName(htmlClasses);
  document.body.className = toLightThemeClassName(bodyClasses);
  try {
    return callback();
  } finally {
    document.documentElement.className = htmlClasses;
    document.body.className = bodyClasses;
  }
}

function addRule(css: string, output: string[], seen: Set<string>): void {
  if (!seen.has(css)) {
    seen.add(css);
    output.push(css);
  }
}

function applyPrintBodyClasses(body: HTMLElement, includeThemeClasses: boolean): void {
  const classNames = [
    PRINT_BODY_CLASS,
    includeThemeClasses ? toLightThemeClassName(document.body.className) : ''
  ].join(' ').split(/\s+/).filter(Boolean);
  body.className = [...new Set(classNames)].join(' ');
}

function toLightThemeClassName(className: string): string {
  const withoutTheme = className.replace(THEME_CLASS_PATTERN, '').trim();
  return [...new Set(`${withoutTheme} ${LIGHT_THEME_CLASS}`.split(/\s+/).filter(Boolean))].join(' ');
}
