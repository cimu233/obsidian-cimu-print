import { Notice, Platform } from 'obsidian';
import { CimuPrintSettings } from '../types';
import {
    prepareRetainedPrintPdf,
    PrintPdfDirectoryError
} from './retainedPrintPdf';
import { t } from '../i18n';

interface ElectronShellLike {
    openPath: (path: string) => Promise<string>;
}

interface ElectronModuleLike {
    shell?: ElectronShellLike;
}

interface ElectronCapableWindow extends Window {
    require?: (moduleName: string) => unknown;
}

export async function openPdfInDefaultApp(
    title: string,
    content: HTMLElement,
    settings: CimuPrintSettings,
    cssText: string,
    bodyClasses: string[] = []
): Promise<boolean> {
    const requireModule = (window as ElectronCapableWindow).require;
    if (!Platform.isDesktopApp || typeof requireModule !== 'function') {
        new Notice(t('notice.desktopPdfOnly'));
        return false;
    }

    let savedPdfPath: string | null = null;

    try {
        const electron = requireModule('electron') as ElectronModuleLike;
        const shell = electron.shell;

        if (!shell?.openPath) {
            throw new Error('Electron PDF handoff services are unavailable.');
        }

        const retainedPdf = await prepareRetainedPrintPdf(
            title,
            content,
            settings,
            cssText,
            bodyClasses
        );
        savedPdfPath = retainedPdf.path;

        const openError = await shell.openPath(savedPdfPath);
        if (openError) {
            console.error('Default PDF app failed to open the file:', openError);
            new Notice(t('notice.pdfAppOpenFailed', { path: savedPdfPath }));
            return false;
        }

        new Notice(t('notice.pdfAppOpened', {
            count: retainedPdf.pageCount,
            path: savedPdfPath
        }));
        return true;
    } catch (error) {
        console.error('PDF handoff failed:', error);
        if (error instanceof PrintPdfDirectoryError) {
            new Notice(t('notice.printDirectoryInvalid', { path: error.path }));
        } else if (savedPdfPath) {
            new Notice(t('notice.pdfAppOpenFailed', { path: savedPdfPath }));
        } else {
            new Notice(t('notice.pdfHandoffFailed'));
        }
        return false;
    }
}
