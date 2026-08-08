import { Platform } from 'obsidian';

interface OpenDialogResult {
    canceled: boolean;
    filePaths: string[];
}

interface ElectronModuleLike {
    remote?: {
        dialog?: {
            showOpenDialog: (options: Record<string, unknown>) => Promise<OpenDialogResult>;
        };
    };
}

interface NodeOsLike {
    tmpdir: () => string;
}

interface ElectronCapableWindow extends Window {
    require?: (moduleName: string) => unknown;
}

let defaultPrintHandoffDirectory = '';

export function setDefaultPrintHandoffDirectory(directory: string): void {
    defaultPrintHandoffDirectory = directory.trim();
}

export function getDefaultPrintHandoffDirectory(): string {
    return defaultPrintHandoffDirectory;
}

export function getSystemPrintDirectory(): string {
    const requireModule = (window as ElectronCapableWindow).require;
    if (!Platform.isDesktopApp || typeof requireModule !== 'function') {
        return '';
    }

    const os = requireModule('os') as NodeOsLike;
    return typeof os?.tmpdir === 'function' ? os.tmpdir() : '';
}

export async function choosePrintHandoffDirectory(
    currentDirectory: string,
    dialogTitle: string
): Promise<string | null> {
    const requireModule = (window as ElectronCapableWindow).require;
    if (!Platform.isDesktopApp || typeof requireModule !== 'function') {
        throw new Error('Desktop folder selection is unavailable.');
    }

    const electron = requireModule('electron') as ElectronModuleLike;
    const dialog = electron.remote?.dialog;
    if (!dialog?.showOpenDialog) {
        throw new Error('Electron folder selection is unavailable.');
    }

    const result = await dialog.showOpenDialog({
        title: dialogTitle,
        defaultPath: currentDirectory
            || getDefaultPrintHandoffDirectory()
            || getSystemPrintDirectory()
            || undefined,
        properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled) {
        return null;
    }

    return result.filePaths[0] ?? null;
}
