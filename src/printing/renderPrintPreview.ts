import {
    GlobalWorkerOptions,
    getDocument,
    type PDFDocumentLoadingTask,
    type PDFDocumentProxy,
    type RenderTask
} from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerSource from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?raw';
import { CimuPrintSettings } from '../types';
import { createPrintPdfData } from './printPdf';

interface PreviewRenderOptions {
    frame: HTMLIFrameElement;
    title: string;
    sourceContent: HTMLElement;
    printCss: string;
    settings: CimuPrintSettings;
    includeThemeStyles: boolean;
    bodyClasses?: string[];
    isCurrent?: () => boolean;
}

interface PreviewPageState {
    pageNumber: number;
    container: HTMLElement;
    canvas: HTMLCanvasElement | null;
    renderTask: RenderTask | null;
    renderGeneration: number;
    status: 'idle' | 'rendering' | 'rendered';
}

interface PreviewState {
    disposed: boolean;
    committed: boolean;
    loadingTask: PDFDocumentLoadingTask;
    document: PDFDocumentProxy | null;
    observer: IntersectionObserver | null;
    pages: Map<Element, PreviewPageState>;
}

interface PreviewWindow extends Window {
    IntersectionObserver?: typeof IntersectionObserver;
}

const previewStates = new WeakMap<HTMLIFrameElement, PreviewState>();
let workerUrl: string | null = null;

export async function renderPrintPreview({
    frame,
    title,
    sourceContent,
    printCss,
    settings,
    includeThemeStyles,
    bodyClasses = [],
    isCurrent = () => true
}: PreviewRenderOptions): Promise<number> {
    const pdfData = await createPrintPdfData(
        title,
        sourceContent,
        settings,
        printCss,
        bodyClasses,
        includeThemeStyles
    );
    if (!isCurrent()) {
        return 1;
    }

    configurePdfWorker();

    const loadingTask = getDocument({
        data: pdfData.slice(),
        isEvalSupported: false,
        disableFontFace: true,
        useSystemFonts: false
    });
    const state: PreviewState = {
        disposed: false,
        committed: false,
        loadingTask,
        document: null,
        observer: null,
        pages: new Map()
    };
    const pdfDocument = await loadingTask.promise;
    state.document = pdfDocument;
    if (!isStateUsable(frame, state, isCurrent)) {
        disposePreviewState(state);
        return pdfDocument.numPages;
    }

    const preparedPages = await preparePreviewPages(frame, state, settings, isCurrent);
    if (!preparedPages || !isStateUsable(frame, state, isCurrent)) {
        disposePreviewState(state);
        return pdfDocument.numPages;
    }

    commitPreviewPages(frame, state, preparedPages.pagesElement, title);
    activateDeferredPageRendering(
        frame,
        state,
        preparedPages.previewScale,
        settings,
        isCurrent
    );
    return pdfDocument.numPages;
}

export function clearPrintPreview(frame: HTMLIFrameElement | null): void {
    if (!frame) {
        return;
    }

    const state = previewStates.get(frame);
    if (state) {
        previewStates.delete(frame);
        disposePreviewState(state);
    }
    frame.removeAttribute('srcdoc');
    frame.removeAttribute('src');
}

export function hasPrintPreview(frame: HTMLIFrameElement | null): boolean {
    return Boolean(frame && previewStates.has(frame));
}

export function renderEmptyPrintPreview(frame: HTMLIFrameElement, message: string): void {
    clearPrintPreview(frame);
    const doc = frame.contentDocument;
    if (!doc) {
        return;
    }

    doc.open();
    doc.write(`<!doctype html><html><body style="margin:0;background:#d4d7db;color:#596170;font:14px sans-serif;display:grid;place-items:center;height:100vh"><p>${escapeHtml(message)}</p></body></html>`);
    doc.close();
}

