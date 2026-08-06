import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type CimuPrintPlugin from '../main';
import { setPrintLanguage, t } from '../i18n';
import { choosePrintHandoffDirectory, getSystemPrintDirectory } from '../printing/printHandoffDirectory';
import { PRINT_FONT_SUGGESTIONS } from '../printing/printFonts';
import { CimuPrintSettings, PrintLanguage } from '../types';

export class CimuPrintSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly owner: CimuPrintPlugin) {
    super(app, owner);
  }

  display(): void {
    const root = this.containerEl;
    root.empty();

    this.dropdown(root, t('settings.language'), t('settings.languageDesc'), 'language', {
      auto: t('language.auto'),
      en: t('language.en'),
      'zh-TW': t('language.zh-TW'),
      'zh-CN': t('language.zh-CN')
    }, async (value) => {
      setPrintLanguage(value as PrintLanguage);
      this.display();
    });

    this.heading(root, t('section.content'));
    this.toggle(root, t('option.extraTitle'), t('option.extraTitleDesc'), 'printTitle', () => this.display());
    if (this.owner.settings.printTitle) {
      this.dropdown(root, t('option.extraTitleSource'), t('option.extraTitleDesc'), 'printedTitleSource', {
        'first-heading': t('option.firstHeading'),
        'file-name': t('option.fileName')
      });
    }
    this.fontPicker(root);
    this.toggle(root, t('option.properties'), t('option.propertiesDesc'), 'printFrontmatter');

    this.heading(root, t('section.pdfNaming'));
    this.dropdown(root, t('option.pdfFilename'), t('settings.nativePdfNameDesc'), 'pdfFilenameSource', {
      'first-heading': t('option.firstHeading'),
      'file-name': t('option.fileName')
    });
    this.toggle(root, t('settings.nativePdfName'), t('settings.nativePdfNameDesc'), 'nativePdfFilename');

    this.heading(root, t('section.output'));
    this.toggle(root, t('settings.memoryPrint'), t('settings.memoryPrintDesc'), 'useInMemoryPrinting');
    this.toggle(
      root,
      t('settings.cleanupTemporaryPdfs'),
      t('settings.cleanupTemporaryPdfsDesc'),
      'cleanupPreviousTemporaryPdfs'
    );
    this.printDirectory(root);

    this.heading(root, t('section.appearance'));
    this.dropdown(root, t('option.appearance'), t('settings.printCenterDesc'), 'printStyleMode', {
      styled: t('option.styled'),
      'plain-markdown': t('option.plain')
    }, () => this.display());
    if (this.owner.settings.printStyleMode === 'plain-markdown') {
      this.text(root, t('settings.fontSize'), t('settings.fontSizeDesc'), 'fontSize');
      (['h1Size', 'h2Size', 'h3Size', 'h4Size', 'h5Size', 'h6Size'] as const)
        .forEach((key, index) => this.text(
          root,
          t('settings.headingSize', { level: index + 1 }),
          t('settings.headingSizeDesc', { level: index + 1 }),
          key
        ));
    }
    this.toggle(root, t('option.noteStyle'), t('option.noteStyleDesc'), 'inheritNoteCssClasses');

    this.heading(root, t('section.layout'));
    this.dropdown(root, t('option.pageSize'), t('option.pageSizeDesc'), 'pageSize', {
      A3: 'A3', A4: 'A4', A5: 'A5', Letter: 'Letter', Legal: 'Legal'
    });
    this.toggle(root, t('option.landscape'), t('option.landscapeDesc'), 'landscape');
    this.number(root, t('option.margin'), t('option.marginDesc'), 'pageMarginMm', 0, 35, 1, 'mm');
    this.number(root, t('option.printScale'), t('option.printScaleDesc'), 'printScalePercent', 25, 200, 5, '%');
    this.toggle(root, t('settings.combineFolder'), t('settings.combineFolderDesc'), 'combineFolderNotes');
    this.toggle(root, t('option.hrBreak'), t('option.hrBreakDesc'), 'hrPageBreaks');

    this.heading(root, t('section.preview'));
    this.toggle(root, t('option.fitPreview'), t('option.fitPreviewDesc'), 'previewFitToWidth');
    this.number(root, t('option.previewZoom'), t('option.previewZoomDesc'), 'previewZoomPercent', 25, 150, 5, '%');
    this.toggle(root, t('option.pageNumbers'), t('option.pageNumbersDesc'), 'previewShowPageNumbers');
    this.number(root, t('settings.refreshDelay'), t('settings.refreshDelayDesc'), 'previewRefreshDelayMs', 50, 1000, 50, 'ms');

    this.heading(root, t('section.advanced'));
    this.toggle(root, t('settings.debug'), t('settings.debugDesc'), 'debugMode');
  }

  private heading(root: HTMLElement, label: string): void {
    new Setting(root).setName(label).setHeading();
  }

  private toggle<K extends BooleanKey>(
    root: HTMLElement,
    name: string,
    description: string,
    key: K,
    after?: () => void | Promise<void>
  ): void {
    new Setting(root).setName(name).setDesc(description).addToggle((control) => control
      .setValue(this.owner.settings[key])
      .onChange(async (value) => {
        this.owner.settings[key] = value;
        await this.owner.saveSettings();
        await after?.();
      }));
  }

  private dropdown<K extends DropdownKey>(
    root: HTMLElement,
    name: string,
    description: string,
    key: K,
    options: Record<string, string>,
    after?: (value: string) => void | Promise<void>
  ): void {
    new Setting(root).setName(name).setDesc(description).addDropdown((control) => {
      Object.entries(options).forEach(([value, label]) => {
        control.addOption(value, label);
      });
      control.setValue(String(this.owner.settings[key]));
      control.onChange(async (value) => {
        this.owner.settings[key] = value as CimuPrintSettings[K];
        await this.owner.saveSettings();
        await after?.(value);
      });
    });
  }

  private text<K extends TextKey>(root: HTMLElement, name: string, description: string, key: K): void {
    new Setting(root).setName(name).setDesc(description).addText((control) => control
      .setValue(this.owner.settings[key])
      .onChange(async (value) => {
        this.owner.settings[key] = value;
        await this.owner.saveSettings();
      }));
  }

  private number<K extends NumberKey>(
    root: HTMLElement,
    name: string,
    description: string,
    key: K,
    minimum: number,
    maximum: number,
    step: number,
    suffix: string
  ): void {
    const setting = new Setting(root).setName(name).setDesc(description);
    setting.addSlider((control) => control
      .setLimits(minimum, maximum, step)
      .setValue(this.owner.settings[key])
      .onChange((value) => void this.storeNumber(key, value, minimum, maximum)));
    setting.addText((control) => {
      control.inputEl.type = 'number';
      control.inputEl.min = String(minimum);
      control.inputEl.max = String(maximum);
      control.inputEl.step = String(step);
      control.setValue(String(this.owner.settings[key]));
      control.onChange((raw) => {
        const value = Number(raw);
        if (Number.isFinite(value)) {
          void this.storeNumber(key, value, minimum, maximum);
        }
      });
    });
    setting.controlEl.createSpan({ cls: 'cimu-print-setting-suffix', text: suffix });
  }

  private async storeNumber<K extends NumberKey>(
    key: K,
    value: number,
    minimum: number,
    maximum: number
  ): Promise<void> {
    this.owner.settings[key] = Math.max(minimum, Math.min(maximum, value));
    await this.owner.saveSettings();
  }

  private fontPicker(root: HTMLElement): void {
    const row = new Setting(root).setName(t('option.printFont')).setDesc(t('option.printFontDesc'));
    row.addText((control) => {
      const listId = 'cimu-print-font-list';
      control.inputEl.setAttribute('list', listId);
      control.setPlaceholder(t('option.fontFollow'));
      control.setValue(this.owner.settings.printFontFamily);
      control.onChange(async (value) => {
        this.owner.settings.printFontFamily = value.trim();
        await this.owner.saveSettings();
      });
      const list = row.controlEl.createEl('datalist');
      list.id = listId;
      PRINT_FONT_SUGGESTIONS.forEach((font) => list.createEl('option', { value: font }));
    });
  }

  private printDirectory(root: HTMLElement): void {
    const configured = this.owner.settings.printHandoffDirectory.trim();
    const effective = configured || getSystemPrintDirectory() || t('settings.systemTempFolder');
    new Setting(root)
      .setName(t('settings.printHandoffDirectory'))
      .setDesc(`${t('settings.printHandoffDirectoryDesc')} ${t('settings.printHandoffCurrent', { path: effective })}`)
      .addButton((button) => button.setButtonText(t('settings.printHandoffChoose')).onClick(async () => {
        try {
          const chosen = await choosePrintHandoffDirectory(configured, t('settings.printFolderPickerTitle'));
          if (chosen) {
            this.owner.settings.printHandoffDirectory = chosen;
            await this.owner.saveSettings();
            this.display();
          }
        } catch (error) {
          console.error('Cimu Print directory picker failed:', error);
          new Notice(t('notice.printDirectoryPickerFailed'));
        }
      }))
      .addButton((button) => button
        .setButtonText(t('settings.printHandoffReset'))
        .setDisabled(!configured)
        .onClick(async () => {
          this.owner.settings.printHandoffDirectory = '';
          await this.owner.saveSettings();
          this.display();
        }));
  }
}

type BooleanKey = {
  [K in keyof CimuPrintSettings]: CimuPrintSettings[K] extends boolean ? K : never
}[keyof CimuPrintSettings];
type NumberKey = {
  [K in keyof CimuPrintSettings]: CimuPrintSettings[K] extends number ? K : never
}[keyof CimuPrintSettings];
type TextKey = 'fontSize' | 'h1Size' | 'h2Size' | 'h3Size' | 'h4Size' | 'h5Size' | 'h6Size';
type DropdownKey = 'language' | 'printedTitleSource' | 'pdfFilenameSource' | 'printStyleMode' | 'pageSize';
