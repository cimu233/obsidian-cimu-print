# Cimu Print for Obsidian

Cimu Print is an independently implemented Obsidian desktop printing plugin. The repository has its own source structure, Git history, package identity, styles, tests, and build configuration.

## Plugin identity

- Plugin ID: `cimu-print`
- Repository and package: `obsidian-cimu-print`
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

## Local CLI for agents and scripts

The CLI sends authenticated loopback requests to the running Obsidian plugin. This keeps Markdown rendering inside Obsidian, so internal links, embeds, Mermaid, MathJax, the active theme, and enabled snippets use the same rendering pipeline as the Print Center.

Reload Cimu Print after building or installing it, then run the deployed script:

```bash
node .obsidian/plugins/cimu-print/cimu-print.mjs status
node .obsidian/plugins/cimu-print/cimu-print.mjs printers
node .obsidian/plugins/cimu-print/cimu-print.mjs print "Notes/Example.md" \
  --printer "Office_Printer" \
  --duplex long-edge \
  --scale 75 \
  --style obsidian
```

Run from the vault root, set `CIMU_PRINT_VAULT`, or pass `--vault /absolute/path/to/vault`. Every command returns JSON.

Print options:

- `--duplex single`: one-sided printing.
- `--duplex long-edge`: two-sided printing with long-edge binding.
- `--duplex short-edge`: two-sided printing with short-edge binding.
- `--scale 25..200`: actual PDF content scale used for the submitted print job. Preview zoom remains unchanged.
- `--style obsidian`: Obsidian `MarkdownRenderer` plus captured current Obsidian theme and relevant CSS.
- `--style plain`: Obsidian `MarkdownRenderer` plus Cimu Print's clean Markdown stylesheet.
- `--copies 1..999` and `--pages 1-4,7`: optional copy count and generated-PDF page ranges.

The plugin binds the service to `127.0.0.1` on a random port. It writes a mode-`0600` endpoint file with a random bearer token in `.obsidian/plugins/cimu-print/cimu-print-cli.json`, serializes print requests, and removes the endpoint file when the plugin unloads. Obsidian and Cimu Print must be running. Direct CLI submission currently uses CUPS on macOS and Linux.

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

## License

Copyright (C) 2026 Cimu Lumi. Licensed under the GNU Affero General Public License v3.0 only (`AGPL-3.0-only`). Modified versions distributed to users, including versions offered as a network service, must provide the corresponding source code under the same license terms.
