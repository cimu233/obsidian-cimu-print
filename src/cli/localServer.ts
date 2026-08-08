import { CliPrintRequest, CliPrintResult, parseCliPrintRequest } from './protocol';
import { SystemPrinterInfo } from '../printing/systemPrinters';
import { dirnameSystemPath, joinSystemPath } from '../platform/systemPath';

export const CLI_ENDPOINT_FILENAME = 'cimu-print-cli.json';

export interface LocalCliDescriptor {
  version: 1;
  pluginId: 'cimu-print';
  pluginVersion: string;
  vaultPath: string;
  host: '127.0.0.1';
  port: number;
  token: string;
  pid: number;
  startedAt: string;
}

export interface LocalCliHandlers {
  listPrinters: () => Promise<SystemPrinterInfo[]>;
  print: (request: CliPrintRequest) => Promise<CliPrintResult>;
}

export interface LocalCliServer {
  descriptor: LocalCliDescriptor;
  descriptorPath: string;
  stop: () => Promise<void>;
}

interface LocalHttpRequest extends AsyncIterable<unknown> {
  headers: { authorization?: string };
  method?: string;
  url?: string;
}

interface LocalHttpResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(data?: string): void;
}

interface LocalHttpServer {
  listening: boolean;
  once(event: 'error', listener: (error: unknown) => void): void;
  off(event: 'error', listener: (error: unknown) => void): void;
  listen(port: number, host: string, callback: () => void): void;
  address(): string | { port: number } | null;
  close(callback: (error?: unknown) => void): void;
}

interface FileSystemPromises {
  chmod(path: string, mode: number): Promise<unknown>;
  mkdir(path: string, options: { recursive: true }): Promise<unknown>;
  readFile(path: string, encoding: 'utf8'): Promise<string>;
  rename(oldPath: string, newPath: string): Promise<unknown>;
  unlink(path: string): Promise<unknown>;
  writeFile(
    path: string,
    data: string,
    options: { encoding: 'utf8'; mode: number }
  ): Promise<unknown>;
}

interface LocalCliRuntime {
  createServer(
    listener: (request: LocalHttpRequest, response: LocalHttpResponse) => void
  ): LocalHttpServer;
  files: FileSystemPromises;
  pid: number;
  randomHex(byteLength: number): string;
}

interface ElectronCapableWindow extends Window {
  process?: { pid?: unknown };
  require?: (moduleName: string) => unknown;
}

export async function startLocalCliServer(
  pluginDirectory: string,
  vaultPath: string,
  pluginVersion: string,
  handlers: LocalCliHandlers
): Promise<LocalCliServer> {
  const runtime = loadLocalCliRuntime();
  const token = runtime.randomHex(32);
  const server = runtime.createServer((request, response) => {
    void routeRequest(request, response, token, handlers);
  });

  await listenOnLoopback(server);
  const address = server.address();
  if (!address || typeof address === 'string') {
    await closeServer(server);
    throw new Error('Cimu Print CLI could not determine its local port.');
  }

  const descriptor: LocalCliDescriptor = {
    version: 1,
    pluginId: 'cimu-print',
    pluginVersion,
    vaultPath,
    host: '127.0.0.1',
    port: address.port,
    token,
    pid: runtime.pid,
    startedAt: new Date().toISOString()
  };
  const descriptorPath = joinSystemPath(pluginDirectory, CLI_ENDPOINT_FILENAME);

  try {
    await writeDescriptor(runtime, descriptorPath, descriptor);
  } catch (error) {
    await closeServer(server);
    throw normalizeError(error, 'Cimu Print CLI could not publish its endpoint.');
  }

  return {
    descriptor,
    descriptorPath,
    stop: async () => {
      await closeServer(server);
      await removeMatchingDescriptor(runtime, descriptorPath, token);
    }
  };
}

async function routeRequest(
  request: LocalHttpRequest,
  response: LocalHttpResponse,
  token: string,
  handlers: LocalCliHandlers
): Promise<void> {
  applyResponseHeaders(response);
  if (request.headers.authorization !== `Bearer ${token}`) {
    sendJson(response, 401, { ok: false, error: 'Unauthorized local CLI request.' });
    return;
  }

  try {
    if (request.method === 'GET' && request.url === '/v1/status') {
      sendJson(response, 200, { ok: true, status: 'ready' });
      return;
    }
    if (request.method === 'GET' && request.url === '/v1/printers') {
      sendJson(response, 200, { ok: true, printers: await handlers.listPrinters() });
      return;
    }
    if (request.method === 'POST' && request.url === '/v1/print') {
      const body = await readJsonBody(request);
      const result = await handlers.print(parseCliPrintRequest(body));
      sendJson(response, result.submitted ? 200 : 500, { ok: result.submitted, result });
      return;
    }
    sendJson(response, 404, { ok: false, error: 'Unknown Cimu Print CLI endpoint.' });
  } catch (error) {
    const normalized = normalizeError(error, 'The local CLI request failed.');
    sendJson(response, normalized instanceof TypeError || normalized instanceof RangeError ? 400 : 500, {
      ok: false,
      error: normalized.message
    });
  }
}

