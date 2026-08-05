import { beforeEach } from 'vitest';

function applyOptions<T extends HTMLElement>(node: T, options?: { cls?: string; text?: string }): T {
  if (options?.cls) node.className = options.cls;
  if (options?.text) node.textContent = options.text;
  return node;
}

globalThis.createDiv = ((options?: { cls?: string; text?: string }) =>
  applyOptions(document.createElement('div'), options)) as typeof createDiv;
HTMLElement.prototype.addClass = function (...classes: string[]): void {
  this.classList.add(...classes);
};
Object.defineProperty(HTMLElement.prototype, 'createDiv', {
  configurable: true,
  value(this: HTMLElement, options?: { cls?: string; text?: string }): HTMLDivElement {
    const node = applyOptions(document.createElement('div'), options);
    this.appendChild(node);
    return node;
  }
});
Object.defineProperty(HTMLElement.prototype, 'createEl', {
  configurable: true,
  value(
    this: HTMLElement,
    tag: keyof HTMLElementTagNameMap,
    options?: { cls?: string; text?: string }
  ): HTMLElement {
    const node = applyOptions(document.createElement(tag), options);
    this.appendChild(node);
    return node;
  }
});

beforeEach(() => {
  (globalThis as typeof globalThis & { __notices?: string[] }).__notices = [];
});
