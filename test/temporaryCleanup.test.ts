import { posix as path } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/types';

vi.mock('../src/printing/pdfPrintPages', () => ({ getPdfPageCount: vi.fn() }));
vi.mock('../src/printing/printPdf', () => ({ createPrintPdfData: vi.fn() }));

import { cleanupTrackedTemporaryPrintPdfs } from '../src/printing/retainedPrintPdf';

describe('temporary PDF cleanup', () => {
  it('deletes only tracked regular PDFs in the system temporary root', async () => {
    const unlink = vi.fn(async () => undefined);
    (window as Window & { require?: (name: string) => unknown }).require = (name) => ({
      fs: { promises: { lstat: async () => ({ isFile: () => true }), unlink } },
      os: { tmpdir: () => '/tmp' },
      path
    })[name as 'fs' | 'os' | 'path'];
    const settings = {
      ...DEFAULT_SETTINGS,
      cleanupPreviousTemporaryPdfs: true,
      temporaryPrintPdfPaths: ['/tmp/old.pdf', '/chosen/keep.pdf', '/tmp/ignore.txt']
    };

    const result = await cleanupTrackedTemporaryPrintPdfs(settings);

    expect(result.removedPaths).toEqual(['/tmp/old.pdf']);
    expect(unlink).toHaveBeenCalledWith('/tmp/old.pdf');
    expect(settings.temporaryPrintPdfPaths).toEqual([]);
  });
});
