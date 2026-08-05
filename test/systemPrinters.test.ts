import { describe, expect, it } from 'vitest';
import { buildCupsPrintArguments, validatePageRanges } from '../src/printing/systemPrinters';

describe('system printer arguments', () => {
  it('keeps printer names as argv values and supports stdin submission', () => {
    expect(buildCupsPrintArguments({
      printerName: 'Office Printer; touch bad',
      title: 'Four pages',
      copies: 2,
      pageRanges: '1-4',
      pageCount: 4,
      duplex: { key: 'Duplex', value: 'DuplexNoTumble', label: 'Long edge', isDefault: true }
    })).toEqual([
      '-d', 'Office Printer; touch bad',
      '-t', 'Four pages',
      '-n', '2',
      '-o', 'page-ranges=1-4',
      '-o', 'Duplex=DuplexNoTumble'
    ]);
  });

  it('rejects page ranges outside the generated PDF', () => {
    expect(validatePageRanges('1-3,4', 4)).toBe('1-3,4');
    expect(() => validatePageRanges('1-5', 4)).toThrow(RangeError);
    expect(() => validatePageRanges('4-2', 4)).toThrow(RangeError);
  });
});
