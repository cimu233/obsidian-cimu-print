import { Notice, Platform } from 'obsidian';
import { CimuPrintSettings } from '../types';
import {
    getResolvedRuntimeTypographyCss,
    getTargetedRuntimePrintCss
} from './styleCapture';
import { createPrintPdfData } from './printPdf';
import { t } from '../i18n';

interface SaveDialogResult {
    canceled: boolean;
    filePath?: string;
}

interface ElectronModuleLike {
    remote?: {
        dialog: {
            showSaveDialog: (options: Record<string, unknown>) => Promise<SaveDialogResult>;
        };
    };
}

interface NodeFsLike {
    promises: {
        writeFile: (path: string, data: Uint8Array) => Promise<void>;
    };
}

interface ElectronCapableWindow extends Window {
    require?: (moduleName: string) => ElectronModuleLike | NodeFsLike;
}

export async function exportPrintPdf(
    title: string,
    content: HTMLElement,
    settings: CimuPrintSettings,
    generatedCss: string,
    bodyClasses: string[] = []
): Promise<boolean> {
    if (!Platform.isDesktopApp || typeof (window as ElectronCapableWindow).require !== 'function') {
        new Notice(t('notice.desktopPdfOnly'));
        return false;
    }

    try {
        const requireModule = (window as ElectronCapableWindow).require!;
        const electron = requireModule('electron') as ElectronModuleLike;
        const fileSystem = requireModule('fs') as NodeFsLike;
        const dialog = electron.remote?.dialog;

        if (!dialog || !fileSystem?.promises?.writeFile) {
            throw new Error('Electron PDF services are unavailable.');
        }

        const saveResult = await dialog.showSaveDialog({
            title: t('notice.exportPdfTitle'),
            defaultPath: `${title}.pdf`,
            filters: [{ name: 'PDF', extensions: ['pdf'] }],
            properties: ['createDirectory', 'showOverwriteConfirmation']
        });

        if (saveResult.canceled || !saveResult.filePath) {
            return false;
        }

        const includeThemeStyles = settings.printStyleMode === 'styled';
        const runtimeCss = includeThemeStyles
            ? getTargetedRuntimePrintCss(content, settings.printFontFamily)
            : getResolvedRuntimeTypographyCss(content, settings.printFontFamily);
        const combinedCss = [generatedCss, runtimeCss]
            .filter((value) => value.trim().length > 0)
            .join('\n');
        const pdfData = await createPrintPdfData(
            title,
            content,
            settings,
            combinedCss,
            bodyClasses,
            includeThemeStyles
        );

        await fileSystem.promises.writeFile(saveResult.filePath, pdfData);
        new Notice(t('notice.pdfSaved', { path: saveResult.filePath }));
        return true;
    } catch (error) {
        console.error('Direct PDF export failed:', error);
        new Notice(t('notice.pdfFailed'));
        return false;
    }
}
