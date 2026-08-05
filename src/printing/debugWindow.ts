import { Notice, Platform } from 'obsidian';
import { t } from '../i18n';

interface DebugWindow {
  loadURL: (url: string) => Promise<void> | void;
  show: () => void;
}

interface ElectronWindow extends Window {
  require?: (moduleName: string) => {
    remote?: { BrowserWindow?: new (options: Record<string, unknown>) => DebugWindow };
  };
}

export function openDebugWindow(html: string): void {
  if (!Platform.isDesktopApp) {
    new Notice(t('notice.debugDesktopOnly'));
    return;
  }

  try {
    const BrowserWindow = (window as ElectronWindow)
      .require?.('electron')
      ?.remote
      ?.BrowserWindow;
    if (!BrowserWindow) {
      throw new Error('BrowserWindow is unavailable.');
    }
    const debugWindow = new BrowserWindow({
      width: 980,
      height: 760,
      show: false,
      webPreferences: { contextIsolation: true, sandbox: true }
    });
    void Promise.resolve(debugWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
    )).then(() => debugWindow.show());
  } catch (error) {
    console.error('Cimu Print debug window failed:', error);
    new Notice(t('notice.debugFailed'));
  }
}
