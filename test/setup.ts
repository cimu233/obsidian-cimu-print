import { beforeEach } from 'vitest';

function applyOptions<T extends HTMLElement>(node: T, options?: { cls?: string; text?: string }): T {
  if (options?.cls) node.className = options.cls;
  if (options?.text) node.textContent = options.text;
  return node;
}

globalThis.createDiv = ((options?: { cls?: string; text?: string }) =>
  applyOptions(document.createElement('div'), options)) as typeof createDiv;
globalThis.createEl = ((tag: keyof HTMLElementTagNameMap, options?: { cls?: string; text?: string }) =>
  applyOptions(document.createElement(tag), options)) as typeof createEl;
globalThis.createSpan = ((options?: { cls?: string; text?: string }) =>
  applyOptions(document.createElement('span'), options)) as typeof createSpan;
Object.defineProperties(Window.prototype, {
  createDiv: {
    configurable: true,
    value(this: Window, options?: { cls?: string; text?: string }) {
      return applyOptions(this.document.createElement('div'), options);
    }
  },
  createEl: {
    configurable: true,
    value(this: Window, tag: keyof HTMLElementTagNameMap, options?: { cls?: string; text?: string }) {
      return applyOptions(this.document.createElement(tag), options);
    }
  },
  createSpan: {
    configurable: true,
    value(this: Window, options?: { cls?: string; text?: string }) {
      return applyOptions(this.document.createElement('span'), options);
    }
  }
});
Object.defineProperty(Node.prototype, 'instanceOf', {
  configurable: true,
  value<T>(this: Node, type: new () => T): this is Node & T {
    return this instanceof type;
  }
});
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
  const target = globalThis as typeof globalThis & {
    __notices?: string[];
    __componentLoads?: number;
    __componentUnloads?: number;
  };
  target.__notices = [];
  target.__componentLoads = 0;
  target.__componentUnloads = 0;
});
