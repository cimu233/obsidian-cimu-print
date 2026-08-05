# Cimu Print

Cimu Print is an independently implemented Obsidian desktop printing plugin. The repository has its own source structure, Git history, package identity, styles, tests, and build configuration.

## Plugin identity

- Plugin ID: `cimu-print`
- Package: `cimu-print`
- Install folder: `.obsidian/plugins/cimu-print`
- Entry point: `main.js`

## Printing flow

1. Capture the note, selection, folder, or active non-Markdown view.
2. Render and paginate a PDF preview.
3. Generate the final PDF and verify its page count.
4. Read printer capabilities from the operating system.
5. On macOS and Linux, send the verified PDF to CUPS through `lp`.
6. When in-memory printing is enabled, PDF bytes are streamed through standard input and no plugin-side temporary PDF is created.

The plugin does not use Electron `webContents.print()`.

## Migration from plugin ID `print`

On its first load, Cimu Print performs a guarded one-time migration:

- reads compatible settings from `.obsidian/plugins/print/data.json` when the new plugin has no settings;
- moves shortcut entries from `print:<command>` to `cimu-print:<command>`;
- writes `.obsidian/hotkeys.cimu-print-migration-backup.json` before changing shortcuts;
- keeps an existing `cimu-print:<command>` shortcut when both IDs are present.

The source plugin folder remains untouched by the migration.

## Temporary PDFs

- In-memory printing is enabled by default on supported systems.
- File-based fallback uses the displayed temporary or custom directory.
- Automatic cleanup is disabled by default.
- Optional cleanup handles only plugin-tracked regular PDF files directly inside the system temporary directory.
- Files in a custom directory are always retained.

## Development

```bash
npm install
npm test
npm run build
```

Deploy `main.js`, `manifest.json`, and `styles.css` to `.obsidian/plugins/cimu-print`.
