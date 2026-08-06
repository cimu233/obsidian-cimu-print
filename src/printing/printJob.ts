import { CimuPrintSettings } from '../types';
import { createDebugPrintHtml, getResolvedRuntimeTypographyCss, getTargetedRuntimePrintCss } from './styleCapture';
import { openDebugWindow } from './debugWindow';
import { printWithSystemPrinter } from './systemPrint';
import { SystemPrintJobOptions } from './systemPrinters';

export async function executePrintJob(
  title: string,
  content: HTMLElement,
  settings: CimuPrintSettings,
  baseCss: string,
  job: SystemPrintJobOptions,
  bodyClasses: string[] = []
): Promise<boolean> {
  const styled = settings.printStyleMode === 'styled';
  const runtimeCss = styled
    ? getTargetedRuntimePrintCss(content, settings.printFontFamily)
    : getResolvedRuntimeTypographyCss(content, settings.printFontFamily);
  const css = [baseCss, runtimeCss].filter((part) => part.trim()).join('\n');

  if (settings.debugMode) {
    openDebugWindow(createDebugPrintHtml(content, title, bodyClasses, styled), css);
  }

  return printWithSystemPrinter(title, content, settings, css, job, bodyClasses);
}
