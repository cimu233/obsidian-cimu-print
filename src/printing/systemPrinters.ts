export interface SystemPrinterInfo {
    name: string;
    displayName: string;
    isDefault: boolean;
}

export interface SystemPrinterOption {
    key: string;
    value: string;
    label: string;
    isDefault: boolean;
}

export interface SystemPrinterCapabilities {
    printerName: string;
    paperSizes: SystemPrinterOption[];
    duplexModes: SystemPrinterOption[];
    colorModes: SystemPrinterOption[];
    qualities: SystemPrinterOption[];
    mediaTypes: SystemPrinterOption[];
}

export interface SystemPrintJobOptions {
    printerName: string;
    copies: number;
    pageRanges: string;
    paperSize?: SystemPrinterOption;
    duplex?: SystemPrinterOption;
    color?: SystemPrinterOption;
    quality?: SystemPrinterOption;
    mediaType?: SystemPrinterOption;
}

export interface SystemPrintSubmission {
    jobId: string;
    output: string;
}

interface SubmitPdfRequest extends SystemPrintJobOptions {
    pdfPath: string;
    title: string;
    pageCount: number;
}

interface SubmitPdfDataRequest extends SystemPrintJobOptions {
    pdfData: Uint8Array;
    title: string;
    pageCount: number;
}

type CupsPrintRequest = SystemPrintJobOptions & {
    pdfPath?: string;
    title: string;
    pageCount: number;
};

interface ExecFileError extends Error {
    code?: string | number;
    stderr?: string;
}

interface NodeProcessLike {
    platform: string;
    env: Record<string, string | undefined>;
}

interface NodeChildProcessLike {
    execFile: (
        command: string,
        args: string[],
        options: {
            encoding: 'utf8';
            env: Record<string, string | undefined>;
            maxBuffer: number;
            windowsHide: boolean;
        },
        callback: (error: ExecFileError | null, stdout: string, stderr: string) => void
    ) => void;
    spawn?: (
        command: string,
        args: string[],
        options: {
            env: Record<string, string | undefined>;
            stdio: ['pipe', 'pipe', 'pipe'];
            windowsHide: boolean;
        }
    ) => {
        stdin: {
            end: (data: Uint8Array) => void;
            on: (event: 'error', listener: (error: Error) => void) => void;
        };
        stdout: { on: (event: 'data', listener: (chunk: unknown) => void) => void };
        stderr: { on: (event: 'data', listener: (chunk: unknown) => void) => void };
        on: {
            (event: 'error', listener: (error: Error) => void): void;
            (event: 'close', listener: (code: number | null) => void): void;
        };
    };
}

interface ElectronCapableWindow extends Window {
    require?: (moduleName: string) => unknown;
}

interface CommandRuntime {
    platform: string;
    environment: Record<string, string | undefined>;
    execFile: NodeChildProcessLike['execFile'];
    spawn?: NodeChildProcessLike['spawn'];
}

export class DirectSystemPrintUnavailableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DirectSystemPrintUnavailableError';
    }
}

export async function listSystemPrinters(): Promise<SystemPrinterInfo[]> {
    const runtime = getCommandRuntime();

    if (runtime.platform === 'darwin' || runtime.platform === 'linux') {
        const [printerNames, defaultDestination] = await Promise.all([
            execCommand(runtime, 'lpstat', ['-e']),
            execCommand(runtime, 'lpstat', ['-d']).catch(() => '')
        ]);
        return parseCupsPrinterList(printerNames, defaultDestination);
    }

    if (runtime.platform === 'win32') {
        const output = await execPowerShell(runtime, WINDOWS_LIST_PRINTERS_SCRIPT);
        return parseWindowsPrinterList(output);
    }

    throw new DirectSystemPrintUnavailableError(`Unsupported operating system: ${runtime.platform}`);
}

