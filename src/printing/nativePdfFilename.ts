import { App, MarkdownView } from 'obsidian';
import { CimuPrintSettings } from '../types';
import { resolveDocumentTitle, sanitizePdfFilename } from './documentTitle';

interface SaveDialogOptionsLike {
    defaultPath?: string;
    filters?: Array<{ extensions?: string[] }>;
    [key: string]: unknown;
}

type ShowSaveDialogLike = (...args: unknown[]) => Promise<unknown>;

interface ElectronDialogLike {
    showSaveDialog: ShowSaveDialogLike;
}

interface ElectronWindow extends Window {
    require?: (moduleName: string) => {
        remote?: {
            dialog?: ElectronDialogLike;
        };
    };
}

export function installNativePdfFilenameHook(
    app: App,
    getSettings: () => CimuPrintSettings
): () => void {
    const electronWindow = window as ElectronWindow;
    const dialog = electronWindow.require?.('electron')?.remote?.dialog;

    if (!dialog?.showSaveDialog) {
        return () => undefined;
    }

    const original = dialog.showSaveDialog;
    const wrapped: ShowSaveDialogLike = function (...args: unknown[]): Promise<unknown> {
        const settings = getSettings();
        const optionsIndex = findOptionsIndex(args);

        if (settings.nativePdfFilename && optionsIndex >= 0) {
            const originalOptions = args[optionsIndex] as SaveDialogOptionsLike;

            if (isPdfDialog(originalOptions)) {
                const activeView = app.workspace.getActiveViewOfType(MarkdownView);
                const activeFile = activeView?.file;

                if (activeView && activeFile?.extension === 'md') {
                    const markdown = activeView.editor.getValue();
                    const title = resolveDocumentTitle(
                        markdown,
                        activeFile.basename,
                        settings.pdfFilenameSource
                    );
                    const safeTitle = sanitizePdfFilename(title, activeFile.basename);

                    args[optionsIndex] = {
                        ...originalOptions,
                        defaultPath: replacePathFilename(originalOptions.defaultPath ?? '', `${safeTitle}.pdf`)
                    };
                }
            }
        }

        return original.apply(dialog, args);
    };

    dialog.showSaveDialog = wrapped;

    return () => {
        if (dialog.showSaveDialog === wrapped) {
            dialog.showSaveDialog = original;
        }
    };
}

function findOptionsIndex(args: unknown[]): number {
    for (let index = args.length - 1; index >= 0; index -= 1) {
        const value = args[index];
        if (value && typeof value === 'object' && ('defaultPath' in value || 'filters' in value)) {
            return index;
        }
    }

    return -1;
}

function isPdfDialog(options: SaveDialogOptionsLike): boolean {
    if (options.defaultPath?.toLowerCase().endsWith('.pdf')) {
        return true;
    }

    return options.filters?.some((filter) =>
        filter.extensions?.some((extension) => extension.toLowerCase() === 'pdf')
    ) ?? false;
}

function replacePathFilename(defaultPath: string, filename: string): string {
    const separatorIndex = Math.max(defaultPath.lastIndexOf('/'), defaultPath.lastIndexOf('\\'));
    return separatorIndex >= 0
        ? `${defaultPath.slice(0, separatorIndex + 1)}${filename}`
        : filename;
}
