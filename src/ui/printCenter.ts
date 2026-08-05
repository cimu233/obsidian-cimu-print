import { App, EventRef, Modal, setIcon } from 'obsidian';
import type CimuPrintPlugin from '../main';
import { CimuPrintSettings } from '../types';
import { generatePrintStyles } from '../printing/printStyles';
import {
    getResolvedRuntimeTypographyCss,
    getTargetedRuntimePrintCss
} from '../printing/styleCapture';
import {
    clearPrintPreview,
    hasPrintPreview,
    renderEmptyPrintPreview,
    renderPrintPreview
} from '../printing/renderPrintPreview';
import { t } from '../i18n';
import { PRINT_FONT_SUGGESTIONS } from '../printing/printFonts';
import {
    getSystemPrinterCapabilities,
    listSystemPrinters,
    supportsDirectSystemPrint,
    SystemPrinterCapabilities,
    SystemPrinterOption,
    SystemPrintJobOptions
} from '../printing/systemPrinters';

export interface PrintCenterDocument {
    title: string;
    content: HTMLElement;
    bodyClasses?: string[];
}

type PrintCenterDocumentFactory = () => Promise<PrintCenterDocument | null>;
type PrintCenterOutputTarget = 'system-printer' | 'pdf';
type PrintCenterPrintHandler = (
    document: PrintCenterDocument,
    target: PrintCenterOutputTarget,
    jobOptions?: SystemPrintJobOptions
) => Promise<boolean | void>;

export class PrintCenterModal extends Modal {
    private readonly plugin: CimuPrintPlugin;
    private readonly documentFactory: PrintCenterDocumentFactory;
    private readonly printHandler: PrintCenterPrintHandler;
    private initialDocument: PrintCenterDocument | null;
    private frameEl: HTMLIFrameElement | null = null;
    private statusEl: HTMLElement | null = null;
    private filenameEl: HTMLElement | null = null;
    private exportButtonEl: HTMLButtonElement | null = null;
    private printButtonEl: HTMLButtonElement | null = null;
    private renderTimer: number | null = null;
    private renderGeneration = 0;
    private resizeObserver: ResizeObserver | null = null;
    private editorChangeRef: EventRef | null = null;
    private isPrinting = false;
    private printerSelectEl: HTMLSelectElement | null = null;
    private printerStatusEl: HTMLElement | null = null;
    private pageRangeEl: HTMLInputElement | null = null;
    private duplexSelectEl: HTMLSelectElement | null = null;
    private colorSelectEl: HTMLSelectElement | null = null;
    private qualitySelectEl: HTMLSelectElement | null = null;
    private mediaTypeSelectEl: HTMLSelectElement | null = null;
    private printerCapabilities: SystemPrinterCapabilities | null = null;
    private printerReady = false;

    constructor(
        app: App,
        plugin: CimuPrintPlugin,
        documentFactory: PrintCenterDocumentFactory,
        printHandler: PrintCenterPrintHandler,
        initialDocument: PrintCenterDocument
    ) {
        super(app);
        this.plugin = plugin;
        this.documentFactory = documentFactory;
        this.printHandler = printHandler;
        this.initialDocument = initialDocument;
    }