export function buildPdfCanvasShell(title: string): string {
    return `<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
    <style>
        :root { color-scheme: light; background: #d4d7db; }
        * { box-sizing: border-box; }
        html, body { width: 100%; min-height: 100%; margin: 0; }
        body {
            overflow: auto;
            background: #d4d7db;
            color: #596170;
            font: 13px sans-serif;
        }
        #pages {
            display: flex;
            min-width: min-content;
            min-height: 100vh;
            flex-direction: column;
            align-items: center;
            gap: 24px;
            padding: 32px;
        }
        .pdf-page {
            position: relative;
            flex: 0 0 auto;
            overflow: hidden;
            background: #fff;
            border: 1px solid #a8adb4;
            box-shadow: 0 10px 28px rgba(31, 41, 55, 0.22), 0 2px 5px rgba(31, 41, 55, 0.16);
        }
        .pdf-page::before {
            position: absolute;
            inset: 0;
            display: grid;
            place-items: center;
            color: #7b838d;
            content: attr(data-loading-label);
        }
        .pdf-page[data-rendered="true"]::before { content: none; }
        .pdf-page canvas { position: relative; display: block; width: 100%; height: 100%; }
        .pdf-page-number {
            position: absolute;
            right: 8px;
            bottom: 6px;
            z-index: 1;
            padding: 2px 6px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.86);
            color: #626a74;
            font: 11px sans-serif;
        }
    </style>
</head>
<body><div id="pages"></div></body>
</html>`;
}

interface PreparedPreviewPages {
    pagesElement: HTMLElement;
    previewScale: number;
}

async function preparePreviewPages(
    frame: HTMLIFrameElement,
    state: PreviewState,
    settings: CimuPrintSettings,
    isCurrent: () => boolean
): Promise<PreparedPreviewPages | null> {
    const pdfDocument = state.document;
    const doc = frame.contentDocument;
    if (!pdfDocument || !doc) {
        throw new Error('The PDF preview document is unavailable.');
    }

    const pagesElement = doc.createElement('div');
    pagesElement.id = 'pages';

    const firstPage = await pdfDocument.getPage(1);
    const unscaledViewport = firstPage.getViewport({ scale: 1 });
    const previewScale = calculatePreviewScale(
        unscaledViewport.width,
        frame.clientWidth,
        settings.previewFitToWidth,
        settings.previewZoomPercent
    );
    const viewport = firstPage.getViewport({ scale: previewScale });

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
        const container = doc.createElement('section');
        container.className = 'pdf-page';
        container.style.width = `${Math.round(viewport.width)}px`;
        container.style.height = `${Math.round(viewport.height)}px`;
        container.dataset.loadingLabel = `Page ${pageNumber}`;
        pagesElement.appendChild(container);

        if (settings.previewShowPageNumbers) {
            const label = doc.createElement('span');
            label.className = 'pdf-page-number';
            label.textContent = `${pageNumber} / ${pdfDocument.numPages}`;
            container.appendChild(label);
        }

        state.pages.set(container, {
            pageNumber,
            container,
            canvas: null,
            renderTask: null,
            renderGeneration: 0,
            status: 'idle'
        });
    }

    if (!isStateUsable(frame, state, isCurrent)) {
        return null;
    }

    const firstPageState = Array.from(state.pages.values())[0];
    if (firstPageState) {
        await renderPage(frame, state, firstPageState, previewScale, settings, isCurrent);
        if (firstPageState.status !== 'rendered') {
            if (!isStateUsable(frame, state, isCurrent)) {
                return null;
            }
            throw new Error('The first PDF preview page could not be rendered.');
        }
    }

    return { pagesElement, previewScale };
}

function commitPreviewPages(
    frame: HTMLIFrameElement,
    state: PreviewState,
    pagesElement: HTMLElement,
    title: string
): void {
    let doc = frame.contentDocument;
    if (!doc) {
        throw new Error('The preview frame is unavailable.');
    }

    let currentPages = doc.getElementById('pages');
    if (!currentPages) {
        writePreviewShell(frame, title);
        doc = frame.contentDocument;
        currentPages = doc?.getElementById('pages') ?? null;
    }
    if (!doc || !currentPages) {
        throw new Error('The preview page container is unavailable.');
    }

    const previousState = previewStates.get(frame);
    const scrollTop = doc.scrollingElement?.scrollTop ?? 0;
    const scrollLeft = doc.scrollingElement?.scrollLeft ?? 0;

    state.committed = true;
    previewStates.set(frame, state);
    currentPages.replaceWith(pagesElement);
    doc.title = title;
    doc.scrollingElement?.scrollTo(scrollLeft, scrollTop);

    if (previousState && previousState !== state) {
        disposePreviewState(previousState);
    }
}

function activateDeferredPageRendering(
    frame: HTMLIFrameElement,
    state: PreviewState,
    previewScale: number,
    settings: CimuPrintSettings,
    isCurrent: () => boolean
): void {
    const Observer = (frame.contentWindow as PreviewWindow | null)?.IntersectionObserver;
    if (Observer) {
        state.observer = new Observer((entries: IntersectionObserverEntry[]) => {
            entries.forEach((entry: IntersectionObserverEntry) => {
                const pageState = state.pages.get(entry.target);
                if (!pageState) {
                    return;
                }
                if (entry.isIntersecting) {
                    void renderPage(frame, state, pageState, previewScale, settings, isCurrent);
                }
            });
        }, { root: null, rootMargin: '1200px 0px' });
        state.pages.forEach((pageState) => state.observer?.observe(pageState.container));
    } else {
        for (const pageState of state.pages.values()) {
            void renderPage(frame, state, pageState, previewScale, settings, isCurrent);
        }
    }
}

