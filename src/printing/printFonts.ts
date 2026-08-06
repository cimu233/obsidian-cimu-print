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
    const normalized = Array.from(value)
        .filter((character) => {
            const codePoint = character.codePointAt(0) ?? 0;
            return codePoint > 0x1f && codePoint !== 0x7f && !';{}'.includes(character);
        })
        .join('')
        .trim();

    if (!normalized) {
        return '';
    }

    return `"${normalized.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