    onOpen(): void {
        this.modalEl.addClass('cimu-print-center-modal');
        this.contentEl.empty();
        this.contentEl.addClass('cimu-print-center');

        const header = this.contentEl.createDiv({ cls: 'cimu-print-center-header' });
        const headingGroup = header.createDiv({ cls: 'cimu-print-center-heading-group' });
        headingGroup.createEl('h2', { text: t('center.title') });
        this.filenameEl = headingGroup.createDiv({ cls: 'cimu-print-center-filename', text: t('center.preparingFilename') });

        const headerActions = header.createDiv({ cls: 'cimu-print-center-header-actions' });
        const refreshButton = headerActions.createEl('button', {
            cls: 'clickable-icon',
            attr: { 'aria-label': t('center.refresh') }
        });
        setIcon(refreshButton, 'refresh-cw');
        refreshButton.addEventListener('click', () => this.requestRender(true));

        const body = this.contentEl.createDiv({ cls: 'cimu-print-center-body' });
        const options = body.createDiv({ cls: 'cimu-print-center-options' });
        this.buildOptions(options);

        const preview = body.createDiv({ cls: 'cimu-print-center-preview' });
        const previewBar = preview.createDiv({ cls: 'cimu-print-center-preview-bar' });
        previewBar.createSpan({ text: t('center.preview') });
        this.statusEl = previewBar.createSpan({ cls: 'cimu-print-center-status', text: t('center.layout') });
        this.frameEl = preview.createEl('iframe', {
            cls: 'cimu-print-center-frame',
            attr: { title: t('center.preview') }
        });

        const footer = this.contentEl.createDiv({ cls: 'cimu-print-center-footer' });
        const cancelButton = footer.createEl('button', { text: t('center.cancel') });
        cancelButton.addEventListener('click', () => this.close());
        this.exportButtonEl = footer.createEl('button', { text: t('center.exportPdf') });
        this.exportButtonEl.addEventListener('click', () => void this.output('pdf'));
        this.printButtonEl = footer.createEl('button', { cls: 'mod-cta', text: t('center.systemPrint') });
        this.printButtonEl.disabled = true;
        this.printButtonEl.addEventListener('click', () => void this.output('system-printer'));

        this.editorChangeRef = this.app.workspace.on('editor-change', () => this.requestRender());
        this.resizeObserver = new ResizeObserver(() => {
            if (this.plugin.settings.previewFitToWidth) {
                this.requestRender();
            }
        });
        this.resizeObserver.observe(preview);
        this.requestRender(true);
        void this.loadPrinters();
    }

    onClose(): void {
        this.renderGeneration += 1;
        if (this.renderTimer !== null) {
            window.clearTimeout(this.renderTimer);
            this.renderTimer = null;
        }
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        if (this.editorChangeRef) {
            this.app.workspace.offref(this.editorChangeRef);
            this.editorChangeRef = null;
        }
        clearPrintPreview(this.frameEl);
        this.frameEl = null;
        this.statusEl = null;
        this.filenameEl = null;
        this.exportButtonEl = null;
        this.printButtonEl = null;
        this.printerSelectEl = null;
        this.printerStatusEl = null;
        this.pageRangeEl = null;
        this.duplexSelectEl = null;
        this.colorSelectEl = null;
        this.qualitySelectEl = null;
        this.mediaTypeSelectEl = null;
        this.printerCapabilities = null;
        this.contentEl.empty();
    }

    private buildOptions(container: HTMLElement): void {
        this.addSection(container, t('section.printer'));
        this.buildPrinterOptions(container);

        this.addSection(container, t('section.content'));
        this.addToggle(container, t('option.extraTitle'), t('option.extraTitleDesc'), 'printTitle');
        this.addSelect(
            container,
            t('option.extraTitleSource'),
            'printedTitleSource',
            { 'first-heading': t('option.firstHeading'), 'file-name': t('option.fileName') },
            () => this.plugin.settings.printTitle
        );
        this.addToggle(container, t('option.properties'), t('option.propertiesDesc'), 'printFrontmatter');

        this.addSection(container, t('section.filename'));
        this.addSelect(
            container,
            t('option.pdfFilename'),
            'pdfFilenameSource',
            { 'first-heading': t('option.firstHeading'), 'file-name': t('option.fileName') }
        );

        this.addSection(container, t('section.page'));
        this.addSelect(
            container,
            t('option.pageSize'),
            'pageSize',
            { A3: 'A3', A4: 'A4', A5: 'A5', Letter: 'Letter', Legal: 'Legal' }
        );
        this.addToggle(container, t('option.landscape'), t('option.landscapeDesc'), 'landscape');
        this.addRange(container, t('option.margin'), 'pageMarginMm', 0, 35, 1, ' mm');
        this.addRange(container, t('option.printScale'), 'printScalePercent', 25, 200, 5, '%');

        this.addSection(container, t('section.appearance'));
        this.addSelect(
            container,
            t('option.appearance'),
            'printStyleMode',
            {
                styled: t('option.styled'),
                'plain-markdown': t('option.plain')
            }
        );
        this.addFontChoice(container);
        this.addToggle(container, t('option.noteStyle'), t('option.noteStyleDesc'), 'inheritNoteCssClasses');
        this.addToggle(container, t('option.hrBreak'), t('option.hrBreakDesc'), 'hrPageBreaks');

        this.addSection(container, t('section.preview'));
        this.addToggle(container, t('option.fitPreview'), t('option.fitPreviewDesc'), 'previewFitToWidth');
        this.addRange(
            container,
            t('option.previewZoom'),
            'previewZoomPercent',
            25,
            150,
            5,
            '%'
        );
        this.addToggle(container, t('option.pageNumbers'), t('option.pageNumbersDesc'), 'previewShowPageNumbers');
    }

