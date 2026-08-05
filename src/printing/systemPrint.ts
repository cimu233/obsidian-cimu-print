import { Notice, Platform } from 'obsidian';
import { CimuPrintSettings } from '../types';
import { t } from '../i18n';
import { openPdfInDefaultApp } from './defaultPdfApp';
import {
    cleanupTrackedTemporaryPrintPdfs,
    prepareRetainedPrintPdf,
    prepareVerifiedPrintPdfData,
    PrintPdfDirectoryError
} from './retainedPrintPdf';
import {
    DirectSystemPrintUnavailableError,
    submitPdfDataToSystemPrinter,
    submitPdfToSystemPrinter,
    supportsDirectSystemPrint,
    SystemPrintJobOptions,
    validatePageRanges
} from './systemPrinters';

export async function printWithSystemPrinter(
    title: string,
    content: HTMLElement,
    settings: CimuPrintSettings,
    cssText: string,
    jobOptions: SystemPrintJobOptions,
    bodyClasses: string[] = []
): Promise<boolean> {
    if (!Platform.isDesktopApp) {
        new Notice(t('notice.desktopPdfOnly'));
        return false;
    }

    const cleanupResult = await cleanupTrackedTemporaryPrintPdfs(settings);
    if (cleanupResult.failedPaths.length > 0) {
        console.warn('Some temporary print PDFs could not be cleaned:', cleanupResult.failedPaths);
    }

    if (!supportsDirectSystemPrint()) {
        new Notice(t('notice.directPrintFallback'));
        return await openPdfInDefaultApp(title, content, settings, cssText, bodyClasses);
    }

    let retainedPath: string | null = null;

    try {
        if (settings.useInMemoryPrinting) {
            const verifiedPdf = await prepareVerifiedPrintPdfData(
                title,
                content,
                settings,
                cssText,
                bodyClasses
            );
            const pageRanges = validatePageRanges(jobOptions.pageRanges, verifiedPdf.pageCount);
            const submission = await submitPdfDataToSystemPrinter({
                ...jobOptions,
                pageRanges,
                pdfData: verifiedPdf.data,
                title,
                pageCount: verifiedPdf.pageCount
            });

            new Notice(t('notice.memoryPrintSubmitted', {
                count: verifiedPdf.pageCount,
                printer: jobOptions.printerName,
                job: submission.jobId
            }));
            return true;
        }

        const retainedPdf = await prepareRetainedPrintPdf(
            title,
            content,
            settings,
            cssText,
            bodyClasses
        );
        retainedPath = retainedPdf.path;
        const pageRanges = validatePageRanges(jobOptions.pageRanges, retainedPdf.pageCount);
        const submission = await submitPdfToSystemPrinter({
            ...jobOptions,
            pageRanges,
            pdfPath: retainedPdf.path,
            title,
            pageCount: retainedPdf.pageCount
        });

        new Notice(t('notice.printSubmitted', {
            count: retainedPdf.pageCount,
            printer: jobOptions.printerName,
            job: submission.jobId,
            path: retainedPdf.path
        }));
        return true;
    } catch (error) {
        console.error('Direct system printing failed:', error);
        if (error instanceof RangeError) {
            new Notice(t('notice.invalidPageRange'));
        } else if (error instanceof PrintPdfDirectoryError) {
            new Notice(t('notice.printDirectoryInvalid', { path: error.path }));
        } else if (error instanceof DirectSystemPrintUnavailableError) {
            new Notice(t('notice.directPrintFallback'));
            return await openPdfInDefaultApp(title, content, settings, cssText, bodyClasses);
        } else {
            new Notice(t('notice.printSubmissionFailed', {
                path: retainedPath ?? t('notice.noRetainedPdf')
            }));
        }
        return false;
    }
}
