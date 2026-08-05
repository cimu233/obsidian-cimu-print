import { App } from 'obsidian';
import { CimuPrintSettings } from './types';

const SOURCE_PLUGIN_ID = 'print';
const TARGET_PLUGIN_ID = 'cimu-print';
const MIGRATION_VERSION = 1;

interface MigrationResult {
  settingsImported: boolean;
  hotkeysMoved: number;
  backupPath: string | null;
}

export async function migrateLegacyPrintState(
  app: App,
  settings: CimuPrintSettings,
  newSettingsWereEmpty: boolean
): Promise<MigrationResult> {
  if (settings.legacyMigrationVersion >= MIGRATION_VERSION) {
    return { settingsImported: false, hotkeysMoved: 0, backupPath: null };
  }

  const adapter = app.vault.adapter;
  const configDir = app.vault.configDir;
  let settingsImported = false;

  if (newSettingsWereEmpty) {
    const legacyData = await readJson<Record<string, unknown>>(
      adapter,
      `${configDir}/plugins/${SOURCE_PLUGIN_ID}/data.json`
    );
    if (legacyData) {
      importKnownSettings(settings, legacyData);
      settingsImported = true;
    }
  }

  const hotkeysPath = `${configDir}/hotkeys.json`;
  const hotkeys = await readJson<Record<string, unknown>>(adapter, hotkeysPath);
  let hotkeysMoved = 0;
  let backupPath: string | null = null;

  if (hotkeys) {
    const migrated = migrateHotkeyMap(hotkeys);
    hotkeysMoved = migrated.moved;
    if (migrated.moved > 0) {
      backupPath = `${configDir}/hotkeys.cimu-print-migration-backup.json`;
      if (!await adapter.exists(backupPath)) {
        await adapter.write(backupPath, `${JSON.stringify(hotkeys, null, 2)}\n`);
      }
      await adapter.write(hotkeysPath, `${JSON.stringify(migrated.hotkeys, null, 2)}\n`);
    }
  }

  settings.legacyMigrationVersion = MIGRATION_VERSION;
  return { settingsImported, hotkeysMoved, backupPath };
}

export function migrateHotkeyMap(hotkeys: Record<string, unknown>): {
  hotkeys: Record<string, unknown>;
  moved: number;
} {
  const migrated = { ...hotkeys };
  let moved = 0;

  for (const [commandId, bindings] of Object.entries(hotkeys)) {
    const prefix = `${SOURCE_PLUGIN_ID}:`;
    if (!commandId.startsWith(prefix)) {
      continue;
    }
    const targetId = `${TARGET_PLUGIN_ID}:${commandId.slice(prefix.length)}`;
    if (!(targetId in migrated)) {
      migrated[targetId] = bindings;
    }
    delete migrated[commandId];
    moved += 1;
  }

  return { hotkeys: migrated, moved };
}

function importKnownSettings(
  target: CimuPrintSettings,
  source: Record<string, unknown>
): void {
  for (const key of Object.keys(target) as Array<keyof CimuPrintSettings>) {
    if (key === 'legacyMigrationVersion' || !(key in source)) {
      continue;
    }
    const currentValue = target[key];
    const legacyValue = source[key];
    if (sameShape(currentValue, legacyValue)) {
      (target as unknown as Record<string, unknown>)[key] = legacyValue;
    }
  }
}

function sameShape(current: unknown, candidate: unknown): boolean {
  if (Array.isArray(current)) {
    return Array.isArray(candidate);
  }
  return typeof current === typeof candidate;
}

async function readJson<T>(
  adapter: App['vault']['adapter'],
  path: string
): Promise<T | null> {
  try {
    if (!await adapter.exists(path)) {
      return null;
    }
    return JSON.parse(await adapter.read(path)) as T;
  } catch (error) {
    console.warn(`Cimu Print could not read migration file ${path}:`, error);
    return null;
  }
}