export async function getSystemPrinterCapabilities(
    printerName: string
): Promise<SystemPrinterCapabilities> {
    const runtime = getCommandRuntime();

    if (runtime.platform === 'darwin' || runtime.platform === 'linux') {
        const output = await execCommand(runtime, 'lpoptions', ['-p', printerName, '-l']);
        return parseCupsPrinterCapabilities(printerName, output);
    }

    if (runtime.platform === 'win32') {
        const output = await execPowerShell(
            runtime,
            WINDOWS_PRINTER_CAPABILITIES_SCRIPT,
            { OBSIDIAN_PRINT_PRINTER: printerName }
        );
        return parseWindowsPrinterCapabilities(printerName, output);
    }

    throw new DirectSystemPrintUnavailableError(`Unsupported operating system: ${runtime.platform}`);
}

export function supportsDirectSystemPrint(): boolean {
    try {
        const { platform } = getCommandRuntime();
        return platform === 'darwin' || platform === 'linux';
    } catch {
        return false;
    }
}

export async function submitPdfToSystemPrinter(
    request: SubmitPdfRequest
): Promise<SystemPrintSubmission> {
    const runtime = getCommandRuntime();
    if (runtime.platform !== 'darwin' && runtime.platform !== 'linux') {
        throw new DirectSystemPrintUnavailableError(
            'Direct PDF submission is currently available through CUPS on macOS and Linux.'
        );
    }

    const args = buildCupsPrintArguments(request);
    const output = await execCommand(runtime, 'lp', args);
    return {
        jobId: parseCupsJobId(output),
        output: output.trim()
    };
}

export async function submitPdfDataToSystemPrinter(
    request: SubmitPdfDataRequest
): Promise<SystemPrintSubmission> {
    const runtime = getCommandRuntime();
    if (runtime.platform !== 'darwin' && runtime.platform !== 'linux') {
        throw new DirectSystemPrintUnavailableError(
            'In-memory PDF submission is currently available through CUPS on macOS and Linux.'
        );
    }

    const args = buildCupsPrintArguments(request);
    const output = await execCommandWithInput(runtime, 'lp', args, request.pdfData);
    return {
        jobId: parseCupsJobId(output),
        output: output.trim()
    };
}

export function parseCupsPrinterList(
    printerNamesOutput: string,
    defaultDestinationOutput: string
): SystemPrinterInfo[] {
    const defaultMatch = defaultDestinationOutput.trim().match(/[:：]\s*([^:：\r\n]+)\s*$/);
    const defaultName = defaultMatch?.[1]?.trim() ?? '';
    const names = Array.from(new Set(
        printerNamesOutput
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
    ));

    return names.map((name) => ({
        name,
        displayName: name.replace(/_/g, ' '),
        isDefault: name === defaultName
    }));
}

export function parseCupsPrinterCapabilities(
    printerName: string,
    output: string
): SystemPrinterCapabilities {
    const groups = new Map<string, SystemPrinterOption[]>();

    output.split(/\r?\n/).forEach((line) => {
        const match = line.match(/^([^/\s]+)\/([^:]+):\s*(.*)$/);
        if (!match) {
            return;
        }

        const [, key, groupLabel, rawValues] = match;
        const values = rawValues
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .map((rawValue) => {
                const isDefault = rawValue.startsWith('*');
                const value = isDefault ? rawValue.slice(1) : rawValue;
                return {
                    key,
                    value,
                    label: formatPrinterOptionLabel(key, value, groupLabel),
                    isDefault
                };
            });
        groups.set(key, values);
    });

    return {
        printerName,
        paperSizes: firstCupsGroup(groups, ['PageSize', 'media']),
        duplexModes: firstCupsGroup(groups, ['Duplex', 'sides']),
        colorModes: firstCupsGroup(groups, ['ColorModel', 'print-color-mode']),
        qualities: firstCupsGroup(groups, ['cupsPrintQuality', 'print-quality']),
        mediaTypes: firstCupsGroup(groups, ['MediaType', 'media-type'])
    };
}

