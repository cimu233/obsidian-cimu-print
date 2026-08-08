import { Platform } from 'obsidian';
import { CimuPrintSettings } from '../types';
import { sanitizePdfFilename } from './documentTitle';
import { getPdfPageCount } from './pdfPrintPages';
import { getDefaultPrintHandoffDirectory } from './printHandoffDirectory';
import { createPrintPdfData } from './printPdf';

interface FileStatLike {
    isDirectory: () => boolean;
    isFile?: () => boolean;
}

interface NodeFsLike {
    promises: {
        stat: (path: string) => Promise<FileStatLike>;
        writeFile: (
            path: string,
            data: Uint8Array,
            options: { flag: 'wx' }
        ) => Promise<void>;
        mkdir?: (path: string, options: { recursive: true }) => Promise<unknown>;
        lstat?: (path: string) => Promise<FileStatLike>;
        unlink?: (path: string) => Promise<void>;
    };
}

interface NodeOsLike {
    tmpdir: () => string;
}

interface NodePathLike {
    join: (...parts: string[]) => string;
    resolve?: (...parts: string[]) => string;
    dirname?: (path: string) => string;
    extname?: (path: string) => string;
}

interface ElectronCapableWindow extends Window {
    require?: (moduleName: string) => unknown;
}

export interface RetainedPrintPdf {
    path: string;
    pageCount: number;
}

export interface VerifiedPrintPdfData {
    data: Uint8Array;
    pageCount: number;
}

export interface TemporaryPrintPdfCleanupResult {
    removedPaths: string[];
    failedPaths: string[];
}

export class PrintPdfDirectoryError extends Error {
    readonly path: string;

    constructor(path: string) {
        super(`Print PDF directory is unavailable: ${path}`);
        this.name = 'PrintPdfDirectoryError';
        this.path = path;
    }
}

export async function prepareRetainedPrintPdf(
    title: string,
    content: HTMLElement,
    settings: CimuPrintSettings,
    cssText: string,
    bodyClasses: string[] = []
): Promise<RetainedPrintPdf> {
    const requireModule = (window as ElectronCapableWindow).require;
    if (!Platform.isDesktopApp || typeof requireModule !== 'function') {
        throw new Error('Desktop PDF services are unavailable.');
    }

    const fileSystem = requireModule('fs') as NodeFsLike;
    const os = requireModule('os') as NodeOsLike;
    const path = requireModule('path') as NodePathLike;
    if (
        !fileSystem?.promises?.stat ||
        !fileSystem.promises.writeFile ||
        !os?.tmpdir ||
        !path?.join
    ) {
        throw new Error('PDF file services are unavailable.');
    }

    const configuredDirectory = settings.printHandoffDirectory.trim();
    const defaultDirectory = getDefaultPrintHandoffDirectory();
    const outputDirectory = configuredDirectory || defaultDirectory || os.tmpdir();
    if (!configuredDirectory && defaultDirectory) {
        if (!fileSystem.promises.mkdir) {
            throw new Error('PDF directory creation is unavailable.');
        }
        await fileSystem.promises.mkdir(outputDirectory, { recursive: true });
    }
    const directoryStat = await fileSystem.promises.stat(outputDirectory);
    if (!directoryStat.isDirectory()) {
        throw new PrintPdfDirectoryError(outputDirectory);
    }

    const verifiedPdf = await prepareVerifiedPrintPdfData(
        title,
        content,
        settings,
        cssText,
        bodyClasses
    );

    const safeTitle = sanitizePdfFilename(title, 'Untitled');
    const pdfPath = await writePdfWithoutOverwrite(
        fileSystem,
        path,
        outputDirectory,
        safeTitle,
        verifiedPdf.data
    );

    if (!settings.printHandoffDirectory.trim()) {
        const trackedPaths = Array.isArray(settings.temporaryPrintPdfPaths)
            ? settings.temporaryPrintPdfPaths
            : [];
        settings.temporaryPrintPdfPaths = Array.from(new Set([...trackedPaths, pdfPath]));
    }

    return { path: pdfPath, pageCount: verifiedPdf.pageCount };
}

export async function prepareVerifiedPrintPdfData(
    title: string,
    content: HTMLElement,
    settings: CimuPrintSettings,
    cssText: string,
    bodyClasses: string[] = []
): Promise<VerifiedPrintPdfData> {
    const data = await createPrintPdfData(
        title,
        content,
        settings,
        cssText,
        bodyClasses,
        settings.printStyleMode === 'styled'
    );
    const pageCount = await getPdfPageCount(data);
    if (pageCount < 1) {
        throw new Error('Generated PDF has no pages.');
    }
    return { data, pageCount };
}

export async function cleanupTrackedTemporaryPrintPdfs(
    settings: CimuPrintSettings
): Promise<TemporaryPrintPdfCleanupResult> {
    const trackedPaths = Array.isArray(settings.temporaryPrintPdfPaths)
        ? settings.temporaryPrintPdfPaths
        : [];
    const result: TemporaryPrintPdfCleanupResult = { removedPaths: [], failedPaths: [] };
    if (!settings.cleanupPreviousTemporaryPdfs || trackedPaths.length === 0) {
        return result;
    }

    const requireModule = (window as ElectronCapableWindow).require;
    if (!Platform.isDesktopApp || typeof requireModule !== 'function') {
        result.failedPaths.push(...trackedPaths);
        return result;
    }

    const fileSystem = requireModule('fs') as NodeFsLike;
    const os = requireModule('os') as NodeOsLike;
    const path = requireModule('path') as NodePathLike;
    if (
        !fileSystem?.promises?.lstat ||
        !fileSystem.promises.unlink ||
        !os?.tmpdir ||
        !path?.resolve ||
        !path.dirname ||
        !path.extname
    ) {
        result.failedPaths.push(...trackedPaths);
        return result;
    }

    const safeTemporaryDirectories = new Set([
        path.resolve(os.tmpdir()),
        getDefaultPrintHandoffDirectory()
            ? path.resolve(getDefaultPrintHandoffDirectory())
            : ''
    ].filter(Boolean));
    for (const trackedPath of trackedPaths) {
        const candidatePath = path.resolve(trackedPath);
        const isSafeCandidate = safeTemporaryDirectories.has(path.dirname(candidatePath))
            && path.extname(candidatePath).toLowerCase() === '.pdf';
        if (!isSafeCandidate) {
            continue;
        }

        try {
            const stat = await fileSystem.promises.lstat(candidatePath);
            if (!stat.isFile?.()) {
                continue;
            }
            await fileSystem.promises.unlink(candidatePath);
            result.removedPaths.push(candidatePath);
        } catch (error) {
            if ((error as { code?: string }).code === 'ENOENT') {
                continue;
            }
            result.failedPaths.push(candidatePath);
        }
    }

    settings.temporaryPrintPdfPaths = result.failedPaths;
    return result;
}

export async function writePdfWithoutOverwrite(
    fileSystem: NodeFsLike,
    path: NodePathLike,
    outputDirectory: string,
    safeTitle: string,
    pdfData: Uint8Array
): Promise<string> {
    for (let index = 1; index <= 10_000; index += 1) {
        const suffix = index === 1 ? '' : ` (${index})`;
        const candidatePath = path.join(outputDirectory, `${safeTitle}${suffix}.pdf`);

        try {
            await fileSystem.promises.writeFile(candidatePath, pdfData, { flag: 'wx' });
            return candidatePath;
        } catch (error) {
            if ((error as { code?: string }).code !== 'EEXIST') {
                throw error;
            }
        }
    }

    throw new Error('Could not allocate a unique PDF file name.');
}
