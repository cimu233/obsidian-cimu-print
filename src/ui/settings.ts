import {
  App,
  Notice,
  PluginSettingTab,
  Setting,
  SettingDefinitionGroup,
  SettingDefinitionItem,
  SettingDefinitionRender
} from 'obsidian';
import type CimuPrintPlugin from '../main';
import { setPrintLanguage, t } from '../i18n';
import {
  choosePrintHandoffDirectory,
  getDefaultPrintHandoffDirectory
} from '../printing/printHandoffDirectory';
import { PRINT_FONT_SUGGESTIONS } from '../printing/printFonts';
import { CimuPrintSettings, PrintLanguage } from '../types';

export class CimuPrintSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly owner: CimuPrintPlugin) {
    super(app, owner);
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const language = this.definition(
      t('settings.language'),
      t('settings.languageDesc'),
      (setting) => this.configureDropdown(setting, 'language', {
        auto: t('language.auto'),
        en: t('language.en'),
        'zh-TW': t('language.zh-TW'),
        'zh-CN': t('language.zh-CN')
      }, async (value) => {
        setPrintLanguage(value as PrintLanguage);
        this.refreshSettings();
      })
    );

    return [
      language,
      this.group(t('section.content'), [
        this.definition(t('option.extraTitle'), t('option.extraTitleDesc'),
          (setting) => this.configureToggle(setting, 'printTitle', () => this.refreshSettings())),
        {
          ...this.definition(t('option.extraTitleSource'), t('option.extraTitleDesc'),
            (setting) => this.configureDropdown(setting, 'printedTitleSource', {
              'first-heading': t('option.firstHeading'),
              'file-name': t('option.fileName')
            })),
          visible: () => this.owner.settings.printTitle
        },
        this.definition(t('option.printFont'), t('option.printFontDesc'),
          (setting) => this.configureFontPicker(setting)),
        this.definition(t('option.properties'), t('option.propertiesDesc'),
          (setting) => this.configureToggle(setting, 'printFrontmatter'))
      ]),
      this.group(t('section.pdfNaming'), [
        this.definition(t('option.pdfFilename'), t('settings.nativePdfNameDesc'),
          (setting) => this.configureDropdown(setting, 'pdfFilenameSource', {
            'first-heading': t('option.firstHeading'),
            'file-name': t('option.fileName')
          })),
        this.definition(t('settings.nativePdfName'), t('settings.nativePdfNameDesc'),
          (setting) => this.configureToggle(setting, 'nativePdfFilename'))
      ]),
      this.group(t('section.output'), [
        this.definition(t('settings.memoryPrint'), t('settings.memoryPrintDesc'),
          (setting) => this.configureToggle(setting, 'useInMemoryPrinting')),
        this.definition(t('settings.cleanupTemporaryPdfs'), t('settings.cleanupTemporaryPdfsDesc'),
          (setting) => this.configureToggle(setting, 'cleanupPreviousTemporaryPdfs')),
        this.definition(t('settings.printHandoffDirectory'), t('settings.printHandoffDirectoryDesc'),
          (setting) => this.configurePrintDirectory(setting))
      ]),
      this.group(t('section.appearance'), [
        this.definition(t('option.appearance'), t('settings.printCenterDesc'),
          (setting) => this.configureDropdown(setting, 'printStyleMode', {
            styled: t('option.styled'),
            'plain-markdown': t('option.plain')
          }, () => this.refreshSettings())),
        {
          ...this.definition(t('settings.fontSize'), t('settings.fontSizeDesc'),
            (setting) => this.configureText(setting, 'fontSize')),
          visible: () => this.owner.settings.printStyleMode === 'plain-markdown'
        },
        ...(['h1Size', 'h2Size', 'h3Size', 'h4Size', 'h5Size', 'h6Size'] as const).map((key, index) => ({
          ...this.definition(
            t('settings.headingSize', { level: index + 1 }),
            t('settings.headingSizeDesc', { level: index + 1 }),
            (setting) => this.configureText(setting, key)
          ),
          visible: () => this.owner.settings.printStyleMode === 'plain-markdown'
        })),
        this.definition(t('option.noteStyle'), t('option.noteStyleDesc'),
          (setting) => this.configureToggle(setting, 'inheritNoteCssClasses'))
      ]),
      this.group(t('section.layout'), [
        this.definition(t('option.pageSize'), t('option.pageSizeDesc'),
          (setting) => this.configureDropdown(setting, 'pageSize', {
            A3: 'A3', A4: 'A4', A5: 'A5', Letter: 'Letter', Legal: 'Legal'
          })),
        this.definition(t('option.landscape'), t('option.landscapeDesc'),
          (setting) => this.configureToggle(setting, 'landscape')),
        this.definition(t('option.margin'), t('option.marginDesc'),
          (setting) => this.configureNumber(setting, 'pageMarginMm', 0, 35, 1, 'mm')),
        this.definition(t('option.printScale'), t('option.printScaleDesc'),
          (setting) => this.configureNumber(setting, 'printScalePercent', 25, 200, 5, '%')),
        this.definition(t('settings.combineFolder'), t('settings.combineFolderDesc'),
          (setting) => this.configureToggle(setting, 'combineFolderNotes')),
        this.definition(t('option.hrBreak'), t('option.hrBreakDesc'),
          (setting) => this.configureToggle(setting, 'hrPageBreaks'))
      ]),
      this.group(t('section.preview'), [
        this.definition(t('option.fitPreview'), t('option.fitPreviewDesc'),
          (setting) => this.configureToggle(setting, 'previewFitToWidth')),
        this.definition(t('option.previewZoom'), t('option.previewZoomDesc'),
          (setting) => this.configureNumber(setting, 'previewZoomPercent', 25, 150, 5, '%')),
        this.definition(t('option.pageNumbers'), t('option.pageNumbersDesc'),
          (setting) => this.configureToggle(setting, 'previewShowPageNumbers')),
        this.definition(t('settings.refreshDelay'), t('settings.refreshDelayDesc'),
          (setting) => this.configureNumber(setting, 'previewRefreshDelayMs', 50, 1000, 50, 'ms'))
      ]),
      this.group(t('section.advanced'), [
        this.definition(t('settings.debug'), t('settings.debugDesc'),
          (setting) => this.configureToggle(setting, 'debugMode'))
      ])
    ];
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
      this.refreshSettings();
    });

    this.heading(root, t('section.content'));
    this.toggle(root, t('option.extraTitle'), t('option.extraTitleDesc'), 'printTitle', () => this.refreshSettings());
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
    }, () => this.refreshSettings());
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
    this.configureToggle(new Setting(root).setName(name).setDesc(description), key, after);
  }

  private configureToggle<K extends BooleanKey>(
    setting: Setting,
    key: K,
    after?: () => void | Promise<void>
  ): void {
    setting.addToggle((control) => control
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
    this.configureDropdown(new Setting(root).setName(name).setDesc(description), key, options, after);
  }

  private configureDropdown<K extends DropdownKey>(
    setting: Setting,
    key: K,
    options: Record<string, string>,
    after?: (value: string) => void | Promise<void>
  ): void {
    setting.addDropdown((control) => {
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
    this.configureText(new Setting(root).setName(name).setDesc(description), key);
  }

  private configureText<K extends TextKey>(setting: Setting, key: K): void {
    setting.addText((control) => control
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
    this.configureNumber(new Setting(root).setName(name).setDesc(description), key, minimum, maximum, step, suffix);
  }

  private configureNumber<K extends NumberKey>(
    setting: Setting,
    key: K,
    minimum: number,
    maximum: number,
    step: number,
    suffix: string
  ): void {
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
    this.configureFontPicker(new Setting(root).setName(t('option.printFont')).setDesc(t('option.printFontDesc')));
  }

  private configureFontPicker(row: Setting): void {
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
    this.configurePrintDirectory(new Setting(root).setName(t('settings.printHandoffDirectory')));
  }

  private configurePrintDirectory(setting: Setting): void {
    const configured = this.owner.settings.printHandoffDirectory.trim();
    const effective = configured
      || getDefaultPrintHandoffDirectory()
      || t('settings.systemTempFolder');
    setting
      .setName(t('settings.printHandoffDirectory'))
      .setDesc(`${t('settings.printHandoffDirectoryDesc')} ${t('settings.printHandoffCurrent', { path: effective })}`)
      .addButton((button) => button.setButtonText(t('settings.printHandoffChoose')).onClick(async () => {
        try {
          const chosen = await choosePrintHandoffDirectory(configured, t('settings.printFolderPickerTitle'));
          if (chosen) {
            this.owner.settings.printHandoffDirectory = chosen;
            await this.owner.saveSettings();
            this.refreshSettings();
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
          this.refreshSettings();
        }));
  }

  private definition(
    name: string,
    description: string,
    render: (setting: Setting) => void
  ): SettingDefinitionRender {
    return {
      name,
      desc: description,
      render: (setting) => render(setting)
    };
  }

  private group(heading: string, items: SettingDefinitionRender[]): SettingDefinitionGroup {
    return { type: 'group', heading, items };
  }

  private refreshSettings(): void {
    const modernRefresh: unknown = Reflect.get(this, 'update');
    if (typeof modernRefresh === 'function') {
      Reflect.apply(modernRefresh, this, []);
      return;
    }
    const legacyRefresh: unknown = Reflect.get(this, 'display');
    if (typeof legacyRefresh === 'function') {
      Reflect.apply(legacyRefresh, this, []);
    }
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
