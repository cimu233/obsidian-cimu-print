export const PRINT_FONT_SUGGESTIONS = [
    '霞鹜文楷',
    'LXGW WenKai',
    'PingFang SC',
    'Songti SC',
    'Kaiti SC',
    'Heiti SC',
    'Microsoft YaHei',
    'SimSun',
    'Noto Sans CJK SC',
    'Noto Serif CJK SC',
    'Arial',
    'Times New Roman'
] as const;

export function serializePrintFontFamily(value: string): string {
    const normalized = value
        .replace(/[\u0000-\u001f\u007f;{}]/g, '')
        .trim();

    if (!normalized) {
        return '';
    }

    return `"${normalized.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
