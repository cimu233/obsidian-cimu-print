export const Platform = {
  isDesktopApp: true,
  isDesktop: true,
  isMobile: false,
  isMobileApp: false
};

export class Notice {
  constructor(message: string) {
    const target = globalThis as typeof globalThis & { __notices?: string[] };
    target.__notices ??= [];
    target.__notices.push(message);
  }
}

export class Component {}

export class TFile {
  path = '';
  basename = '';
  extension = 'md';
  parent: TFolder | null = null;
}

export class TFolder {
  name = '';
  children: Array<TFile | TFolder> = [];
}

export const MarkdownRenderer = {
  async render(
    _app: unknown,
    markdown: string,
    root: HTMLElement
  ): Promise<void> {
    const paragraph = document.createElement('p');
    paragraph.textContent = markdown;
    root.appendChild(paragraph);
  }
};

export function getFrontMatterInfo(markdown: string): {
  exists: boolean;
  contentStart: number;
} {
  const match = markdown.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
  return { exists: Boolean(match), contentStart: match?.[0].length ?? 0 };
}

export async function loadMermaid(): Promise<{ render: () => Promise<{ svg: string }> }> {
  return { render: async () => ({ svg: '<svg></svg>' }) };
}

export class Plugin {}
export class PluginSettingTab {}
export class Setting {}
export class Modal {}
export function setIcon(): void {}
export class MarkdownView {}
export type App = never;
export type EventRef = never;
export type PluginManifest = never;