function listenOnLoopback(server: LocalHttpServer): Promise<void> {
  return new Promise((resolve, reject) => {
    const fail = (error: unknown): void => reject(normalizeError(error, 'The local CLI server failed to start.'));
    server.once('error', fail);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', fail);
      resolve();
    });
  });
}

function closeServer(server: LocalHttpServer): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }
    server.close((error) => {
      if (error === undefined || error === null) {
        resolve();
        return;
      }
      reject(normalizeError(error, 'The local CLI server failed to close.'));
    });
  });
}

async function readJsonBody(request: LocalHttpRequest): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const rawChunk of request) {
    const chunk = toBytes(rawChunk);
    size += chunk.byteLength;
    if (size > 64 * 1024) {
      throw new RangeError('Local CLI request is too large.');
    }
    chunks.push(chunk);
  }
  const text = new TextDecoder().decode(concatenateBytes(chunks, size));
  if (!text.trim()) {
    throw new TypeError('A JSON request body is required.');
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new TypeError('The request body must contain valid JSON.');
  }
}

function applyResponseHeaders(response: LocalHttpResponse): void {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
}

function sendJson(response: LocalHttpResponse, status: number, value: unknown): void {
  response.statusCode = status;
  response.end(`${JSON.stringify(value)}\n`);
}

async function writeDescriptor(
  runtime: LocalCliRuntime,
  path: string,
  descriptor: LocalCliDescriptor
): Promise<void> {
  await runtime.files.mkdir(dirnameSystemPath(path), { recursive: true });
  const temporaryPath = `${path}.${descriptor.pid}.${runtime.randomHex(4)}.tmp`;
  await runtime.files.writeFile(temporaryPath, `${JSON.stringify(descriptor, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600
  });
  await runtime.files.rename(temporaryPath, path);
  await runtime.files.chmod(path, 0o600).catch(() => undefined);
}

async function removeMatchingDescriptor(
  runtime: LocalCliRuntime,
  path: string,
  token: string
): Promise<void> {
  try {
    const current = parseDescriptor(await runtime.files.readFile(path, 'utf8'));
    if (current?.token === token) {
      await runtime.files.unlink(path);
    }
  } catch {
    // A missing or replaced descriptor belongs to no active cleanup operation here.
  }
}

function parseDescriptor(text: string): { token: string } | null {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(value) || typeof value.token !== 'string') {
    return null;
  }
  return { token: value.token };
}

function loadLocalCliRuntime(): LocalCliRuntime {
  const hostWindow = window as ElectronCapableWindow;
  const requireModule = hostWindow.require;
  if (typeof requireModule !== 'function') {
    throw new Error('Cimu Print local CLI requires the Obsidian desktop runtime.');
  }

  const http = requireModule('node:http');
  const fs = requireModule('node:fs');
  if (!isRecord(http) || typeof http.createServer !== 'function') {
    throw new Error('Cimu Print local CLI could not load the local HTTP service.');
  }
  if (!isRecord(fs) || !isRecord(fs.promises) || !isFileSystemPromises(fs.promises)) {
    throw new Error('Cimu Print local CLI could not load filesystem access.');
  }

  const pid = hostWindow.process?.pid;
  if (typeof pid !== 'number' || !Number.isSafeInteger(pid) || pid <= 0) {
    throw new Error('Cimu Print local CLI could not determine the host process ID.');
  }

  const createServer = http.createServer as LocalCliRuntime['createServer'];
  return {
    createServer,
    files: fs.promises,
    pid,
    randomHex: createRandomHex
  };
}

function createRandomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

function toBytes(value: unknown): Uint8Array {
  if (typeof value === 'string') {
    return new TextEncoder().encode(value);
  }
  if (value instanceof Uint8Array) {
    return value;
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new TypeError('The local CLI received an unsupported request body.');
}

function concatenateBytes(chunks: Uint8Array[], totalLength: number): Uint8Array {
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFileSystemPromises(value: Record<string, unknown>): value is Record<string, unknown> & FileSystemPromises {
  return ['chmod', 'mkdir', 'readFile', 'rename', 'unlink', 'writeFile']
    .every((key) => typeof value[key] === 'function');
}

function normalizeError(value: unknown, fallbackMessage: string): Error {
  if (value instanceof Error) {
    return value;
  }
  const detail = typeof value === 'string' && value.trim() ? ` ${value}` : '';
  return new Error(`${fallbackMessage}${detail}`);
}
