import { describe, expect, it } from 'vitest';
import { migrateHotkeyMap, migrateLegacyPrintState } from '../src/migration';
import { DEFAULT_SETTINGS } from '../src/types';

describe('legacy migration', () => {
  it('moves command bindings to the independent plugin id', () => {
    const result = migrateHotkeyMap({
      'print:print-note': [{ modifiers: ['Mod'], key: 'P' }],
      'other:command': [{ key: 'F2' }]
    });
    expect(result.moved).toBe(1);
    expect(result.hotkeys['cimu-print:print-note']).toEqual([{ modifiers: ['Mod'], key: 'P' }]);
    expect(result.hotkeys['print:print-note']).toBeUndefined();
    expect(result.hotkeys['other:command']).toEqual([{ key: 'F2' }]);
  });

  it('imports old settings and writes a hotkey backup once', async () => {
    const files = new Map<string, string>([
      ['.obsidian/plugins/print/data.json', JSON.stringify({ pageSize: 'Letter', printCopies: 3 })],
      ['.obsidian/hotkeys.json', JSON.stringify({ 'print:print-note': [{ key: 'F8' }] })]
    ]);
    const adapter = {
      exists: async (path: string) => files.has(path),
      read: async (path: string) => files.get(path) ?? '',
      write: async (path: string, value: string) => { files.set(path, value); }
    };
    const settings = { ...DEFAULT_SETTINGS, temporaryPrintPdfPaths: [] };
    const app = { vault: { adapter, configDir: '.obsidian' } };

    const result = await migrateLegacyPrintState(app as never, settings, true);

    expect(result).toMatchObject({ settingsImported: true, hotkeysMoved: 1 });
    expect(settings.pageSize).toBe('Letter');
    expect(settings.printCopies).toBe(3);
    expect(settings.legacyMigrationVersion).toBe(1);
    expect(files.has('.obsidian/hotkeys.cimu-print-migration-backup.json')).toBe(true);
    expect(JSON.parse(files.get('.obsidian/hotkeys.json') ?? '{}')).toEqual({
      'cimu-print:print-note': [{ key: 'F8' }]
    });
  });
});
