import { PrintLanguage } from './types';

const EN = {
    'language.auto': 'Automatic',
    'language.en': 'English',
    'language.zh-TW': 'Traditional Chinese',
    'language.zh-CN': 'Simplified Chinese',
    'command.currentNote': 'Current note',
    'command.selection': 'Print selection',
    'command.folder': 'All notes in current folder',
    'command.printNote': 'Print note',
    'command.printFolder': 'Print all notes in folder',
    'center.title': 'Print',
    'center.preparingFilename': 'Preparing file name...',
    'center.refresh': 'Refresh preview',
    'center.preview': 'Print preview',
    'center.layout': 'Laying out...',
    'center.cancel': 'Cancel',
    'center.exportPdf': 'Export PDF...',
    'center.systemPrint': 'Print',
    'center.preparing': 'Preparing...',
    'center.noContent': 'Nothing to print',
    'center.noContentDetail': 'There is no printable content.',
    'center.previewFailed': 'Preview failed',
    'center.previewFailedDetail': 'Preview generation failed. Please refresh.',
    'center.pages': '{{count}} pages',
    'section.content': 'Content',
    'section.filename': 'File name',
    'section.page': 'Page',
    'section.appearance': 'Appearance',
    'section.preview': 'Preview',
    'section.output': 'Output',
    'section.layout': 'Layout',
    'section.advanced': 'Advanced',
    'section.pdfNaming': 'PDF file naming',
    'section.printer': 'Printer',
    'option.extraTitle': 'Add an extra title',
    'option.extraTitleDesc': 'Off by default. Existing level-one headings remain visible.',
    'option.extraTitleSource': 'Extra title source',
    'option.firstHeading': 'Level-one heading',
    'option.fileName': 'File name',
    'option.properties': 'Print note properties',
    'option.propertiesDesc': 'Include the Properties or YAML block.',
    'option.pdfFilename': 'Default PDF file name',
    'option.pageSize': 'Paper size',
    'option.pageSizeDesc': 'Used for preview, PDF export, and printing.',
    'option.landscape': 'Landscape',
    'option.landscapeDesc': 'Turn off for portrait orientation.',
    'option.margin': 'Page margin',
    'option.marginDesc': 'Set the page margin in millimetres.',
    'option.printScale': 'Content scale',
    'option.printScaleDesc': 'Scale document content without changing the paper size.',
    'option.appearance': 'Print appearance',
    'option.styled': 'Current Obsidian appearance',
    'option.plain': 'Plain Markdown',
    'option.printFont': 'Print font',
    'option.printFontDesc': 'Leave empty to follow Obsidian, or choose and enter any installed font.',
    'option.fontFollow': 'Follow Obsidian',
    'option.noteStyle': 'Apply this note\'s custom style',
    'option.noteStyleDesc': 'Also apply extra appearance classes configured in this note. Usually this can stay off.',
    'option.hrBreak': 'Horizontal lines start a new page',
    'option.hrBreakDesc': 'Treat Markdown horizontal lines as page breaks.',
    'option.fitPreview': 'Fit pages to preview width',
    'option.fitPreviewDesc': 'Keep the full page width inside the preview. Manual preview zoom exits this mode.',
    'option.previewZoom': 'Preview zoom',
    'option.previewZoomDesc': 'Changes only the on-screen page size. Using it exits fit-to-width mode and never changes layout or pagination.',
    'option.pageNumbers': 'Show preview page numbers',
    'option.pageNumbersDesc': 'Page numbers appear only in the preview.',
    'option.printer': 'Printer',
    'option.pageRange': 'Pages',
    'option.pageRangeDesc': 'Leave empty for every page, or enter ranges such as 1-4,7.',
    'option.allPages': 'All pages',
    'option.copies': 'Copies',
    'option.duplex': 'Two-sided',
    'option.color': 'Color',
    'option.quality': 'Quality',
    'option.mediaType': 'Paper type',
    'printer.loading': 'Loading printers...',
    'printer.loadingCapabilities': 'Reading printer capabilities...',
    'printer.none': 'No printers',
    'printer.noneDetail': 'No system printers were found.',
    'printer.defaultName': '{{name}} (default)',
    'printer.unavailable': 'Printer service unavailable',
    'printer.unavailableDetail': 'The operating system printer service could not be read.',
    'printer.capabilitiesFailed': 'The selected printer capabilities could not be read.',
    'printer.paperUnsupported': 'The selected printer does not report support for {{size}} paper.',
    'printer.directReady': 'The verified PDF will be submitted directly to the system print queue.',
    'printer.defaultAppFallback': 'Direct PDF submission is unavailable on this system. The retained PDF will open in its default app.',
    'printer.notReady': 'Choose an available printer and supported paper size.',
    'settings.language': 'Language',
    'settings.languageDesc': 'Follow Obsidian or the operating system automatically, or choose a language.',
    'settings.defaultOutput': 'Default output',
    'settings.defaultOutputDesc': 'Used for compatibility with earlier settings. The print center always shows both output actions.',
    'settings.systemPrinter': 'System printer',
    'settings.pdfFile': 'PDF file',
    'settings.nativePdfName': 'Apply to Obsidian PDF export',
    'settings.nativePdfNameDesc': 'Also use the level-one heading in Obsidian\'s built-in Export to PDF dialog.',
    'settings.fontSize': 'Font size',
    'settings.fontSizeDesc': 'Body font size for Plain Markdown.',
    'settings.headingSize': 'Heading {{level}} size',
    'settings.headingSizeDesc': 'Font size for heading level {{level}} in Plain Markdown.',
    'settings.combineFolder': 'Combine folder notes',
    'settings.combineFolderDesc': 'Combine notes into one document. When off, each note starts on a new page.',
    'settings.printCenter': 'Print center',
    'settings.printCenterDesc': 'Document and printer options appear beside the paginated preview. Supported systems submit the verified PDF directly.',
    'settings.memoryPrint': 'Prefer in-memory printing',
    'settings.memoryPrintDesc': 'On supported systems, stream the verified PDF directly to the print queue without creating a plugin-side temporary file.',
    'settings.cleanupTemporaryPdfs': 'Clean previous temporary PDFs before printing',
    'settings.cleanupTemporaryPdfsDesc': 'Remove only plugin-tracked PDF files from the system temporary folder. Files in a custom folder are always kept.',
    'settings.printHandoffDirectory': 'Print PDF folder',
    'settings.printHandoffDirectoryDesc': 'Used when file-based printing or the default PDF app is required. Leave empty to use the system temporary folder.',
    'settings.printHandoffCurrent': 'Current folder: {{path}}',
    'settings.printHandoffChoose': 'Choose...',
    'settings.printHandoffReset': 'Use system temporary folder',
    'settings.printFolderPickerTitle': 'Select print PDF folder',
    'settings.systemTempFolder': 'System temporary folder',
    'settings.refreshDelay': 'Preview refresh delay',
    'settings.refreshDelayDesc': 'Wait briefly after editing before recalculating pages.',
    'settings.customCss': 'Custom CSS',
    'settings.customCssDesc': 'Enable the print.css snippet for print-specific appearance overrides.',
    'settings.debug': 'Debug mode',
    'settings.debugDesc': 'Open the generated print document for inspection.',
    'notice.noNote': 'No note to print.',
    'notice.noActiveNote': 'No active note.',
    'notice.noSelection': 'No text selected.',
    'notice.noFolder': 'Could not resolve the folder.',
    'notice.noMarkdown': 'No Markdown files were found in this folder.',
    'notice.openFile': 'Open the file first to print its rendered view.',
    'notice.previewCaptureFailed': 'Could not capture the current view for printing.',
    'notice.previewGenerationFailed': 'Failed to generate preview content.',
    'notice.desktopPdfOnly': 'Direct PDF export is available in Obsidian desktop.',
    'notice.exportPdfTitle': 'Export PDF',
    'notice.pdfSaved': 'PDF saved: {{path}}',
    'notice.pdfFailed': 'Could not export the PDF.',
    'notice.printDirectoryInvalid': 'The print PDF folder is unavailable: {{path}}',
    'notice.pdfAppOpened': 'Opened {{count}}-page PDF in the default app: {{path}}',
    'notice.pdfAppOpenFailed': 'The PDF was kept, but its default app could not be opened: {{path}}',
    'notice.pdfHandoffFailed': 'Could not prepare the PDF for its default app.',
    'notice.printDirectoryPickerFailed': 'Could not select the print PDF folder.',
    'notice.printFailed': 'Could not open the system print dialog.',
    'notice.printPrepared': 'Prepared {{count}} pages for system printing.',
    'notice.directPrintFallback': 'Direct PDF submission is unavailable here. Opening the retained PDF in its default app.',
    'notice.invalidPageRange': 'The page range is invalid or exceeds the generated PDF.',
    'notice.memoryPrintSubmitted': 'Submitted the {{count}}-page PDF from memory to {{printer}} as job {{job}}. No plugin-side temporary PDF was created.',
    'notice.printSubmitted': 'Submitted the {{count}}-page PDF to {{printer}} as job {{job}}. PDF retained at: {{path}}',
    'notice.printSubmissionFailed': 'The print job was not submitted. The generated PDF remains at: {{path}}',
    'notice.noRetainedPdf': 'no PDF file was created',
    'notice.pluginPathMissing': 'Could not find the plugin path. Default print styles were skipped.',
    'notice.defaultStylesMissing': 'Default print styles could not be loaded.',
    'notice.debugDesktopOnly': 'Debug mode is available in Obsidian desktop.',
    'notice.debugFailed': 'Could not open the debug print preview.',
    'filename.selectionSuffix': 'selection'
} as const;