    private buildPrinterOptions(container: HTMLElement): void {
        const printerRow = this.createOptionRow(container, t('option.printer'));
        this.printerSelectEl = printerRow.createEl('select');
        this.printerSelectEl.disabled = true;
        this.printerSelectEl.createEl('option', { value: '', text: t('printer.loading') });
        this.printerSelectEl.addEventListener('change', () => {
            if (!this.printerSelectEl) {
                return;
            }
            this.plugin.settings.printerName = this.printerSelectEl.value;
            void this.plugin.saveSettings();
            void this.loadPrinterCapabilities(this.printerSelectEl.value);
        });

        const rangeRow = this.createOptionRow(
            container,
            t('option.pageRange'),
            t('option.pageRangeDesc')
        );
        this.pageRangeEl = rangeRow.createEl('input', {
            type: 'text',
            cls: 'cimu-print-center-text-input',
            attr: {
                placeholder: t('option.allPages'),
                'aria-label': t('option.pageRange')
            }
        });

        const copiesRow = this.createOptionRow(container, t('option.copies'));
        const copiesInput = copiesRow.createEl('input', {
            type: 'number',
            cls: 'cimu-print-center-number-input',
            attr: { 'aria-label': t('option.copies') }
        });
        copiesInput.min = '1';
        copiesInput.max = '999';
        copiesInput.step = '1';
        copiesInput.value = String(this.plugin.settings.printCopies);
        const commitCopies = () => {
            const parsed = Math.trunc(Number(copiesInput.value));
            const value = Math.max(1, Math.min(999, Number.isFinite(parsed) ? parsed : 1));
            copiesInput.value = String(value);
            this.plugin.settings.printCopies = value;
            void this.plugin.saveSettings();
        };
        copiesInput.addEventListener('change', commitCopies);
        copiesInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                commitCopies();
                copiesInput.blur();
            }
        });

        this.duplexSelectEl = this.addCapabilitySelect(container, t('option.duplex'));
        this.colorSelectEl = this.addCapabilitySelect(container, t('option.color'));
        this.qualitySelectEl = this.addCapabilitySelect(container, t('option.quality'));
        this.mediaTypeSelectEl = this.addCapabilitySelect(container, t('option.mediaType'));

        this.printerStatusEl = container.createDiv({
            cls: 'cimu-print-center-output-hint',
            text: t('printer.loadingCapabilities')
        });
    }

    private addCapabilitySelect(container: HTMLElement, label: string): HTMLSelectElement {
        const row = this.createOptionRow(container, label);
        row.addClass('cimu-print-capability-row');
        const select = row.createEl('select');
        select.disabled = true;
        select.addEventListener('change', () => {
            const settingKey = select.dataset.settingKey as PrinterOptionSettingKey | undefined;
            if (!settingKey) {
                return;
            }
            this.plugin.settings[settingKey] = select.value;
            void this.plugin.saveSettings();
        });
        return select;
    }

    private addSection(container: HTMLElement, title: string): void {
        container.createEl('h3', { cls: 'cimu-print-center-section', text: title });
    }

    private addToggle<K extends BooleanSettingKey>(
        container: HTMLElement,
        label: string,
        description: string,
        key: K
    ): void {
        const row = this.createOptionRow(container, label, description);
        row.dataset.toggleSetting = key;
        const input = row.createEl('input', { type: 'checkbox' });
        input.checked = this.plugin.settings[key];
        input.addEventListener('change', () => {
            this.plugin.settings[key] = input.checked;
            void this.persistAndRender();
            this.refreshOptionAvailability(container);
        });
    }

    private addSelect<K extends SelectSettingKey>(
        container: HTMLElement,
        label: string,
        key: K,
        options: Record<string, string>,
        enabled?: () => boolean
    ): void {
        const row = this.createOptionRow(container, label);
        if (enabled) {
            row.dataset.enabledWhen = key;
            row.toggleClass('is-disabled', !enabled());
        }
        const select = row.createEl('select');
        Object.entries(options).forEach(([value, text]) => {
            select.createEl('option', { value, text });
        });
        select.value = String(this.plugin.settings[key]);
        select.disabled = enabled ? !enabled() : false;
        select.addEventListener('change', () => {
            this.plugin.settings[key] = select.value as CimuPrintSettings[K];
            void this.persistAndRender();
            if (key === 'pageSize') {
                this.updatePrinterReadiness();
            }
        });
    }

    private addRange<K extends NumberSettingKey>(
        container: HTMLElement,
        label: string,
        key: K,
        minimum: number,
        maximum: number,
        step: number,
        suffix: string,
        enabled?: () => boolean
    ): void {
        const row = this.createOptionRow(container, label);
        const controls = row.createDiv({ cls: 'cimu-print-center-range' });
        const numberInput = controls.createEl('input', { type: 'number' });
        numberInput.min = String(minimum);
        numberInput.max = String(maximum);
        numberInput.step = String(step);
        numberInput.value = String(this.plugin.settings[key]);
        numberInput.setAttribute('aria-label', label);
        controls.createSpan({ text: suffix.trim() });
        const rangeInput = controls.createEl('input', { type: 'range' });
        rangeInput.min = String(minimum);
        rangeInput.max = String(maximum);
        rangeInput.step = String(step);
        rangeInput.value = String(this.plugin.settings[key]);
        const updateAvailability = () => {
            const disabled = enabled ? !enabled() : false;
            numberInput.disabled = disabled;
            rangeInput.disabled = disabled;
            row.toggleClass('is-disabled', disabled);
        };
        const commitValue = (rawValue: string) => {
            const parsed = Number(rawValue);
            const value = Math.max(minimum, Math.min(maximum, Number.isFinite(parsed) ? parsed : minimum));
            numberInput.value = String(value);
            rangeInput.value = String(value);
            this.plugin.settings[key] = value as CimuPrintSettings[K];
            if (key === 'previewZoomPercent' && this.plugin.settings.previewFitToWidth) {
                this.plugin.settings.previewFitToWidth = false;
                const fitToggle = container.querySelector<HTMLInputElement>(
                    '[data-toggle-setting="previewFitToWidth"] input[type="checkbox"]'
                );
                if (fitToggle) {
                    fitToggle.checked = false;
                }
            }
            void this.persistAndRender();
        };
        updateAvailability();
        rangeInput.addEventListener('input', () => commitValue(rangeInput.value));
        numberInput.addEventListener('change', () => commitValue(numberInput.value));
        numberInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                commitValue(numberInput.value);
                numberInput.blur();
            }
        });
        row.dataset.rangeSetting = key;
    }

    private addFontChoice(container: HTMLElement): void {
        const row = this.createOptionRow(
            container,
            t('option.printFont'),
            t('option.printFontDesc')
        );
        const listId = `cimu-print-fonts-${Date.now()}`;
        const input = row.createEl('input', {
            type: 'text',
            cls: 'cimu-print-center-font-input',
            attr: {
                list: listId,
                placeholder: t('option.fontFollow'),
                'aria-label': t('option.printFont')
            }
        });
        input.value = this.plugin.settings.printFontFamily;

        const list = row.createEl('datalist');
        list.id = listId;
        PRINT_FONT_SUGGESTIONS.forEach((fontFamily) => {
            list.createEl('option', { value: fontFamily });
        });

        const commit = () => {
            const value = input.value.trim();
            if (value === this.plugin.settings.printFontFamily) {
                return;
            }
            this.plugin.settings.printFontFamily = value;
            void this.persistAndRender();
        };
        input.addEventListener('change', commit);
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                commit();
                input.blur();
            }
        });
    }

    private createOptionRow(container: HTMLElement, label: string, description?: string): HTMLElement {
        const row = container.createDiv({ cls: 'cimu-print-center-option' });
        const copy = row.createDiv({ cls: 'cimu-print-center-option-copy' });
        copy.createDiv({ cls: 'cimu-print-center-option-name', text: label });
        if (description) {
            copy.createDiv({ cls: 'cimu-print-center-option-description', text: description });
        }
        return row;
    }

    private refreshOptionAvailability(container: HTMLElement): void {
        const titleSource = container.querySelector<HTMLElement>('[data-enabled-when="printedTitleSource"]');
        if (titleSource) {
            const select = titleSource.querySelector('select');
            const disabled = !this.plugin.settings.printTitle;
            titleSource.toggleClass('is-disabled', disabled);
            if (select) {
                select.disabled = disabled;
            }
        }

    }

    private async persistAndRender(): Promise<void> {
        await this.plugin.saveSettings();
        this.requestRender();
    }

    private async loadPrinters(): Promise<void> {
        const select = this.printerSelectEl;
        if (!select) {
            return;
        }

        this.printerReady = false;
        this.updatePrinterReadiness();
        try {
            const printers = await listSystemPrinters();
            select.empty();
            if (printers.length === 0) {
                select.createEl('option', { value: '', text: t('printer.none') });
                select.disabled = true;
                this.setPrinterStatus(t('printer.noneDetail'));
                return;
            }

            printers.forEach((printer) => {
                select.createEl('option', {
                    value: printer.name,
                    text: printer.isDefault
                        ? t('printer.defaultName', { name: printer.displayName })
                        : printer.displayName
                });
            });
            const stored = printers.find((printer) => printer.name === this.plugin.settings.printerName);
            const selected = stored ?? printers.find((printer) => printer.isDefault) ?? printers[0];
            select.value = selected.name;
            select.disabled = false;
            this.plugin.settings.printerName = selected.name;
            await this.plugin.saveSettings();
            await this.loadPrinterCapabilities(selected.name);
        } catch (error) {
            console.error('Printer discovery failed:', error);
            select.empty();
            select.createEl('option', { value: '', text: t('printer.unavailable') });
            select.disabled = true;
            this.setPrinterStatus(t('printer.unavailableDetail'));
        }
    }

    private async loadPrinterCapabilities(printerName: string): Promise<void> {
        this.printerReady = false;
        this.printerCapabilities = null;
        this.updatePrinterReadiness();
        this.setPrinterStatus(t('printer.loadingCapabilities'));

        try {
            const capabilities = await getSystemPrinterCapabilities(printerName);
            if (this.printerSelectEl?.value !== printerName) {
                return;
            }

            this.printerCapabilities = capabilities;
            this.applyCapabilityOptions(
                this.duplexSelectEl,
                capabilities.duplexModes,
                'printDuplex'
            );
            this.applyCapabilityOptions(
                this.colorSelectEl,
                capabilities.colorModes,
                'printColor'
            );
            this.applyCapabilityOptions(
                this.qualitySelectEl,
                capabilities.qualities,
                'printQuality'
            );
            this.applyCapabilityOptions(
                this.mediaTypeSelectEl,
                capabilities.mediaTypes,
                'printMediaType'
            );
            this.printerReady = true;
            this.updatePrinterReadiness();
            await this.plugin.saveSettings();
        } catch (error) {
            console.error(`Printer capability discovery failed for ${printerName}:`, error);
            if (!supportsDirectSystemPrint()) {
                this.printerCapabilities = emptyPrinterCapabilities(printerName);
                this.printerReady = true;
                this.updatePrinterReadiness();
            } else {
                this.setPrinterStatus(t('printer.capabilitiesFailed'));
            }
        }
    }

    private applyCapabilityOptions(
        select: HTMLSelectElement | null,
        options: SystemPrinterOption[],
        settingKey: PrinterOptionSettingKey
    ): void {
        if (!select) {
            return;
        }

        select.empty();
        select.dataset.settingKey = settingKey;
        const row = select.closest('.cimu-print-center-option');
        row?.toggleClass('is-unavailable', options.length === 0);
        if (options.length === 0) {
            select.disabled = true;
            return;
        }

        options.forEach((option) => select.createEl('option', {
            value: option.value,
            text: option.label
        }));
        const storedValue = this.plugin.settings[settingKey];
        const selected = options.find((option) => option.value === storedValue)
            ?? options.find((option) => option.isDefault)
            ?? options[0];
        select.value = selected.value;
        select.disabled = false;
        this.plugin.settings[settingKey] = selected.value;
    }

    private updatePrinterReadiness(): void {
        const direct = supportsDirectSystemPrint();
        const paperSupported = this.isSelectedPaperSupported();
        if (this.printButtonEl) {
            this.printButtonEl.disabled = this.isPrinting || !this.printerReady || !paperSupported;
        }

        if (!this.printerReady) {
            return;
        }
        if (!paperSupported) {
            this.setPrinterStatus(t('printer.paperUnsupported', {
                size: this.plugin.settings.pageSize
            }));
            return;
        }
        this.setPrinterStatus(direct
            ? t('printer.directReady')
            : t('printer.defaultAppFallback'));
    }

    private isSelectedPaperSupported(): boolean {
        const sizes = this.printerCapabilities?.paperSizes ?? [];
        if (sizes.length === 0) {
            return true;
        }
        return sizes.some((option) => option.value === this.plugin.settings.pageSize);
    }

    private getSystemPrintJobOptions(): SystemPrintJobOptions | null {
        const capabilities = this.printerCapabilities;
        const printerName = this.printerSelectEl?.value;
        if (!capabilities || !printerName || !this.printerReady || !this.isSelectedPaperSupported()) {
            return null;
        }

        return {
            printerName,
            copies: this.plugin.settings.printCopies,
            pageRanges: this.pageRangeEl?.value ?? '',
            paperSize: findCapabilityOption(capabilities.paperSizes, this.plugin.settings.pageSize),
            duplex: findCapabilityOption(capabilities.duplexModes, this.plugin.settings.printDuplex),
            color: findCapabilityOption(capabilities.colorModes, this.plugin.settings.printColor),
            quality: findCapabilityOption(capabilities.qualities, this.plugin.settings.printQuality),
            mediaType: findCapabilityOption(capabilities.mediaTypes, this.plugin.settings.printMediaType)
        };
    }

    private setPrinterStatus(text: string): void {
        if (this.printerStatusEl) {
            this.printerStatusEl.textContent = text;
        }
    }

    private requestRender(immediate = false): void {
        if (this.renderTimer !== null) {
            window.clearTimeout(this.renderTimer);
        }

        const delay = immediate ? 0 : this.plugin.settings.previewRefreshDelayMs;
        this.renderTimer = window.setTimeout(() => {
            this.renderTimer = null;
            void this.renderPreview();
        }, delay);
    }

    private async renderPreview(): Promise<void> {
        const generation = ++this.renderGeneration;
        const frame = this.frameEl;
        if (!frame) {
            return;
        }

        this.setStatus(t('center.layout'));

        try {
            const document = this.initialDocument ?? await this.documentFactory();
            this.initialDocument = null;
            if (!document || generation !== this.renderGeneration) {
                if (!document) {
                    this.setStatus(t('center.noContent'));
                    renderEmptyPrintPreview(frame, t('center.noContentDetail'));
                }
                return;
            }

            const generatedCss = await generatePrintStyles(this.app, this.plugin.manifest, this.plugin.settings);
            const includeThemeStyles = this.plugin.settings.printStyleMode === 'styled';
            const runtimeCss = includeThemeStyles
                ? getTargetedRuntimePrintCss(document.content, this.plugin.settings.printFontFamily)
                : getResolvedRuntimeTypographyCss(document.content, this.plugin.settings.printFontFamily);

            if (generation !== this.renderGeneration) {
                return;
            }

            const pageCount = await renderPrintPreview({
                frame,
                title: document.title,
                sourceContent: document.content,
                printCss: `${generatedCss}\n${runtimeCss}`,
                settings: this.plugin.settings,
                includeThemeStyles,
                bodyClasses: document.bodyClasses ?? [],
                isCurrent: () => generation === this.renderGeneration
            });

            if (generation === this.renderGeneration) {
                this.filenameEl?.setText(`${document.title}.pdf`);
                this.setStatus(t('center.pages', { count: pageCount }));
            }
        } catch (error) {
            console.error('Print center preview failed:', error);
            if (generation === this.renderGeneration) {
                this.setStatus(t('center.previewFailed'));
                if (!hasPrintPreview(frame)) {
                    renderEmptyPrintPreview(frame, t('center.previewFailedDetail'));
                }
            }
        }
    }

    private async output(target: PrintCenterOutputTarget): Promise<void> {
        if (this.isPrinting) {
            return;
        }

        this.isPrinting = true;
        this.setOutputButtonsDisabled(true);
        const activeButton = target === 'pdf' ? this.exportButtonEl : this.printButtonEl;
        if (activeButton) {
            activeButton.textContent = t('center.preparing');
        }

        try {
            const document = await this.documentFactory();
            if (!document) {
                this.setStatus(t('center.noContent'));
                return;
            }

            const jobOptions = target === 'system-printer'
                ? this.getSystemPrintJobOptions()
                : undefined;
            if (target === 'system-printer' && !jobOptions) {
                this.setPrinterStatus(t('printer.notReady'));
                return;
            }

            const shouldClose = await this.printHandler(document, target, jobOptions ?? undefined);
            if (shouldClose !== false) {
                this.close();
            }
        } finally {
            this.isPrinting = false;
            this.setOutputButtonsDisabled(false);
        }
    }

    private setOutputButtonsDisabled(disabled: boolean): void {
        if (this.exportButtonEl) {
            this.exportButtonEl.disabled = disabled;
            if (!disabled) {
                this.exportButtonEl.textContent = t('center.exportPdf');
            }
        }
        if (this.printButtonEl) {
            this.printButtonEl.disabled = disabled || !this.printerReady || !this.isSelectedPaperSupported();
            if (!disabled) {
                this.printButtonEl.textContent = t('center.systemPrint');
            }
        }
    }

    private setStatus(text: string): void {
        if (this.statusEl) {
            this.statusEl.textContent = text;
        }
    }
}

type BooleanSettingKey = {
    [Key in keyof CimuPrintSettings]: CimuPrintSettings[Key] extends boolean ? Key : never;
}[keyof CimuPrintSettings];

type SelectSettingKey = 'printedTitleSource' | 'pdfFilenameSource' | 'pageSize' | 'printStyleMode';

type NumberSettingKey = 'pageMarginMm' | 'printScalePercent' | 'previewZoomPercent';

type PrinterOptionSettingKey = 'printDuplex' | 'printColor' | 'printQuality' | 'printMediaType';

function findCapabilityOption(
    options: SystemPrinterOption[],
    value: string
): SystemPrinterOption | undefined {
    return options.find((option) => option.value === value);
}

function emptyPrinterCapabilities(printerName: string): SystemPrinterCapabilities {
    return {
        printerName,
        paperSizes: [],
        duplexModes: [],
        colorModes: [],
        qualities: [],
        mediaTypes: []
    };
}
