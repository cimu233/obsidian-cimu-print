import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LocalCliServer, startLocalCliServer } from '../src/cli/localServer';

let server: LocalCliServer | null = null;

afterEach(async () => {
  await server?.stop();
  server = null;
});

describe('local CLI server', () => {
  it('publishes a user-readable endpoint and requires its bearer token', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cimu-print-cli-'));
    server = await startLocalCliServer(directory, '/vault', '1.0.0', {
      listPrinters: async () => [{
        name: 'Office_Printer',
        displayName: 'Office Printer',
        isDefault: true
      }],
      print: async (request) => ({
        submitted: true,
        file: request.file,
        printer: request.printer ?? 'Office_Printer',
        duplex: request.duplex ?? 'printer-default',
        scale: request.scale ?? 100,
        style: request.style ?? 'obsidian'
      })
    });

    const stored = JSON.parse(await readFile(server.descriptorPath, 'utf8')) as {
      token: string;
      port: number;
    };
    expect(stored.token).toBe(server.descriptor.token);
    if (process.platform !== 'win32') {
      expect((await stat(server.descriptorPath)).mode & 0o777).toBe(0o600);
    }

    const unauthorized = await call(server, 'GET', '/v1/status');
    expect(unauthorized.status).toBe(401);

    const printers = await call(server, 'GET', '/v1/printers', undefined, true);
    expect(printers.status).toBe(200);
    expect(printers.json.printers).toHaveLength(1);

    const printed = await call(server, 'POST', '/v1/print', {
      file: 'Test.md',
      duplex: 'short-edge',
      scale: 75,
      style: 'plain'
    }, true);
    expect(printed.status).toBe(200);
    expect(printed.json.result).toMatchObject({
      submitted: true,
      file: 'Test.md',
      duplex: 'short-edge',
      scale: 75,
      style: 'plain'
    });
  });
});

function call(
  activeServer: LocalCliServer,
  method: string,
  path: string,
  body?: unknown,
  authorize = false
): Promise<{ status: number; json: Record<string, any> }> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
    const request = httpRequest({
      hostname: activeServer.descriptor.host,
      port: activeServer.descriptor.port,
      path,
      method,
      headers: {
        ...(authorize ? { Authorization: `Bearer ${activeServer.descriptor.token}` } : {}),
        ...(payload ? {
          'Content-Type': 'application/json',
          'Content-Length': String(payload.length)
        } : {})
      }
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      response.on('end', () => resolve({
        status: response.statusCode ?? 0,
        json: JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, any>
      }));
    });
    request.on('error', reject);
    request.end(payload);
  });
}
