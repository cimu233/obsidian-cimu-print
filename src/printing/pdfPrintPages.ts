import {
    GlobalWorkerOptions,
    getDocument,
    type PDFDocumentLoadingTask
} from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerSource from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?raw';
import { CimuPrintSettings } from '../types';

const PRINT_RESOLUTION_DPI = 150;
const PAGE_DIMENSIONS_MM = {
    A3: [297, 420],
    A4: [210, 297],
    A5: [148, 210],
    Letter: [215.9, 279.4],
    Legal: [215.9, 355.6]
} as const;

let workerUrl: string | null = null;

export type WritePdfPrintPage = (
    pageNumber: number,
    pngData: Uint8Array
) => Promise<string>;

export async function renderPdfPrintPages(
    pdfData: Uint8Array,
    writePage: WritePdfPrintPage
): Promise<string[]> {
    configurePdfWorker();
    const loadingTask = getDocument({
        data: new Uint8Array(pdfData),
        isEvalSupported: false,
        disableFontFace: true,
        useSystemFonts: false
    });

    try {
        return await renderPages(loadingTask, writePage);
    } finally {
        await loadingTask.destroy().catch(() => undefined);
    }
}

export async function getPdfPageCount(pdfData: Uint8Array): Promise<number> {
    configurePdfWorker();
    const loadingTask = getDocument({
        data: new Uint8Array(pdfData),
        isEvalSupported: false,
        disableFontFace: true,
        useSystemFonts: false
    });

    try {
        const pdfDocument = await loadingTask.promise;
        return pdfDocument.numPages;
    } finally {
        await loadingTask.destroy().catch(() => undefined);
    }
}

export function buildPdfPrintPagesHtml(
    title: string,
    pageUrls: string[],
    settings: CimuPrintSettings
): string {
    const [configuredWidth, configuredHeight] = PAGE_DIMENSIONS_MM[settings.pageSize];
    const widthMm = settings.landscape ? configuredHeight : configuredWidth;
    const heightMm = settings.landscape ? configuredWidth : configuredHeight;
    const pages = pageUrls.map((pageUrl, index) => `
        <section class="pdf-print-page" aria-label="Page ${index + 1}">
            <img src="${escapeHtml(pageUrl)}" alt="">
        </section>
    `).join('');

    return `<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
    <style>
        @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: #fff; }
        .pdf-print-page {
            width: ${widthMm}mm;
            height: ${heightMm}mm;
            margin: 0;
            overflow: hidden;
            break-after: page;
            page-break-after: always;
        }
        .pdf-print-page:last-child {
            break-after: auto;
            page-break-after: auto;
        }
        .pdf-print-page img {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: fill;
        }
    </style>
</head>
<body>${pages}</body>
</html>`;
}

async function renderPages(
    loadingTask: PDFDocumentLoadingTask,
    writePage: WritePdfPrintPage
): Promise<string[]> {
    const pdfDocument = await loadingTask.promise;
    const pageUrls: string[] = [];
    const scale = PRINT_RESOLUTION_DPI / 72;

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
        const page = await pdfDocument.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        const canvas = createEl('canvas');
        canvas.width = Math.max(1, Math.ceil(viewport.width));
        canvas.height = Math.max(1, Math.ceil(viewport.height));
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) {
            throw new Error('Canvas rendering is unavailable for system printing.');
        }

        try {
            await page.render({
                canvasContext: context,
                viewport,
                background: '#ffffff'
            }).promise;
            const pngData = await canvasToPng(canvas);
            pageUrls.push(await writePage(pageNumber, pngData));
        } finally {
            canvas.width = 1;
            canvas.height = 1;
            page.cleanup();
        }
    }

    return pageUrls;
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('Could not create a printable PDF page image.'));
                return;
            }
            void blob.arrayBuffer()
                .then((buffer) => resolve(new Uint8Array(buffer)))
                .catch(reject);
        }, 'image/png');
    });
}

function configurePdfWorker(): void {
    if (!workerUrl) {
        workerUrl = URL.createObjectURL(new Blob([pdfWorkerSource], { type: 'text/javascript' }));
    }
    GlobalWorkerOptions.workerSrc = workerUrl;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
