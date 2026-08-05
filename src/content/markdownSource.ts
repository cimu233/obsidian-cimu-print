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

export async function renderMarkdownSource(
  input: TFile | string,
  title: string | false,
  app: App,
  includeProperties = false,
  sourceFile?: TFile
): Promise<HTMLElement | null> {
  const root = document.createElement('article');
  root.className = 'cimu-print-document markdown-rendered';

  try {
    if (includeProperties && input instanceof TFile) {
      const properties = buildPrintableProperties(app, input);
      if (properties) {
        root.appendChild(properties);
      }
    }

    if (title) {
      const heading = document.createElement('h1');
      heading.textContent = title;
      root.appendChild(heading);
    }

    const markdown = input instanceof TFile
      ? removeYamlHeader(await app.vault.cachedRead(input))
      : input;
    const sourcePath = input instanceof TFile ? input.path : sourceFile?.path ?? '';

    await MarkdownRenderer.render(app, markdown, root, sourcePath, new Component());
    root.querySelectorAll('.metadata-container').forEach((node) => node.remove());
    await replaceMermaidCode(root);
    return root;
  } catch (error) {
    console.error('Cimu Print markdown rendering failed:', error);
    new Notice(t('notice.previewGenerationFailed'));
    return null;
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
    const mermaid = await loadMermaid();
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
      const container = document.createElement('div');
      container.className = 'mermaid cimu-print-diagram';
      container.innerHTML = svg;
      if (typeof rendered !== 'string' && typeof rendered?.bindFunctions === 'function') {
        rendered.bindFunctions(container);
      }
      pre.replaceWith(container);
    }
  } catch (error) {
    console.error('Cimu Print Mermaid rendering failed:', error);
  }
}
