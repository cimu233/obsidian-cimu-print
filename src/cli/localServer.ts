import { randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { join } from 'node:path';
import process from 'node:process';
import { CliPrintRequest, CliPrintResult, parseCliPrintRequest } from './protocol';
import { SystemPrinterInfo } from '../printing/systemPrinters';

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

export async function startLocalCliServer(
  pluginDirectory: string,
  vaultPath: string,
  pluginVersion: string,
  handlers: LocalCliHandlers
): Promise<LocalCliServer> {
  const token = randomBytes(32).toString('hex');
  const server = createServer((request, response) => {
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
    pid: process.pid,
    startedAt: new Date().toISOString()
  };
  const descriptorPath = join(pluginDirectory, CLI_ENDPOINT_FILENAME);

  try {
    await writeDescriptor(descriptorPath, descriptor);
  } catch (error) {
    await closeServer(server);
    throw error;
  }

  return {
    descriptor,
    descriptorPath,
    stop: async () => {
      await closeServer(server);
      await removeMatchingDescriptor(descriptorPath, token);
    }
  };
}

async function routeRequest(
  request: IncomingMessage,
  response: ServerResponse,
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
    const message = error instanceof Error ? error.message : String(error);
    sendJson(response, error instanceof TypeError || error instanceof RangeError ? 400 : 500, {
      ok: false,
      error: message
    });
  }
}

function listenOnLoopback(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    const fail = (error: Error) => reject(error);
    server.once('error', fail);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', fail);
      resolve();
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 64 * 1024) {
      throw new RangeError('Local CLI request is too large.');
    }
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text.trim()) {
    throw new TypeError('A JSON request body is required.');
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new TypeError('The request body must contain valid JSON.');
  }
}

function applyResponseHeaders(response: ServerResponse): void {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.statusCode = status;
  response.end(`${JSON.stringify(value)}\n`);
}

async function writeDescriptor(path: string, descriptor: LocalCliDescriptor): Promise<void> {
  await mkdir(join(path, '..'), { recursive: true });
  const temporaryPath = `${path}.${descriptor.pid}.${randomBytes(4).toString('hex')}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(descriptor, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600
  });
  await rename(temporaryPath, path);
  await chmod(path, 0o600).catch(() => undefined);
}

async function removeMatchingDescriptor(path: string, token: string): Promise<void> {
  try {
    const current = JSON.parse(await readFile(path, 'utf8')) as Partial<LocalCliDescriptor>;
    if (current.token === token) {
      await unlink(path);
    }
  } catch {
    // A missing or replaced descriptor belongs to no active cleanup operation here.
  }
}
