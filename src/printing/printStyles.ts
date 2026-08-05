import { App, PluginManifest } from 'obsidian';
import { CimuPrintSettings } from '../types';
import { PLAIN_MARKDOWN_PRINT_STYLES } from './plainMarkdownPrintStyles';

export async function generatePrintStyles(
  app: App,
  manifest: PluginManifest,
  settings: CimuPrintSettings
): Promise<string> {
  const parts = [
    await readPluginStyles(app, manifest),
    layoutCss(settings),
    settings.printStyleMode === 'plain-markdown' ? PLAIN_MARKDOWN_PRINT_STYLES : '',
    settings.printStyleMode === 'plain-markdown' ? typographyCss(settings) : '',
    settings.hrPageBreaks ? '.cimu-print-document hr { break-after: page; }' : '',
    await readUserSnippet(app)
  ];
  return parts.filter((part) => part.trim()).join('\n');
}

function layoutCss(settings: CimuPrintSettings): string {
  const orientation = settings.landscape ? ' landscape' : '';
  const scale = Math.max(25, Math.min(200, settings.printScalePercent)) / 100;
  return `
@page { size: ${settings.pageSize}${orientation}; margin: ${settings.pageMarginMm}mm; }
@media print {
  html, body { margin: 0; background: white; }
  .cimu-print-document { zoom: ${scale}; }
  .cimu-print-page-break { break-before: page; }
}
`;
}

function typographyCss(settings: CimuPrintSettings): string {
  return `
.cimu-print-document { font-size: ${safeCssSize(settings.fontSize, '14px')}; }
.cimu-print-document h1 { font-size: ${safeCssSize(settings.h1Size, '20px')}; }
.cimu-print-document h2 { font-size: ${safeCssSize(settings.h2Size, '18px')}; }
.cimu-print-document h3 { font-size: ${safeCssSize(settings.h3Size, '16px')}; }
.cimu-print-document h4 { font-size: ${safeCssSize(settings.h4Size, '14px')}; }
.cimu-print-document h5 { font-size: ${safeCssSize(settings.h5Size, '14px')}; }
.cimu-print-document h6 { font-size: ${safeCssSize(settings.h6Size, '12px')}; }
`;
}

function safeCssSize(value: string, fallback: string): string {
  return /^\d+(?:\.\d+)?(?:px|pt|em|rem|%)$/.test(value.trim()) ? value.trim() : fallback;
}

async function readPluginStyles(app: App, manifest: PluginManifest): Promise<string> {
  const path = `${manifest.dir ?? `.obsidian/plugins/${manifest.id}`}/styles.css`;
  try {
    return await app.vault.adapter.read(path);
  } catch {
    return '';
  }
}

async function readUserSnippet(app: App): Promise<string> {
  const customCss = (app as App & { customCss?: unknown }).customCss as {
    enabledSnippets?: Set<string>;
    snippets?: Set<string>;
  } | undefined;
  if (!customCss?.enabledSnippets?.has('print') && !customCss?.snippets?.has('print')) {
    return '';
  }
  try {
    return await app.vault.adapter.read(`${app.vault.configDir}/snippets/print.css`);
  } catch {
    return '';
  }
}
