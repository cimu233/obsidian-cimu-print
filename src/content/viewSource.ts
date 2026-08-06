import { Notice } from 'obsidian';
import { t } from '../i18n';

interface ViewWithContainer {
  containerEl?: HTMLElement;
}

const CONTENT_SELECTORS = [
  '.markdown-reading-view',
  '.markdown-preview-sizer',
  '.markdown-rendered',
  '.bases-view',
  '.base-view',
  '.view-content'
];

const INTERFACE_SELECTORS = [
  '.view-header',
  '[role="toolbar"]',
  '.clickable-icon',
  '.mod-action-button',
  '.inline-title',
  '.bases-toolbar',
  '.bases-view-toolbar'
];

export function capturePrintableView(
  view: ViewWithContainer | null | undefined,
  leadingNodes: HTMLElement[] = [],
  title?: string
): HTMLElement | null {
  const source = findContentRoot(view?.containerEl);
  if (!source) {
    new Notice(t('notice.previewCaptureFailed'));
    return null;
  }

  const output = createDiv();
  leadingNodes.forEach((node) => output.appendChild(node));
  if (title) {
    const heading = createEl('h1');
    heading.textContent = title;
    output.appendChild(heading);
  }

  const wrapper = createEl('article');
  wrapper.className = 'cimu-print-document cimu-print-view';
  const clone = source.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(INTERFACE_SELECTORS.join(',')).forEach((node) => node.remove());
  wrapper.appendChild(clone);
  output.appendChild(wrapper);
  return output;
}

function findContentRoot(container?: HTMLElement): HTMLElement | null {
  if (!container) {
    return null;
  }
  for (const selector of CONTENT_SELECTORS) {
    const match = container.querySelector<HTMLElement>(selector);
    if (match) {
      return match;
    }
  }
  return container;
}
