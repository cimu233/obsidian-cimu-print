import { describe, expect, it } from 'vitest';
import { buildPrintToPdfOptions } from '../src/printing/printPdf';
import { DEFAULT_SETTINGS } from '../src/types';

describe('buildPrintToPdfOptions', () => {
  it('maps 75 percent to the same PDF-layer values as Obsidian export', () => {
    const options = buildPrintToPdfOptions({
      ...DEFAULT_SETTINGS,
      printScalePercent: 75
    });

    expect(options.scaleFactor).toBe(75);
    expect(options.scale).toBe(0.75);
  });

  it('clamps scale values to the supported PDF range', () => {
    expect(buildPrintToPdfOptions({
      ...DEFAULT_SETTINGS,
      printScalePercent: 5
    }).scale).toBe(0.1);
    expect(buildPrintToPdfOptions({
      ...DEFAULT_SETTINGS,
      printScalePercent: 250
    }).scale).toBe(2);
  });
});
