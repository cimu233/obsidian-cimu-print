import { MarkdownView, Notice, Plugin, TFile, TFolder } from 'obsidian';
import { resolveActiveNoteFolder } from './content/activeFolder';
import { renderMarkdownSource } from './content/markdownSource';
import { readNoteAppearanceClasses } from './content/noteAppearance';
import { capturePrintableView } from './content/viewSource';
import { setPrintLanguage, t } from './i18n';
import { migrateLegacyPrintState } from './migration';
import { resolveDocumentTitle, sanitizePdfFilename } from './printing/documentTitle';
import { executePrintJob } from './printing/printJob';
import { exportPrintPdf } from './printing/exportPdf';
import { generatePrintStyles } from './printing/printStyles';
import { installNativePdfFilenameHook } from './printing/nativePdfFilename';
import { CimuPrintSettings, DEFAULT_SETTINGS, DocumentTitleSource } from './types';
import { PrintCenterDocument, PrintCenterModal } from './ui/printCenter';
import { CimuPrintSettingTab } from './ui/settings';

const titleSorter = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
  ignorePunctuation: true
});

interface PrintableContent {
  content: HTMLElement;
  bodyClasses?: string[];
}

interface FileView {
  containerEl?: HTMLElement;
  file?: TFile | null;
}

export default class CimuPrintPlugin extends Plugin {
  settings: CimuPrintSettings = { ...DEFAULT_SETTINGS, temporaryPrintPdfPaths: [] };
  private removeNativeDialogHook: (() => void) | null = null;

  async onload(): Promise<void> {
    const stored = await this.loadData() as Partial<CimuPrintSettings> | null;
    this.settings = mergeSettings(stored);
    const migration = await migrateLegacyPrintState(
      this.app,
      this.settings,
      !stored || Object.keys(stored).length === 0
    );
    await this.saveSettings();
    setPrintLanguage(this.settings.language);

    this.registerCommands();
    this.registerMenus();
    this.addSettingTab(new CimuPrintSettingTab(this.app, this));
    this.addRibbonIcon('printer', t('command.printNote'), () => void this.printCurrentNote());
    this.removeNativeDialogHook = installNativePdfFilenameHook(this.app, () => this.settings);

    if (migration.hotkeysMoved > 0) {
      console.info(`Cimu Print migrated ${migration.hotkeysMoved} shortcut entries.`);
    }
  }

  onunload(): void {
    this.removeNativeDialogHook?.();
    this.removeNativeDialogHook = null;
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async printCurrentNote(requestedFile?: TFile): Promise<void> {
    const file = await this.resolveFile(requestedFile);
    if (!file) {
      new Notice(t('notice.noNote'));
      return;
    }

    await this.openCenter(async () => {
      const markdown = file.extension === 'md' ? await this.readMarkdown(file) : '';
      const printable = await this.createFileContent(file, markdown);
      if (!printable) {
        return null;
      }
      return {
        title: sanitizePdfFilename(this.titleFor(markdown, file, this.settings.pdfFilenameSource), file.basename),
        ...printable
      };
    });
  }

  async printSelection(): Promise<void> {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) {
      new Notice(t('notice.noActiveNote'));
      return;
    }
    const selection = view.editor.getSelection();
    if (!selection) {
      new Notice(t('notice.noSelection'));
      return;
    }

    await this.openCenter(async () => {
      const content = await renderMarkdownSource(selection, false, this.app, false, view.file ?? undefined);
      if (!content) {
        return null;
      }
      const baseTitle = view.file
        ? this.titleFor(view.editor.getValue(), view.file, this.settings.pdfFilenameSource)
        : 'Selection';
      return {
        title: sanitizePdfFilename(`${baseTitle}-${t('filename.selectionSuffix')}`, 'Selection'),
        content,
        bodyClasses: this.attachNoteClasses(content, view.file)
      };
    });
  }

  async printFolder(requestedFolder?: TFolder): Promise<void> {
    if (!requestedFolder) {
      await this.saveActiveEditor();
    }
    const folder = requestedFolder ?? resolveActiveNoteFolder(this.app);
    if (!folder) {
      new Notice(t('notice.noFolder'));
      return;
    }
    const files = folder.children
      .filter((child): child is TFile => child instanceof TFile && child.extension === 'md')
      .sort((left, right) => this.compareFolderFiles(folder, left, right));
    if (files.length === 0) {
      new Notice(t('notice.noMarkdown'));
      return;
    }

    await this.openCenter(async () => ({
      title: sanitizePdfFilename(folder.name, 'Folder'),
      content: await this.createFolderContent(files)
    }));
  }

  private registerCommands(): void {
    const commands = [
      { id: 'print-note', name: t('command.currentNote'), run: () => this.printCurrentNote() },
      { id: 'print-selection', name: t('command.selection'), run: () => this.printSelection() },
      { id: 'print-folder-notes', name: t('command.folder'), run: () => this.printFolder() }
    ];
    commands.forEach((command) => this.addCommand({
      id: command.id,
      name: command.name,
      callback: () => void command.run()
    }));
  }

