import { App, TFile } from 'obsidian';

const ROOT_CLASS = 'cimu-print-frontmatter';
const OMITTED_KEYS = new Set(['position']);

export function buildPrintableProperties(app: App, file: TFile): HTMLElement | null {
    const cached = app.metadataCache.getFileCache(file)?.frontmatter;
    if (!isRecord(cached)) {
        return null;
    }

    const properties = Object.entries(cached)
        .filter(([key, value]) => !OMITTED_KEYS.has(key) && value !== null && value !== undefined);
    if (properties.length === 0) {
        return null;
    }

    const section = element('section', ROOT_CLASS);
    const heading = element('div', `${ROOT_CLASS}-heading`, 'Properties');
    const list = element('div', `${ROOT_CLASS}-properties`);

    for (const [name, value] of properties) {
        const row = element('div', `${ROOT_CLASS}-property`);
        row.classList.add(`${ROOT_CLASS}-property--${propertyKind(value)}`);
        row.append(
            element('div', `${ROOT_CLASS}-key`, name),
            propertyValueContainer(value)
        );
        list.appendChild(row);
    }

    section.append(heading, list);
    return section;
}

function propertyValueContainer(value: unknown): HTMLElement {
    const container = element('div', `${ROOT_CLASS}-value`);
    appendValue(container, value);
    return container;
}

function appendValue(parent: HTMLElement, value: unknown): void {
    if (typeof value === 'boolean') {
        parent.appendChild(booleanValue(value));
        return;
    }

    if (isScalar(value)) {
        parent.appendChild(scalarValue(value));
        return;
    }

    if (Array.isArray(value)) {
        appendArray(parent, value.filter(isPresent));
        return;
    }

    if (isRecord(value)) {
        appendObject(parent, Object.entries(value).filter(([, entry]) => isPresent(entry)));
        return;
    }

    if (isPresent(value)) {
        parent.appendChild(scalarValue(String(value)));
    }
}

function appendArray(parent: HTMLElement, values: unknown[]): void {
    if (values.length === 0) {
        return;
    }

    if (values.every(isInlineScalar)) {
        const chips = element('div', `${ROOT_CLASS}-chip-list`);
        for (const value of values) {
            const chip = element('span', `${ROOT_CLASS}-chip`);
            chip.appendChild(inlineValue(value));
            chips.appendChild(chip);
        }
        parent.appendChild(chips);
        return;
    }

    if (values.length === 1) {
        appendValue(parent, values[0]);
        return;
    }

    const list = element('ul', `${ROOT_CLASS}-list`);
    for (const value of values) {
        const item = createEl('li');
        appendValue(item, value);
        list.appendChild(item);
    }
    parent.appendChild(list);
}

function appendObject(parent: HTMLElement, entries: Array<[string, unknown]>): void {
    if (entries.length === 0) {
        return;
    }

    const definitionList = element('dl', `${ROOT_CLASS}-object`);
    for (const [name, value] of entries) {
        const row = element('div', `${ROOT_CLASS}-object-row`);
        const term = element('dt', `${ROOT_CLASS}-object-key`, name);
        const description = element('dd', `${ROOT_CLASS}-object-value`);
        appendValue(description, value);
        row.append(term, description);
        definitionList.appendChild(row);
    }
    parent.appendChild(definitionList);
}

function booleanValue(value: boolean): HTMLElement {
    const wrapper = element('span', `${ROOT_CLASS}-boolean`);
    wrapper.classList.toggle('is-checked', value);
    const indicator = element('span', `${ROOT_CLASS}-boolean-indicator`);
    indicator.setAttribute('aria-hidden', 'true');
    wrapper.append(indicator, element('span', `${ROOT_CLASS}-boolean-text`, String(value)));
    return wrapper;
}

function inlineValue(value: string | number | boolean): HTMLElement {
    return typeof value === 'boolean' ? booleanValue(value) : scalarValue(value);
}

function scalarValue(value: string | number): HTMLElement {
    const text = String(value);
    if (/^(?:https?:\/\/|mailto:)/i.test(text)) {
        const link = element('a', `${ROOT_CLASS}-link`, text);
        link.href = text;
        return link;
    }
    return element('span', `${ROOT_CLASS}-text`, text);
}

function propertyKind(value: unknown): 'boolean' | 'scalar' | 'chip-list' | 'list' | 'object' {
    if (typeof value === 'boolean') {
        return 'boolean';
    }
    if (isScalar(value)) {
        return 'scalar';
    }
    if (Array.isArray(value)) {
        return value.filter(isPresent).every(isInlineScalar) ? 'chip-list' : 'list';
    }
    return isRecord(value) ? 'object' : 'scalar';
}

function element<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className: string,
    text?: string
): HTMLElementTagNameMap[K] {
    const node = createEl(tag);
    node.className = className;
    if (text !== undefined) {
        node.textContent = text;
    }
    return node;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isPresent(value: unknown): boolean {
    return value !== null && value !== undefined;
}

function isScalar(value: unknown): value is string | number {
    return typeof value === 'string' || typeof value === 'number';
}

function isInlineScalar(value: unknown): value is string | number | boolean {
    return isScalar(value) || typeof value === 'boolean';
}
