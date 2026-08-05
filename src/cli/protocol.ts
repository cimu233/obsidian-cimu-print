import { SystemPrinterOption } from '../printing/systemPrinters';
import { PrintStyleMode } from '../types';

export type CliDuplexMode = 'single' | 'long-edge' | 'short-edge';
export type CliRenderStyle = 'obsidian' | 'plain';

export interface CliPrintRequest {
  file: string;
  printer?: string;
  duplex?: CliDuplexMode;
  scale?: number;
  style?: CliRenderStyle;
  copies?: number;
  pages?: string;
}

export interface CliPrintResult {
  submitted: boolean;
  file: string;
  printer: string;
  duplex: CliDuplexMode | 'printer-default';
  scale: number;
  style: CliRenderStyle;
}

export function parseCliPrintRequest(value: unknown): CliPrintRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('The print request must be a JSON object.');
  }

  const raw = value as Record<string, unknown>;
  const file = requiredString(raw.file, 'file');
  const printer = optionalString(raw.printer, 'printer');
  const duplex = optionalEnum(raw.duplex, 'duplex', ['single', 'long-edge', 'short-edge'] as const);
  const style = optionalEnum(raw.style, 'style', ['obsidian', 'plain'] as const);
  const scale = optionalInteger(raw.scale, 'scale', 25, 200);
  const copies = optionalInteger(raw.copies, 'copies', 1, 999);
  const pages = optionalString(raw.pages, 'pages');

  return {
    file,
    ...(printer ? { printer } : {}),
    ...(duplex ? { duplex } : {}),
    ...(style ? { style } : {}),
    ...(scale !== undefined ? { scale } : {}),
    ...(copies !== undefined ? { copies } : {}),
    ...(pages ? { pages } : {})
  };
}

export function cliStyleToPrintStyle(style: CliRenderStyle | undefined): PrintStyleMode {
  return style === 'plain' ? 'plain-markdown' : 'styled';
}

export function printStyleToCliStyle(style: PrintStyleMode): CliRenderStyle {
  return style === 'plain-markdown' ? 'plain' : 'obsidian';
}

export function resolveCliDuplexOption(
  options: SystemPrinterOption[],
  requested: CliDuplexMode | undefined,
  storedValue = ''
): SystemPrinterOption | undefined {
  if (!requested) {
    return options.find((option) => option.value === storedValue)
      ?? options.find((option) => option.isDefault)
      ?? options[0];
  }

  const aliases: Record<CliDuplexMode, string[]> = {
    single: ['none', 'one-sided', 'onesided', 'simplex'],
    'long-edge': ['duplexnotumble', 'twosidedlongedge', 'longedge'],
    'short-edge': ['duplextumble', 'twosidedshortedge', 'shortedge']
  };
  const expected = aliases[requested].map(normalizeDuplexValue);
  return options.find((option) => {
    const candidates = [option.value, option.label].map(normalizeDuplexValue);
    return candidates.some((candidate) => expected.includes(candidate));
  });
}

export function inferCliDuplexMode(option: SystemPrinterOption | undefined): CliDuplexMode | 'printer-default' {
  if (!option) {
    return 'printer-default';
  }
  for (const mode of ['single', 'long-edge', 'short-edge'] as const) {
    if (resolveCliDuplexOption([option], mode)) {
      return mode;
    }
  }
  return 'printer-default';
}

function normalizeDuplexValue(value: string): string {
  return value.toLowerCase().replace(/[\s_.-]+/g, '');
}

function requiredString(value: unknown, name: string): string {
  const parsed = optionalString(value, name);
  if (!parsed) {
    throw new TypeError(`${name} is required.`);
  }
  return parsed;
}

function optionalString(value: unknown, name: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${name} must be a non-empty string.`);
  }
  return value.trim();
}

function optionalInteger(
  value: unknown,
  name: string,
  minimum: number,
  maximum: number
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new RangeError(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return value as number;
}

function optionalEnum<T extends string>(
  value: unknown,
  name: string,
  allowed: readonly T[]
): T | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new RangeError(`${name} must be one of: ${allowed.join(', ')}.`);
  }
  return value as T;
}