  private registerMenus(): void {
    this.registerEvent(this.app.workspace.on('file-menu', (menu, target) => {
      menu.addItem((item) => item
        .setTitle(target instanceof TFile ? t('command.printNote') : t('command.printFolder'))
        .setIcon('printer')
        .onClick(() => target instanceof TFile
          ? void this.printCurrentNote(target)
          : void this.printFolder(target as TFolder)));
    }));
    this.registerEvent(this.app.workspace.on('editor-menu', (menu) => {
      menu.addItem((item) => item.setTitle(t('command.printNote')).setIcon('printer')
        .onClick(() => void this.printCurrentNote()));
      menu.addItem((item) => item.setTitle(t('command.selection')).setIcon('printer')
        .onClick(() => void this.printSelection()));
    }));
  }

  private async openCenter(factory: () => Promise<PrintCenterDocument | null>): Promise<void> {
    const initial = await factory();
    if (!initial) {
      return;
    }
    new PrintCenterModal(
      this.app,
      this,
      factory,
      async (document, target, job) => {
        const css = await generatePrintStyles(this.app, this.manifest, this.settings);
        if (target === 'pdf') {
          return exportPrintPdf(document.title, document.content, this.settings, css, document.bodyClasses);
        }
        if (!job) {
          return false;
        }
        try {
          return await executePrintJob(
            document.title,
            document.content,
            this.settings,
            css,
            job,
            document.bodyClasses
          );
        } finally {
          await this.saveSettings();
        }
      },
      initial
    ).open();
  }

  private async createFileContent(file: TFile, markdown = ''): Promise<PrintableContent | null> {
    if (file.extension !== 'md') {
      const view = this.activeFileView();
      if (!view || view.file !== file) {
        new Notice(t('notice.openFile'));
        return null;
      }
      const content = capturePrintableView(
        view,
        [],
        this.settings.printTitle ? file.basename : undefined
      );
      return content ? { content } : null;
    }

    const source = markdown || await this.readMarkdown(file);
    const title = this.settings.printTitle
      ? this.titleFor(source, file, this.settings.printedTitleSource)
      : false;
    const content = await renderMarkdownSource(
      file,
      title,
      this.app,
      this.settings.printFrontmatter
    );
    return content ? { content, bodyClasses: this.attachNoteClasses(content, file) } : null;
  }

  private async createFolderContent(files: TFile[]): Promise<HTMLElement> {
    const container = document.createElement('div');
    for (const file of files) {
      const printable = await this.createFileContent(file);
      if (!printable) {
        continue;
      }
      if (!this.settings.combineFolderNotes) {
        printable.content.classList.add('cimu-print-page-break');
      }
      container.appendChild(printable.content);
    }
    return container;
  }

  private attachNoteClasses(content: HTMLElement, file?: TFile | null): string[] {
    if (!this.settings.inheritNoteCssClasses || !file) {
      return [];
    }
    const classes = readNoteAppearanceClasses(this.app, file);
    content.classList.add(...classes);
    return classes;
  }

  private titleFor(markdown: string, file: TFile, source: DocumentTitleSource): string {
    return resolveDocumentTitle(markdown, file.basename, source);
  }

  private async resolveFile(requested?: TFile): Promise<TFile | null> {
    const active = this.app.workspace.getActiveFile();
    if (!requested || requested === active) {
      await this.saveActiveEditor();
      return this.app.workspace.getActiveFile();
    }
    return requested;
  }

  private async saveActiveEditor(): Promise<void> {
    await this.app.workspace.getActiveViewOfType(MarkdownView)?.save();
  }

  private async readMarkdown(file: TFile): Promise<string> {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view?.file === file) {
      return view.editor.getValue();
    }
    try {
      return await this.app.vault.cachedRead(file);
    } catch (error) {
      console.warn(`Cimu Print could not read ${file.path}:`, error);
      return '';
    }
  }

  private activeFileView(): FileView | null {
    const workspace = this.app.workspace as typeof this.app.workspace & {
      getActiveFileView?: () => FileView | null;
      activeLeaf?: { view?: FileView };
    };
    return workspace.getActiveFileView?.() ?? workspace.activeLeaf?.view ?? null;
  }

  private compareFolderFiles(folder: TFolder, left: TFile, right: TFile): number {
    const leftIndex = titleSorter.compare(left.basename, folder.name) === 0;
    const rightIndex = titleSorter.compare(right.basename, folder.name) === 0;
    if (leftIndex !== rightIndex) {
      return leftIndex ? -1 : 1;
    }
    return titleSorter.compare(left.basename, right.basename)
      || titleSorter.compare(left.path, right.path);
  }
}

function mergeSettings(stored: Partial<CimuPrintSettings> | null): CimuPrintSettings {
  const legacy = stored as Partial<CimuPrintSettings> & {
    extraClasses?: boolean;
    normalizeStyle?: boolean;
  } | null;
  const merged = {
    ...DEFAULT_SETTINGS,
    ...stored,
    temporaryPrintPdfPaths: Array.isArray(stored?.temporaryPrintPdfPaths)
      ? [...stored.temporaryPrintPdfPaths]
      : []
  };
  if (stored?.inheritNoteCssClasses === undefined && typeof legacy?.extraClasses === 'boolean') {
    merged.inheritNoteCssClasses = legacy.extraClasses;
  }
  if (stored?.printStyleMode === undefined && typeof legacy?.normalizeStyle === 'boolean') {
    merged.printStyleMode = legacy.normalizeStyle ? 'plain-markdown' : 'styled';
  }
  return merged;
}