export function validatePageRanges(value: string, pageCount: number): string {
    const normalized = value.replace(/\s+/g, '');
    if (!normalized) {
        return '';
    }

    const parts = normalized.split(',');
    for (const part of parts) {
        const match = part.match(/^(\d+)(?:-(\d+))?$/);
        if (!match) {
            throw new RangeError('Invalid page range syntax.');
        }

        const start = Number(match[1]);
        const end = Number(match[2] ?? match[1]);
        if (start < 1 || end < start || end > pageCount) {
            throw new RangeError('Page range is outside the generated PDF.');
        }
    }

    return parts.join(',');
}

export function buildCupsPrintArguments(request: CupsPrintRequest): string[] {
    const copies = Math.max(1, Math.min(999, Math.trunc(request.copies)));
    const pageRanges = validatePageRanges(request.pageRanges, request.pageCount);
    const args = ['-d', request.printerName, '-t', request.title, '-n', String(copies)];

    if (pageRanges) {
        args.push('-o', `page-ranges=${pageRanges}`);
    }

    [request.paperSize, request.duplex, request.color, request.quality, request.mediaType]
        .filter((option): option is SystemPrinterOption => Boolean(option?.key && option.value))
        .forEach((option) => args.push('-o', `${option.key}=${option.value}`));

    if (request.pdfPath) {
        args.push(request.pdfPath);
    }
    return args;
}

function parseCupsJobId(output: string): string {
    const requestMatch = output.match(/\b([\w.-]+-\d+)\b/);
    return requestMatch?.[1] ?? output.trim();
}

function firstCupsGroup(
    groups: Map<string, SystemPrinterOption[]>,
    keys: string[]
): SystemPrinterOption[] {
    for (const key of keys) {
        const values = groups.get(key);
        if (values) {
            return values;
        }
    }
    return [];
}

function formatPrinterOptionLabel(key: string, value: string, fallback: string): string {
    const labels: Record<string, string> = {
        None: 'Off',
        DuplexNoTumble: 'Long edge',
        DuplexTumble: 'Short edge',
        'one-sided': 'Off',
        'two-sided-long-edge': 'Long edge',
        'two-sided-short-edge': 'Short edge',
        Gray: 'Grayscale',
        monochrome: 'Grayscale',
        RGB: 'Color',
        color: 'Color',
        Draft: 'Draft',
        Normal: 'Normal',
        High: 'High',
        auto: 'Automatic'
    };
    return labels[value] ?? (key === 'PageSize' || key === 'media' ? value : humanize(value, fallback));
}

