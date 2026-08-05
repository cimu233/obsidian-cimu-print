#!/usr/bin/env node

import { access, readFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ENDPOINT_FILENAME = 'cimu-print-cli.json';
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const USAGE = `Cimu Print local CLI

Usage:
  cimu-print status [--vault PATH]
  cimu-print printers [--vault PATH]
  cimu-print print FILE [options] [--vault PATH]

Print options:
  --printer NAME                   System printer name; defaults to the saved or system default
  --duplex single|long-edge|short-edge
                                   One-sided, two-sided long-edge, or two-sided short-edge
  --scale 25..200                  Actual printed-content scale; does not change preview zoom
  --style obsidian|plain           Current Obsidian appearance or clean Markdown print style
  --copies 1..999                  Number of copies
  --pages RANGE                    PDF page range such as 1-4,7

FILE must be relative to the vault. Obsidian and Cimu Print must be running.
The result is written as JSON for local agents and scripts.
`;

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ ok: false, error: error.message ?? String(error) }, null, 2)}\n`);
  process.exitCode = 1;
});

async function main() {
  const parsed = parseArguments(process.argv.slice(2));
  if (parsed.help) {
    process.stdout.write(USAGE);
    return;
  }

  const descriptorPath = await findDescriptor(parsed.vault);
  const descriptor = JSON.parse(await readFile(descriptorPath, 'utf8'));
  validateDescriptor(descriptor);

  if (parsed.command === 'status') {
    const response = await callPlugin(descriptor, 'GET', '/v1/status');
    printJson({
      ...response,
      pluginVersion: descriptor.pluginVersion,
      vaultPath: descriptor.vaultPath,
      pid: descriptor.pid
    });
    return;
  }
  if (parsed.command === 'printers') {
    printJson(await callPlugin(descriptor, 'GET', '/v1/printers'));
    return;
  }
  if (parsed.command === 'print') {
    printJson(await callPlugin(descriptor, 'POST', '/v1/print', parsed.printRequest));
    return;
  }
  throw new Error(`Unknown command: ${parsed.command}`);
}

function parseArguments(args) {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    return { help: true };
  }

  let vault;
  const filtered = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--vault') {
      vault = requireValue(args, ++index, '--vault');
    } else {
      filtered.push(args[index]);
    }
  }

  const command = filtered.shift();
  if (command === 'status' || command === 'printers') {
    if (filtered.length > 0) {
      throw new Error(`${command} does not accept extra arguments.`);
    }
    return { command, vault };
  }
  if (command !== 'print') {
    throw new Error(`Unknown command: ${command ?? ''}`);
  }

  const file = filtered.shift();
  if (!file || file.startsWith('--')) {
    throw new Error('print requires a vault-relative Markdown file path.');
  }

  const printRequest = { file };
  for (let index = 0; index < filtered.length; index += 1) {
    const option = filtered[index];
    if (option === '--printer') {
      printRequest.printer = requireValue(filtered, ++index, option);
    } else if (option === '--duplex') {
      printRequest.duplex = requireChoice(
        requireValue(filtered, ++index, option),
        option,
        ['single', 'long-edge', 'short-edge']
      );
    } else if (option === '--scale') {
      printRequest.scale = requireInteger(requireValue(filtered, ++index, option), option, 25, 200);
    } else if (option === '--style') {
      printRequest.style = requireChoice(
        requireValue(filtered, ++index, option),
        option,
        ['obsidian', 'plain']
      );
    } else if (option === '--copies') {
      printRequest.copies = requireInteger(requireValue(filtered, ++index, option), option, 1, 999);
    } else if (option === '--pages') {
      printRequest.pages = requireValue(filtered, ++index, option);
    } else {
      throw new Error(`Unknown print option: ${option}`);
    }
  }
  return { command, vault, printRequest };
}

async function findDescriptor(explicitVault) {
  const candidates = [];
  if (explicitVault) {
    candidates.push(join(resolve(explicitVault), '.obsidian', 'plugins', 'cimu-print', ENDPOINT_FILENAME));
  }
  if (process.env.CIMU_PRINT_VAULT) {
    candidates.push(join(resolve(process.env.CIMU_PRINT_VAULT), '.obsidian', 'plugins', 'cimu-print', ENDPOINT_FILENAME));
  }
  candidates.push(join(scriptDirectory, ENDPOINT_FILENAME));

  let current = resolve(process.cwd());
  while (true) {
    candidates.push(join(current, '.obsidian', 'plugins', 'cimu-print', ENDPOINT_FILENAME));
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  for (const candidate of [...new Set(candidates)]) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Continue through the deterministic candidate list.
    }
  }
  throw new Error(
    'Could not find a running Cimu Print CLI endpoint. Reload the plugin and pass --vault /path/to/vault.'
  );
}

function callPlugin(descriptor, method, path, body) {
  return new Promise((resolvePromise, reject) => {
    const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body), 'utf8');
    const request = httpRequest({
      hostname: descriptor.host,
      port: descriptor.port,
      path,
      method,
      headers: {
        Authorization: `Bearer ${descriptor.token}`,
        Accept: 'application/json',
        ...(payload ? {
          'Content-Type': 'application/json',
          'Content-Length': String(payload.length)
        } : {})
      },
      timeout: 120_000
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch {
          reject(new Error(`Cimu Print returned an invalid response: ${text.trim()}`));
          return;
        }
        if ((response.statusCode ?? 500) >= 400 || parsed.ok === false) {
          reject(new Error(parsed.error ?? `Cimu Print returned HTTP ${response.statusCode}.`));
          return;
        }
        resolvePromise(parsed);
      });
    });
    request.on('timeout', () => request.destroy(new Error('Cimu Print CLI request timed out.')));
    request.on('error', (error) => reject(new Error(
      `Could not reach the running Cimu Print plugin: ${error.message}`
    )));
    request.end(payload);
  });
}

function validateDescriptor(value) {
  if (!value || value.version !== 1 || value.pluginId !== 'cimu-print'
    || value.host !== '127.0.0.1' || !Number.isInteger(value.port)
    || typeof value.token !== 'string' || value.token.length < 32) {
    throw new Error('The Cimu Print CLI endpoint file is invalid. Reload the plugin.');
  }
}

function requireValue(args, index, option) {
  const value = args[index];
  if (!value || value.startsWith('--')) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

function requireChoice(value, option, choices) {
  if (!choices.includes(value)) {
    throw new Error(`${option} must be one of: ${choices.join(', ')}.`);
  }
  return value;
}

function requireInteger(value, option, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${option} must be an integer from ${minimum} to ${maximum}.`);
  }
  return parsed;
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
