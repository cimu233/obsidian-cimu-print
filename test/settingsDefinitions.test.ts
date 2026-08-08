import { App, SettingDefinitionItem } from 'obsidian';
import { describe, expect, it } from 'vitest';
import type CimuPrintPlugin from '../src/main';
import { DEFAULT_SETTINGS } from '../src/types';
import { CimuPrintSettingTab } from '../src/ui/settings';

describe('settings definitions', () => {
  it('indexes current and conditionally visible settings for Obsidian settings search', () => {
    const owner = {
      settings: { ...DEFAULT_SETTINGS },
      saveSettings: async () => undefined
    } as CimuPrintPlugin;
    const tab = new CimuPrintSettingTab({} as App, owner);
    const names = collectNames(tab.getSettingDefinitions());

    expect(names).toContain('Language');
    expect(names).toContain('Content scale');
    expect(names).toContain('Font size');
    expect(names).toContain('Print PDF folder');
  });
});

function collectNames(items: SettingDefinitionItem[]): string[] {
  return items.flatMap((item) => {
    if ('type' in item && item.type === 'group') {
      return (item.items ?? []).map((child) => child.name);
    }
    return 'name' in item ? [item.name] : [];
  });
}
