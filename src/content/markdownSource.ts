import {
  App,
  Component,
  getFrontMatterInfo,
  loadMermaid,
  MarkdownRenderer,
  Notice,
  TFile
} from 'obsidian';
import { t } from '../i18n';
import { buildPrintableProperties } from './propertiesBlock';

let diagramSequence = 0;

interface MermaidRenderResult {
  svg: string;
  bindFunctions?: (container: Element) => void;
}

interface MermaidApi {
  render: (id: string, source: string) => MermaidRenderResult | string | Promise<MermaidRenderResult | string>;
}

export async function renderMarkdownSource(
  input: TFile | string,
  title: string | false,
  app: App,
  includeProperties = false,
  sourceFile?: TFile
): Promise<HTMLElement | null> {
  const root = createEl('article');
  root.className = 'cimu-print-document markdown-rendered';
  const renderComponent = new Component();
  renderComponent.load();

  try {
    if (includeProperties && input instanceof TFile) {
      const properties = buildPrintableProperties(app, input);
      if (properties) {
        root.appendChild(properties);
      }
    }

    if (title) {
      const heading = createEl('h1');
      heading.textContent = title;
      root.appendChild(heading);
    }

    const markdown = input instanceof TFile
      ? removeYamlHeader(await app.vault.cachedRead(input))
      : input;
    const sourcePath = input instanceof TFile ? input.path : sourceFile?.path ?? '';

    await MarkdownRenderer.render(app, markdown, root, sourcePath, renderComponent);
    root.querySelectorAll('.metadata-container').forEach((node) => node.remove());
    await replaceMermaidCode(root);
    return root;
  } catch (error) {
    console.error('Cimu Print markdown rendering failed:', error);
    new Notice(t('notice.previewGenerationFailed'));
    return null;
  } finally {
    renderComponent.unload();
  }
}

export function removeYamlHeader(markdown: string): string {
  const normalized = markdown.replace(/^\uFEFF/, '');
  const fallback = normalized.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
  if (fallback) {
    return normalized.slice(fallback[0].length);
  }
  const info = getFrontMatterInfo(normalized);
  return info.exists ? normalized.slice(info.contentStart) : normalized;
}

async function replaceMermaidCode(root: HTMLElement): Promise<void> {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('pre code.language-mermaid'));
  if (blocks.length === 0) {
    return;
  }

  try {
    const loadedMermaid: unknown = await loadMermaid();
    if (!isMermaidApi(loadedMermaid)) {
      return;
    }
    const mermaid = loadedMermaid;
    for (const code of blocks) {
      const source = code.textContent?.trim();
      const pre = code.closest('pre');
      if (!source || !pre) {
        continue;
      }
      const rendered = await mermaid.render(`cimu-print-diagram-${diagramSequence++}`, source);
      const svg = typeof rendered === 'string' ? rendered : rendered?.svg;
      if (!svg) {
        continue;
      }
      const parsedSvg = new DOMParser().parseFromString(svg, 'image/svg+xml');
      const svgElement = parsedSvg.documentElement;
      if (svgElement.nodeName.toLowerCase() !== 'svg') {
        continue;
      }
      const container = createDiv();
      container.className = 'mermaid cimu-print-diagram';
      container.appendChild(document.importNode(svgElement, true));
      if (typeof rendered !== 'string' && typeof rendered?.bindFunctions === 'function') {
        rendered.bindFunctions(container);
      }
      pre.replaceWith(container);
    }
  } catch (error) {
    console.error('Cimu Print Mermaid rendering failed:', error);
  }
}

function isMermaidApi(value: unknown): value is MermaidApi {
  return value !== null && typeof value === 'object'
    && 'render' in value && typeof value.render === 'function';
}