type TranslationKey = keyof typeof EN;
type Dictionary = Record<TranslationKey, string>;

const ZH_TW: Dictionary = {
    'language.auto': '自動', 'language.en': 'English', 'language.zh-TW': '繁體中文', 'language.zh-CN': '简体中文',
    'command.currentNote': '目前筆記', 'command.selection': '列印選取內容', 'command.folder': '目前資料夾內全部筆記', 'command.printNote': '列印筆記', 'command.printFolder': '列印資料夾內全部筆記',
    'center.title': '列印', 'center.preparingFilename': '正在準備檔名...', 'center.refresh': '重新整理預覽', 'center.preview': '列印預覽', 'center.layout': '正在排版...', 'center.cancel': '取消', 'center.exportPdf': '導出 PDF...', 'center.systemPrint': '列印', 'center.preparing': '正在準備...', 'center.noContent': '沒有可列印內容', 'center.noContentDetail': '目前沒有可列印內容。', 'center.previewFailed': '預覽失敗', 'center.previewFailedDetail': '預覽產生失敗，請重新整理。', 'center.pages': '共 {{count}} 頁',
    'section.content': '內容', 'section.filename': '檔名', 'section.page': '頁面', 'section.appearance': '外觀', 'section.preview': '預覽', 'section.output': '輸出', 'section.layout': '版面', 'section.advanced': '進階', 'section.pdfNaming': 'PDF 檔名', 'section.printer': '印表機',
    'option.extraTitle': '額外列印一行標題', 'option.extraTitleDesc': '預設關閉；文件原有的一級標題仍會列印。', 'option.extraTitleSource': '額外標題來源', 'option.firstHeading': '一級標題', 'option.fileName': '檔名', 'option.properties': '列印文件屬性', 'option.propertiesDesc': '顯示 Properties 或 YAML 區塊。', 'option.pdfFilename': 'PDF 預設檔名', 'option.pageSize': '紙張大小', 'option.pageSizeDesc': '套用於預覽、PDF 和列印。', 'option.landscape': '橫向', 'option.landscapeDesc': '關閉時使用直向。', 'option.margin': '頁面邊距', 'option.marginDesc': '以毫米設定頁面邊距。', 'option.printScale': '內容縮放', 'option.printScaleDesc': '保持紙張大小，只調整文件內容比例。', 'option.appearance': '列印外觀', 'option.styled': '目前 Obsidian 外觀', 'option.plain': '原生 Markdown', 'option.printFont': '列印字體', 'option.printFontDesc': '留空時跟隨 Obsidian，也可選擇或輸入任意已安裝字體。', 'option.fontFollow': '跟隨 Obsidian', 'option.noteStyle': '套用此筆記的專屬樣式', 'option.noteStyleDesc': '若筆記設定了額外外觀，列印時一併套用；一般情況可保持關閉。', 'option.hrBreak': '水平線後另起一頁', 'option.hrBreakDesc': '將 Markdown 水平線視為分頁符。', 'option.fitPreview': '自動適應預覽寬度', 'option.fitPreviewDesc': '讓整張頁面寬度保持在預覽框內；手動調整預覽縮放會退出此模式。', 'option.previewZoom': '預覽縮放', 'option.previewZoomDesc': '只調整畫面中的紙張大小；使用時會退出自動適應，不會改變排版或分頁。', 'option.pageNumbers': '顯示預覽頁碼', 'option.pageNumbersDesc': '頁碼只會顯示在預覽中。', 'option.printer': '印表機', 'option.pageRange': '頁面範圍', 'option.pageRangeDesc': '留空會列印全部頁面，也可輸入 1-4,7。', 'option.allPages': '全部頁面', 'option.copies': '份數', 'option.duplex': '雙面列印', 'option.color': '色彩', 'option.quality': '列印品質', 'option.mediaType': '紙張類型', 'printer.loading': '正在載入印表機...', 'printer.loadingCapabilities': '正在讀取印表機能力...', 'printer.none': '沒有印表機', 'printer.noneDetail': '系統中找不到可用印表機。', 'printer.defaultName': '{{name}}（預設）', 'printer.unavailable': '印表機服務無法使用', 'printer.unavailableDetail': '無法讀取作業系統的印表機服務。', 'printer.capabilitiesFailed': '無法讀取所選印表機的能力。', 'printer.paperUnsupported': '所選印表機未回報支援 {{size}} 紙張。', 'printer.directReady': '經過校驗的 PDF 將直接提交到系統列印佇列。', 'printer.defaultAppFallback': '此系統目前無法直接提交 PDF，將保留 PDF 並用預設應用開啟。', 'printer.notReady': '請選擇可用印表機與支援的紙張。',
    'settings.language': '語言', 'settings.languageDesc': '自動跟隨 Obsidian 或作業系統，也可以手動選擇。', 'settings.defaultOutput': '預設輸出', 'settings.defaultOutputDesc': '保留舊版設定相容性；列印中心會同時顯示兩個輸出按鈕。', 'settings.systemPrinter': '系統印表機', 'settings.pdfFile': 'PDF 檔案', 'settings.nativePdfName': '套用至 Obsidian PDF 導出', 'settings.nativePdfNameDesc': 'Obsidian 原生導出 PDF 時，也使用一級標題作為預設檔名。', 'settings.fontSize': '正文字級', 'settings.fontSizeDesc': '原生 Markdown 的正文字級。', 'settings.headingSize': '{{level}} 級標題字級', 'settings.headingSizeDesc': '原生 Markdown 的 {{level}} 級標題字級。', 'settings.combineFolder': '合併資料夾筆記', 'settings.combineFolderDesc': '合併成一份文件；關閉時每篇筆記另起一頁。', 'settings.printCenter': '列印中心', 'settings.printCenterDesc': '文件與印表機選項會和分頁預覽集中顯示；支援的系統會直接提交校驗後的 PDF。', 'settings.memoryPrint': '優先使用記憶體列印', 'settings.memoryPrintDesc': '支援的系統會將校驗後的 PDF 直接傳入列印佇列，插件不會建立暫存檔案。', 'settings.cleanupTemporaryPdfs': '列印前清理上次暫存 PDF', 'settings.cleanupTemporaryPdfsDesc': '只會移除插件登記且位於系統暫存資料夾的 PDF；自訂資料夾中的檔案會一直保留。', 'settings.printHandoffDirectory': '列印 PDF 資料夾', 'settings.printHandoffDirectoryDesc': '檔案式列印或預設 PDF 應用需要時會使用此資料夾；留空時使用系統暫存資料夾。', 'settings.printHandoffCurrent': '目前資料夾：{{path}}', 'settings.printHandoffChoose': '選擇...', 'settings.printHandoffReset': '使用系統暫存資料夾', 'settings.printFolderPickerTitle': '選擇列印 PDF 資料夾', 'settings.systemTempFolder': '系統暫存資料夾', 'settings.refreshDelay': '預覽更新延遲', 'settings.refreshDelayDesc': '編輯後稍候片刻再重新計算頁面。', 'settings.customCss': '自訂 CSS', 'settings.customCssDesc': '啟用 print.css 片段，加入列印專用外觀。', 'settings.debug': '偵錯模式', 'settings.debugDesc': '開啟產生的列印文件以便檢查。',
    'notice.noNote': '沒有可列印的筆記。', 'notice.noActiveNote': '目前沒有開啟的筆記。', 'notice.noSelection': '尚未選取文字。', 'notice.noFolder': '無法取得資料夾。', 'notice.noMarkdown': '此資料夾內沒有 Markdown 文件。', 'notice.openFile': '請先開啟此檔案，再列印其呈現內容。', 'notice.previewCaptureFailed': '無法取得目前畫面供列印。', 'notice.previewGenerationFailed': '無法產生預覽內容。', 'notice.desktopPdfOnly': '直接導出 PDF 僅支援 Obsidian 桌面版。', 'notice.exportPdfTitle': '導出 PDF', 'notice.pdfSaved': 'PDF 已儲存：{{path}}', 'notice.pdfFailed': 'PDF 導出失敗。', 'notice.printDirectoryInvalid': '列印 PDF 資料夾無法使用：{{path}}', 'notice.pdfAppOpened': '已用預設應用開啟 {{count}} 頁 PDF：{{path}}', 'notice.pdfAppOpenFailed': 'PDF 已保留，預設應用未能開啟：{{path}}', 'notice.pdfHandoffFailed': '無法準備交給預設應用的 PDF。', 'notice.printDirectoryPickerFailed': '無法選擇列印 PDF 資料夾。', 'notice.printFailed': '無法開啟系統列印窗口。', 'notice.printPrepared': '已準備 {{count}} 頁供系統列印。', 'notice.directPrintFallback': '此系統目前無法直接提交 PDF，正在用預設應用開啟保留的 PDF。', 'notice.invalidPageRange': '頁面範圍格式錯誤，或超過產生後的 PDF 頁數。', 'notice.memoryPrintSubmitted': '已從記憶體將 {{count}} 頁 PDF 提交至 {{printer}}，任務編號 {{job}}。插件未建立暫存 PDF。', 'notice.printSubmitted': '已將 {{count}} 頁 PDF 提交至 {{printer}}，任務編號 {{job}}。PDF 保留於：{{path}}', 'notice.printSubmissionFailed': '列印任務未提交。產生的 PDF 保留於：{{path}}', 'notice.noRetainedPdf': '尚未產生 PDF 檔案', 'notice.pluginPathMissing': '找不到插件路徑，已略過預設列印樣式。', 'notice.defaultStylesMissing': '無法載入預設列印樣式。', 'notice.debugDesktopOnly': '偵錯模式僅支援 Obsidian 桌面版。', 'notice.debugFailed': '無法開啟偵錯列印預覽。', 'filename.selectionSuffix': '選段'
};

