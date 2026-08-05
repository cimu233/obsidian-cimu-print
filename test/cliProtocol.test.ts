import { describe, expect, it } from 'vitest';
import {
  inferCliDuplexMode,
  parseCliPrintRequest,
  resolveCliDuplexOption
} from '../src/cli/protocol';
import { SystemPrinterOption } from '../src/printing/systemPrinters';

const cupsDuplexModes: SystemPrinterOption[] = [
  { key: 'Duplex', value: 'None', label: 'Off', isDefault: true },
  { key: 'Duplex', value: 'DuplexNoTumble', label: 'Long edge', isDefault: false },
  { key: 'Duplex', value: 'DuplexTumble', label: 'Short edge', isDefault: false }
];

describe('local CLI protocol', () => {
  it('accepts actual print scale, duplex, and appearance options', () => {
    expect(parseCliPrintRequest({
      file: 'Projects/Test.md',
      printer: 'Office Printer',
      duplex: 'long-edge',
      scale: 75,
      style: 'obsidian',
      copies: 2,
      pages: '1-4'
    })).toEqual({
      file: 'Projects/Test.md',
      printer: 'Office Printer',
      duplex: 'long-edge',
      scale: 75,
      style: 'obsidian',
      copies: 2,
      pages: '1-4'
    });
  });

  it('rejects preview-like or out-of-range scale values', () => {
    expect(() => parseCliPrintRequest({ file: 'Test.md', scale: 24 })).toThrow(RangeError);
    expect(() => parseCliPrintRequest({ file: 'Test.md', scale: 75.5 })).toThrow(RangeError);
    expect(() => parseCliPrintRequest({ file: 'Test.md', style: 'preview' })).toThrow(RangeError);
  });

  it('maps single and two-sided modes to CUPS capability values', () => {
    expect(resolveCliDuplexOption(cupsDuplexModes, 'single')?.value).toBe('None');
    expect(resolveCliDuplexOption(cupsDuplexModes, 'long-edge')?.value).toBe('DuplexNoTumble');
    expect(resolveCliDuplexOption(cupsDuplexModes, 'short-edge')?.value).toBe('DuplexTumble');
    expect(inferCliDuplexMode(cupsDuplexModes[1])).toBe('long-edge');
  });

  it('also maps IPP duplex names used by Linux queues', () => {
    const ipp = [
      { key: 'sides', value: 'one-sided', label: 'Off', isDefault: true },
      { key: 'sides', value: 'two-sided-long-edge', label: 'Long edge', isDefault: false },
      { key: 'sides', value: 'two-sided-short-edge', label: 'Short edge', isDefault: false }
    ];
    expect(resolveCliDuplexOption(ipp, 'single')?.value).toBe('one-sided');
    expect(resolveCliDuplexOption(ipp, 'long-edge')?.value).toBe('two-sided-long-edge');
    expect(resolveCliDuplexOption(ipp, 'short-edge')?.value).toBe('two-sided-short-edge');
  });
});