function humanize(value: string, fallback: string): string {
    const normalized = value
        .replace(/^com\.[^.]+\./, '')
        .replace(/[._-]+/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .trim();
    return normalized || fallback;
}

function parseWindowsPrinterList(output: string): SystemPrinterInfo[] {
    const parsed = parseJsonArray<{ name?: string; displayName?: string; isDefault?: boolean }>(output);
    return parsed
        .filter((printer) => printer.name)
        .map((printer) => ({
            name: printer.name as string,
            displayName: printer.displayName || printer.name as string,
            isDefault: Boolean(printer.isDefault)
        }));
}

function parseWindowsPrinterCapabilities(
    printerName: string,
    output: string
): SystemPrinterCapabilities {
    const parsed = JSON.parse(output) as Record<string, unknown>;
    return {
        printerName,
        paperSizes: parseWindowsOptions('PageMediaSizeName', parsed.paperSizes),
        duplexModes: parseWindowsOptions('Duplexing', parsed.duplexModes),
        colorModes: parseWindowsOptions('OutputColor', parsed.colorModes),
        qualities: parseWindowsOptions('OutputQuality', parsed.qualities),
        mediaTypes: []
    };
}

function parseWindowsOptions(key: string, value: unknown): SystemPrinterOption[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.map((item) => ({
        key,
        value: String(item),
        label: humanize(String(item), String(item)),
        isDefault: false
    }));
}

function parseJsonArray<T>(output: string): T[] {
    const parsed = JSON.parse(output) as T | T[] | null;
    if (!parsed) {
        return [];
    }
    return Array.isArray(parsed) ? parsed : [parsed];
}

function getCommandRuntime(): CommandRuntime {
    const requireModule = (window as ElectronCapableWindow).require;
    if (typeof requireModule !== 'function') {
        throw new DirectSystemPrintUnavailableError('Node services are unavailable in this window.');
    }

    const childProcess = requireModule('child_process') as NodeChildProcessLike;
    const nodeProcess = requireModule('process') as NodeProcessLike;
    if (!childProcess?.execFile || !nodeProcess?.platform) {
        throw new DirectSystemPrintUnavailableError('System print services are unavailable.');
    }

    return {
        platform: nodeProcess.platform,
        environment: nodeProcess.env ?? {},
        execFile: childProcess.execFile,
        spawn: childProcess.spawn
    };
}

function commandEnvironment(
    runtime: CommandRuntime,
    extraEnvironment: Record<string, string> = {}
): Record<string, string | undefined> {
    return {
        ...runtime.environment,
        LC_ALL: 'C',
        LANG: 'C',
        ...extraEnvironment
    };
}

function execCommand(
    runtime: CommandRuntime,
    command: string,
    args: string[],
    extraEnvironment: Record<string, string> = {}
): Promise<string> {
    return new Promise((resolve, reject) => {
        runtime.execFile(command, args, {
            encoding: 'utf8',
            env: commandEnvironment(runtime, extraEnvironment),
            maxBuffer: 4 * 1024 * 1024,
            windowsHide: true
        }, (error, stdout, stderr) => {
            if (error) {
                error.stderr = stderr;
                reject(error);
                return;
            }
            resolve(stdout);
        });
    });
}

function execCommandWithInput(
    runtime: CommandRuntime,
    command: string,
    args: string[],
    input: Uint8Array
): Promise<string> {
    return new Promise((resolve, reject) => {
        if (!runtime.spawn) {
            reject(new DirectSystemPrintUnavailableError('Streaming print services are unavailable.'));
            return;
        }

        const child = runtime.spawn(command, args, {
            env: commandEnvironment(runtime),
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true
        });
        let stdout = '';
        let stderr = '';
        let settled = false;
        const fail = (error: Error) => {
            if (!settled) {
                settled = true;
                reject(error);
            }
        };

        child.stdout.on('data', (chunk) => {
            stdout += String(chunk);
        });
        child.stderr.on('data', (chunk) => {
            stderr += String(chunk);
        });
        child.stdin.on('error', fail);
        child.on('error', fail);
        child.on('close', (code) => {
            if (settled) {
                return;
            }
            settled = true;
            if (code === 0) {
                resolve(stdout);
                return;
            }
            const error = new Error(stderr.trim() || `${command} exited with code ${code ?? 'unknown'}.`) as ExecFileError;
            error.code = code ?? undefined;
            error.stderr = stderr;
            reject(error);
        });
        child.stdin.end(input);
    });
}

function execPowerShell(
    runtime: CommandRuntime,
    script: string,
    extraEnvironment: Record<string, string> = {}
): Promise<string> {
    return execCommand(
        runtime,
        'powershell.exe',
        ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script],
        extraEnvironment
    );
}

const WINDOWS_LIST_PRINTERS_SCRIPT = String.raw`
$printers = @(Get-CimInstance Win32_Printer | ForEach-Object {
    [pscustomobject]@{
        name = [string]$_.Name
        displayName = [string]$_.Name
        isDefault = [bool]$_.Default
    }
})
$printers | ConvertTo-Json -Compress
`;

const WINDOWS_PRINTER_CAPABILITIES_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName ReachFramework
$server = [System.Printing.LocalPrintServer]::new()
$queue = $server.GetPrintQueue($env:OBSIDIAN_PRINT_PRINTER)
$capabilities = $queue.GetPrintCapabilities()
[pscustomobject]@{
    paperSizes = @($capabilities.PageMediaSizeCapability | ForEach-Object { [string]$_.PageMediaSizeName })
    duplexModes = @($capabilities.DuplexingCapability | ForEach-Object { [string]$_ })
    colorModes = @($capabilities.OutputColorCapability | ForEach-Object { [string]$_ })
    qualities = @($capabilities.OutputQualityCapability | ForEach-Object { [string]$_ })
} | ConvertTo-Json -Compress
`;
