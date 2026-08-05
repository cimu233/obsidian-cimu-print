import { App, TFolder } from 'obsidian';

export function resolveActiveNoteFolder(app: App): TFolder | null {
    const parent = app.workspace.getActiveFile()?.parent;
    return parent instanceof TFolder ? parent : null;
}
