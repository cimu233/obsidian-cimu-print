import { posix as path } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/types';

vi.mock('../src/printing/pdfPrintPages', () => ({ getPdfPageCount: vi.fn() }));
vi.mock('../src/printing/printPdf', () => ({ createPrintPdfData: vi.fn() }));

import { setDefaultPrintHandoffDirectory } from '../src/printing/printHandoffDirectory';
import {
  cleanupTrackedTemporaryPrintPdfs,
  prepareRetainedPrintPdf
} from '../src/printing/retainedPrintPdf';

afterEach(() => {
  setDefaultPrintHandoffDirectory('');
});

describe('temporary PDF cleanup', () => {
  it('deletes tracked PDFs in the vault default and legacy system temporary roots', async () => {
    const unlink = vi.fn(async () => undefined);
    setDefaultPrintHandoffDirectory('/vault/.obsidian/plugins/cimu-print/.temp');
    (window as Window & { require?: (name: string) => unknown }).require = (name) => ({
      fs: { promises: { lstat: async () => ({ isFile: () => true }), unlink } },
      os: { tmpdir: () => '/tmp' },
      path
    })[name as 'fs' | 'os' | 'path'];
    const settings = {
      ...DEFAULT_SETTINGS,
      cleanupPreviousTemporaryPdfs: true,
      temporaryPrintPdfPaths: [
        '/vault/.obsidian/plugins/cimu-print/.temp/recent.pdf',
        '/tmp/old.pdf',
        '/chosen/keep.pdf',
        '/tmp/ignore.txt'
      ]
    };

    const result = await cleanupTrackedTemporaryPrintPdfs(settings);

    expect(result.removedPaths).toEqual([
      '/vault/.obsidian/plugins/cimu-print/.temp/recent.pdf',
      '/tmp/old.pdf'
    ]);
    expect(unlink).toHaveBeenCalledWith('/vault/.obsidian/plugins/cimu-print/.temp/recent.pdf');
    expect(unlink).toHaveBeenCalledWith('/tmp/old.pdf');
    expect(settings.temporaryPrintPdfPaths).toEqual([]);
  });

  it('creates and writes to the vault default directory when no custom folder is set', async () => {
    const mkdir = vi.fn(async () => undefined);
    const writeFile = vi.fn(async () => undefined);
    setDefaultPrintHandoffDirectory('/vault/.obsidian/plugins/cimu-print/.temp');
    (window as Window & { require?: (name: string) => unknown }).require = (name) => ({
      fs: {
        promises: {
          mkdir,
          stat: async () => ({ isDirectory: () => true }),
          writeFile
        }
      },
      os: { tmpdir: () => '/tmp' },
      path
    })[name as 'fs' | 'os' | 'path'];
    const { createPrintPdfData } = await import('../src/printing/printPdf');
    const { getPdfPageCount } = await import('../src/printing/pdfPrintPages');
    vi.mocked(createPrintPdfData).mockResolvedValue(new Uint8Array([1, 2, 3]));
    vi.mocked(getPdfPageCount).mockResolvedValue(4);
    const settings = { ...DEFAULT_SETTINGS, temporaryPrintPdfPaths: [] };

    const result = await prepareRetainedPrintPdf(
      'Known four-page document',
      document.createElement('main'),
      settings,
      ''
    );

    expect(mkdir).toHaveBeenCalledWith(
      '/vault/.obsidian/plugins/cimu-print/.temp',
      { recursive: true }
    );
    expect(writeFile).toHaveBeenCalledWith(
      '/vault/.obsidian/plugins/cimu-print/.temp/Known four-page document.pdf',
      new Uint8Array([1, 2, 3]),
      { flag: 'wx' }
    );
    expect(result).toEqual({
      path: '/vault/.obsidian/plugins/cimu-print/.temp/Known four-page document.pdf',
      pageCount: 4
    });
    expect(settings.temporaryPrintPdfPaths).toEqual([
      '/vault/.obsidian/plugins/cimu-print/.temp/Known four-page document.pdf'
    ]);
  });
});