export function calculatePreviewScale(
    pageWidth: number,
    frameWidth: number,
    fitToWidth: boolean,
    zoomPercent: number
): number {
    const availableWidth = Math.max(240, (frameWidth || 960) - 64);
    if (fitToWidth) {
        return Math.min(2.5, availableWidth / pageWidth);
    }
    const baseScale = 96 / 72;
    const zoomMultiplier = Math.max(0.25, Math.min(1.5, zoomPercent / 100));
    return baseScale * zoomMultiplier;
}

async function renderPage(
    frame: HTMLIFrameElement,
    state: PreviewState,
    pageState: PreviewPageState,
    previewScale: number,
    settings: CimuPrintSettings,
    isCurrent: () => boolean
): Promise<void> {
    if (pageState.status !== 'idle' || !state.document || !isStateUsable(frame, state, isCurrent)) {
        return;
    }

    const renderGeneration = ++pageState.renderGeneration;
    pageState.status = 'rendering';
    try {
        const page = await state.document.getPage(pageState.pageNumber);
        if (
            !isStateUsable(frame, state, isCurrent) ||
            pageState.status !== 'rendering' ||
            pageState.renderGeneration !== renderGeneration
        ) {
            return;
        }

        const viewport = page.getViewport({ scale: previewScale });
        const outputScale = Math.min(2, frame.contentWindow?.devicePixelRatio || 1);
        const canvas = frame.contentDocument!.createElement('canvas');
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) {
            throw new Error('Canvas rendering is unavailable.');
        }

        canvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
        canvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
        canvas.style.width = `${Math.round(viewport.width)}px`;
        canvas.style.height = `${Math.round(viewport.height)}px`;
        pageState.container.prepend(canvas);
        pageState.canvas = canvas;
        pageState.renderTask = page.render({
            canvasContext: context,
            viewport,
            transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
            background: '#ffffff'
        });
        await pageState.renderTask.promise;
        if (pageState.renderGeneration !== renderGeneration) {
            return;
        }
        pageState.renderTask = null;
        pageState.status = 'rendered';
        pageState.container.dataset.rendered = 'true';
        if (!settings.previewShowPageNumbers) {
            pageState.container.querySelector('.pdf-page-number')?.remove();
        }
    } catch (error) {
        if (
            pageState.status === 'rendering' &&
            pageState.renderGeneration === renderGeneration
        ) {
            pageState.status = 'idle';
        }
        if ((error as { name?: string }).name !== 'RenderingCancelledException') {
            console.error(`PDF preview page ${pageState.pageNumber} failed:`, error);
        }
    }
}

function releasePage(pageState: PreviewPageState): void {
    pageState.renderGeneration += 1;
    pageState.renderTask?.cancel();
    pageState.renderTask = null;
    if (pageState.canvas) {
        pageState.canvas.width = 1;
        pageState.canvas.height = 1;
        pageState.canvas.remove();
        pageState.canvas = null;
    }
    pageState.status = 'idle';
    delete pageState.container.dataset.rendered;
}

function writePreviewShell(frame: HTMLIFrameElement, title: string): void {
    const doc = frame.contentDocument;
    if (!doc) {
        throw new Error('The preview frame is unavailable.');
    }
    doc.open();
    doc.write(buildPdfCanvasShell(title));
    doc.close();
}

function configurePdfWorker(): void {
    if (!workerUrl) {
        workerUrl = URL.createObjectURL(new Blob([pdfWorkerSource], { type: 'text/javascript' }));
    }
    GlobalWorkerOptions.workerSrc = workerUrl;
}

function isStateUsable(frame: HTMLIFrameElement, state: PreviewState, isCurrent: () => boolean): boolean {
    if (state.disposed) {
        return false;
    }

    return state.committed
        ? previewStates.get(frame) === state
        : isCurrent();
}

function disposePreviewState(state: PreviewState): void {
    if (state.disposed) {
        return;
    }
    state.disposed = true;
    state.observer?.disconnect();
    state.pages.forEach(releasePage);
    void state.loadingTask.destroy().catch(() => undefined);
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
