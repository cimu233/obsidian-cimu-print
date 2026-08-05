export type DocumentTitleSource = 'first-heading' | 'file-name';
export type PrintPageSize = 'A3' | 'A4' | 'A5' | 'Letter' | 'Legal';
export type PrintStyleMode = 'styled' | 'plain-markdown';
export type PrintLanguage = 'auto' | 'en' | 'zh-TW' | 'zh-CN';

export interface CimuPrintSettings {
  language: PrintLanguage;
  printTitle: boolean;
  printedTitleSource: DocumentTitleSource;
  printFrontmatter: boolean;
  pdfFilenameSource: DocumentTitleSource;
  nativePdfFilename: boolean;
  printHandoffDirectory: string;
  useInMemoryPrinting: boolean;
  cleanupPreviousTemporaryPdfs: boolean;
  temporaryPrintPdfPaths: string[];
  printerName: string;
  printCopies: number;
  printDuplex: string;
  printColor: string;
  printQuality: string;
  printMediaType: string;
  printFontFamily: string;
  fontSize: string;
  h1Size: string;
  h2Size: string;
  h3Size: string;
  h4Size: string;
  h5Size: string;
  h6Size: string;
  combineFolderNotes: boolean;
  hrPageBreaks: boolean;
  debugMode: boolean;
  inheritNoteCssClasses: boolean;
  printStyleMode: PrintStyleMode;
  pageSize: PrintPageSize;
  landscape: boolean;
  pageMarginMm: number;
  printScalePercent: number;
  previewFitToWidth: boolean;
  previewZoomPercent: number;
  previewShowPageNumbers: boolean;
  previewRefreshDelayMs: number;
  legacyMigrationVersion: number;
}

export const DEFAULT_SETTINGS: CimuPrintSettings = {
  language: 'auto',
  printTitle: false,
  printedTitleSource: 'first-heading',
  printFrontmatter: false,
  pdfFilenameSource: 'first-heading',
  nativePdfFilename: true,
  printHandoffDirectory: '',
  useInMemoryPrinting: true,
  cleanupPreviousTemporaryPdfs: false,
  temporaryPrintPdfPaths: [],
  printerName: '',
  printCopies: 1,
  printDuplex: '',
  printColor: '',
  printQuality: '',
  printMediaType: '',
  printFontFamily: '',
  fontSize: '14px',
  h1Size: '20px',
  h2Size: '18px',
  h3Size: '16px',
  h4Size: '14px',
  h5Size: '14px',
  h6Size: '12px',
  combineFolderNotes: false,
  hrPageBreaks: false,
  debugMode: false,
  inheritNoteCssClasses: false,
  printStyleMode: 'styled',
  pageSize: 'A4',
  landscape: false,
  pageMarginMm: 15,
  printScalePercent: 100,
  previewFitToWidth: true,
  previewZoomPercent: 100,
  previewShowPageNumbers: true,
  previewRefreshDelayMs: 200,
  legacyMigrationVersion: 0
};
