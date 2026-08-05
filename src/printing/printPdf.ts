import { Platform } from 'obsidian';
import { CimuPrintSettings } from '../types';
import { createDebugPrintHtml } from './styleCapture';

interface PdfBrowserWindowLike {
    loadURL: (url: string) => Promise<void> | void;
    close: () => void;
    isDestroyed?: () => boolean;
    webContents: {
        executeJavaScript?: (code: string) => Promise<unknown>;
        printToPDF: (options: Record<string, unknown>) => Promise<Uint8Array>;
    };
}

interface ElectronModuleLike {
    remote?: {
        BrowserWindow: new (options: Record<string, unknown>) => PdfBrowserWindowLike;
    };
}

interface ElectronCapableWindow extends Window {
    require?: (moduleName: string) => unknown;
}

export async function createPrintPdfData(
    title: string,
    content: HTMLElement,
    settings: CimuPrintSettings,
    cssText: string,
    bodyClasses: string[] = [],
    includeThemeStyles = settings.printStyleMode === 'styled'
): Promise<Uint8Array> {
    const requireModule = (window as ElectronCapableWindow).require;
    if (!Platform.isDesktopApp || typeof requireModule !== 'function') {
        throw new Error('Electron PDF services are unavailable.');
    }

    const electron = requireModule('electron') as ElectronModuleLike;
    const BrowserWindow = electron.remote?.BrowserWindow;
    if (!BrowserWindow) {
        throw new Error('Electron BrowserWindow is unavailable.');
    }

    const printWindow = new BrowserWindow({
        show: false,
        backgroundColor: '#ffffff',
        webPreferences: {
            contextIsolation: true,
            sandbox: true
        }
    });

    try {
        const html = createDebugPrintHtml(
            content,
            cssText,
            title,
            bodyClasses,
            includeThemeStyles
        );

        await Promise.resolve(
            printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
        );
        await waitForPrintAssets(printWindow);

        return await printWindow.webContents.printToPDF({
            landscape: settings.landscape,
            printBackground: true,
            pageSize: settings.pageSize,
            preferCSSPageSize: true,
            scale: 1,
            generateTaggedPDF: true,
            generateDocumentOutline: true
        });
    } finally {
        if (!printWindow.isDestroyed?.()) {
            printWindow.close();
        }
    }
}

export function countPdfPages(pdfData: Uint8Array): number {
    const pdfText = new TextDecoder('latin1').decode(pdfData);
    return Math.max(1, (pdfText.match(/\/Type\s*\/Page(?!s)\b/g) ?? []).length);
}

async function waitForPrintAssets(printWindow: PdfBrowserWindowLike): Promise<void> {
    await printWindow.webContents.executeJavaScript?.(`
        Promise.all([
            document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(),
            ...Array.from(document.images).map((image) => image.complete
                ? Promise.resolve()
                : new Promise((resolve) => {
                    image.addEventListener('load', resolve, { once: true });
                    image.addEventListener('error', resolve, { once: true });
                    setTimeout(resolve, 5000);
                }))
        ])
    `);
}