const ZH_CN: Dictionary = Object.fromEntries(
    Object.entries(ZH_TW).map(([key, value]) => [key, replaceMany(value, [
        ['列印', '打印'], ['檔案', '文件'], ['檔名', '文件名'], ['資料夾', '文件夹'],
        ['預覽', '预览'], ['預設', '默认'], ['導出', '导出'], ['開啟', '打开'],
        ['關閉', '关闭'], ['無法', '无法'], ['選取', '选中'], ['內容', '内容'],
        ['頁', '页'], ['樣式', '样式'], ['視為', '视为'], ['顯示', '显示'],
        ['設定', '设置'], ['選擇', '选择'], ['縮放', '缩放'], ['調整', '调整'],
        ['視窗', '窗口'], ['進階', '高级'], ['級', '级'], ['標題', '标题'],
        ['載入', '加载'], ['產生', '生成'], ['儲存', '保存'], ['偵錯', '调试'],
        ['僅', '仅'], ['體', '体'], ['動', '动'], ['應用', '应用'], ['暫存', '临时'],
        ['印表機', '打印机'], ['雙面', '双面'], ['範圍', '范围'], ['佇列', '队列'], ['張', '张']
    ])])
) as Dictionary;

const DICTIONARIES: Record<Exclude<PrintLanguage, 'auto'>, Dictionary> = {
    en: EN,
    'zh-TW': ZH_TW,
    'zh-CN': ZH_CN
};

