import { DocumentTitleSource } from '../types';

const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const MAX_FILENAME_LENGTH = 180;

export function extractFirstHeading(markdown: string): string | null {
    const lines = markdown.replace(/^\uFEFF/, '').split(/\r?\n/);
    let lineIndex = 0;
    let fence: { marker: string; length: number } | null = null;

    if (lines[0]?.trim() === '---') {
        lineIndex = 1;
        while (lineIndex < lines.length && lines[lineIndex]?.trim() !== '---') {
            lineIndex += 1;
        }
        lineIndex = Math.min(lineIndex + 1, lines.length);
    }

    for (; lineIndex < lines.length; lineIndex += 1) {
        const line = lines[lineIndex] ?? '';
        const fenceMatch = line.match(/^\s{0,3}(`{3,}|~{3,})/);

        if (fenceMatch) {
            const markerText = fenceMatch[1];
            const marker = markerText[0];

            if (!fence) {
                fence = { marker, length: markerText.length };
            } else if (marker === fence.marker && markerText.length >= fence.length) {
                fence = null;
            }
            continue;
        }

        if (fence) {
            continue;
        }

        const atxMatch = line.match(/^\s{0,3}#(?!#)\s+(.+?)\s*#*\s*$/);
        if (atxMatch?.[1]) {
            const title = cleanHeadingText(atxMatch[1]);
            return title || null;
        }

        const nextLine = lines[lineIndex + 1] ?? '';
        if (line.trim() && /^\s{0,3}=+\s*$/.test(nextLine)) {
            const title = cleanHeadingText(line);
            return title || null;
        }
    }

    return null;
}

export function resolveDocumentTitle(
    markdown: string,
    fileBasename: string,
    source: DocumentTitleSource
): string {
    if (source === 'file-name') {
        return fileBasename;
    }

    return extractFirstHeading(markdown) ?? fileBasename;
}

export function sanitizePdfFilename(title: string, fallback: string): string {
    const replacements: Record<string, string> = {
        '<': '＜',
        '>': '＞',
        ':': '：',
        '"': '”',
        '/': '／',
        '\\': '＼',
        '|': '｜',
        '?': '？',
        '*': '＊'
    };

    const cleaned = Array.from(title.normalize('NFC'))
        .map((character) => replacements[character] ?? character)
        .join('')
        .replace(/[\u0000-\u001F\u007F]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[. ]+$/g, '');

    let safeTitle = cleaned || fallback.trim() || 'Untitled';
    if (WINDOWS_RESERVED_NAMES.test(safeTitle)) {
        safeTitle = `_${safeTitle}`;
    }

    return Array.from(safeTitle).slice(0, MAX_FILENAME_LENGTH).join('').replace(/[. ]+$/g, '');
}

function cleanHeadingText(value: string): string {
    return value
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
        .replace(/\[\[([^\]]+)\]\]/g, '$1')
        .replace(/<[^>]+>/g, '')
        .replace(/[`*_~]/g, '')
        .replace(/\\([#\[\]()`*_{}<>])/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
}
