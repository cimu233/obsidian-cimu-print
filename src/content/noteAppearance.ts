import { App, TFile } from 'obsidian';

export function readNoteAppearanceClasses(app: App, file?: TFile | null): string[] {
    if (!file) {
        return [];
    }

    const metadata = app.metadataCache.getFileCache(file)?.frontmatter;
    const collected: string[] = [];
    collectClassNames(metadata?.cssclasses ?? metadata?.cssClasses, collected);
    return [...new Set(collected)];
}

function collectClassNames(value: unknown, output: string[]): void {
    if (typeof value === 'string') {
        output.push(...value.split(/\s+/).map((name) => name.trim()).filter(Boolean));
        return;
    }
    if (Array.isArray(value)) {
        value.forEach((entry) => collectClassNames(entry, output));
        return;
    }
    if (value && typeof value === 'object') {
        Object.values(value as Record<string, unknown>)
            .forEach((entry) => collectClassNames(entry, output));
    }
}