let languagePreference: PrintLanguage = 'auto';

export function setPrintLanguage(preference: PrintLanguage): void {
    languagePreference = preference;
}

export function getPrintLanguage(preference = languagePreference): Exclude<PrintLanguage, 'auto'> {
    if (preference !== 'auto') {
        return preference;
    }

    const candidates = [
        document.documentElement.lang,
        safeLocalStorageLanguage(),
        navigator.language
    ];

    for (const candidate of candidates) {
        const normalized = normalizeLanguage(candidate);
        if (normalized) {
            return normalized;
        }
    }

    return 'en';
}

export function t(key: TranslationKey, values: Record<string, string | number> = {}): string {
    let text = DICTIONARIES[getPrintLanguage()][key] ?? EN[key];
    Object.entries(values).forEach(([name, value]) => {
        text = text.split(`{{${name}}}`).join(String(value));
    });
    return text;
}

function replaceMany(value: string, replacements: Array<[string, string]>): string {
    return replacements.reduce(
        (current, [source, target]) => current.split(source).join(target),
        value
    );
}

function normalizeLanguage(value: string | null | undefined): Exclude<PrintLanguage, 'auto'> | null {
    const normalized = value?.trim().replace('_', '-').toLowerCase();
    if (!normalized) {
        return null;
    }
    if (normalized.startsWith('zh')) {
        return /tw|hk|mo|hant/.test(normalized) ? 'zh-TW' : 'zh-CN';
    }
    if (normalized.startsWith('en')) {
        return 'en';
    }
    return null;
}

function safeLocalStorageLanguage(): string | null {
    try {
        return window.localStorage?.getItem('language') ?? null;
    } catch (error) {
        return null;
    }
}
