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

export class Component {
  load(): void {
    const target = globalThis as typeof globalThis & { __componentLoads?: number };
    target.__componentLoads = (target.__componentLoads ?? 0) + 1;
  }
  unload(): void {
    const target = globalThis as typeof globalThis & { __componentUnloads?: number };
    target.__componentUnloads = (target.__componentUnloads ?? 0) + 1;
  }
}

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
    if (markdown.includes('```mermaid')) {
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.className = 'language-mermaid';
      code.textContent = 'graph TD; A-->B';
      pre.appendChild(code);
      root.appendChild(pre);
      return;
    }
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

export function getLanguage(): string {
  return 'en';
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
