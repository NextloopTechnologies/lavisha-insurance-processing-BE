import { existsSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { execFile } from 'child_process';
import * as sharp from 'sharp';
import { COMPRESSED_IMAGE_EXT, COMPRESSED_IMAGE_MIME } from '../constants/file.constants';
import { compressImage, compressPdf } from './compress.utils';

jest.mock('child_process', () => ({ execFile: jest.fn() }));

const execFileMock = execFile as unknown as jest.Mock;

type ExecCallback = (err: Error | null, result?: { stdout: string; stderr: string }) => void;
const outputPathOf = (args: string[]) =>
  (args.find((a) => a.startsWith('-sOutputFile=')) ?? '').replace('-sOutputFile=', '');
const callArgs = (i = 0) => execFileMock.mock.calls[i] as [string, string[], Record<string, unknown>];
const inputPathOf = (args: string[]) => args[args.length - 1];

describe('compressImage', () => {
  const isWebp = (b: Buffer) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP';
  const sample = (format: 'jpeg' | 'png' | 'webp') =>
    sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 200, g: 30, b: 30 } } }).toFormat(format).toBuffer();

  it.each(['jpeg', 'png', 'webp'] as const)('re-encodes %s input as WebP', async (format) => {
    const out = await compressImage(await sample(format), `image/${format}`);
    expect(isWebp(out)).toBe(true);
  });

  it('exposes the stored extension and content type that match its output', () => {
    expect(COMPRESSED_IMAGE_EXT).toBe('.webp');
    expect(COMPRESSED_IMAGE_MIME).toBe('image/webp');
  });
});

describe('compressPdf', () => {
  beforeEach(() => execFileMock.mockReset());

  it('runs gs through execFile (no shell) with -dSAFER, a timeout and SIGKILL', async () => {
    execFileMock.mockImplementation((_cmd: string, args: string[], _opts: object, cb: ExecCallback) => {
      writeFileSync(outputPathOf(args), 'compressed');
      cb(null, { stdout: '', stderr: '' });
    });

    const result = await compressPdf(Buffer.from('%PDF-original'));

    expect(result.toString()).toBe('compressed');
    const [cmd, args, opts] = callArgs();
    expect(cmd).toBe('gs');
    expect(Array.isArray(args)).toBe(true);
    expect(args).toEqual(expect.arrayContaining(['-dSAFER', '-sDEVICE=pdfwrite', '-dNOPAUSE', '-dBATCH']));
    expect(opts).toEqual({ timeout: 60_000, killSignal: 'SIGKILL' });
    expect(opts).not.toHaveProperty('shell');
  });

  it('only passes server-generated temp paths to gs', async () => {
    execFileMock.mockImplementation((_cmd: string, args: string[], _opts: object, cb: ExecCallback) => {
      writeFileSync(outputPathOf(args), 'x');
      cb(null, { stdout: '', stderr: '' });
    });

    await compressPdf(Buffer.from('%PDF'));

    const args = callArgs()[1];
    const uuidPdf = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(-compressed)?\.pdf$/;
    expect(inputPathOf(args).startsWith(tmpdir())).toBe(true);
    expect(inputPathOf(args)).toMatch(uuidPdf);
    expect(outputPathOf(args).startsWith(tmpdir())).toBe(true);
    expect(outputPathOf(args)).toMatch(uuidPdf);
  });

  it('removes both temp files after a successful run', async () => {
    let paths: string[] = [];
    execFileMock.mockImplementation((_cmd: string, args: string[], _opts: object, cb: ExecCallback) => {
      paths = [inputPathOf(args), outputPathOf(args)];
      writeFileSync(paths[1], 'x');
      cb(null, { stdout: '', stderr: '' });
    });

    await compressPdf(Buffer.from('%PDF'));

    expect(paths).toHaveLength(2);
    paths.forEach((p) => expect(existsSync(p)).toBe(false));
  });

  it('returns the original buffer and cleans up when gs fails', async () => {
    let input = '';
    execFileMock.mockImplementation((_cmd: string, args: string[], _opts: object, cb: ExecCallback) => {
      input = inputPathOf(args);
      expect(existsSync(input)).toBe(true);
      cb(new Error('gs: unrecoverable error'));
    });
    const original = Buffer.from('%PDF-broken');

    const result = await compressPdf(original);

    expect(result).toBe(original);
    expect(existsSync(input)).toBe(false);
  });

  it('returns the original buffer when gs is killed by the timeout', async () => {
    execFileMock.mockImplementation((_cmd: string, _args: string[], _opts: object, cb: ExecCallback) => {
      cb(Object.assign(new Error('Command failed'), { killed: true, signal: 'SIGKILL' }));
    });
    const original = Buffer.from('%PDF-slow');

    expect(await compressPdf(original)).toBe(original);
  });

  it('never runs more than 2 gs processes at once and finishes every request', async () => {
    let active = 0;
    let maxActive = 0;
    execFileMock.mockImplementation((_cmd: string, args: string[], _opts: object, cb: ExecCallback) => {
      active++;
      maxActive = Math.max(maxActive, active);
      setTimeout(() => {
        writeFileSync(outputPathOf(args), 'done');
        active--;
        cb(null, { stdout: '', stderr: '' });
      }, 20);
    });

    const results = await Promise.all(Array.from({ length: 7 }, () => compressPdf(Buffer.from('%PDF'))));

    expect(maxActive).toBe(2);
    expect(execFileMock).toHaveBeenCalledTimes(7);
    results.forEach((r) => expect(r.toString()).toBe('done'));
  });

  it('frees the slot when a run fails, so queued requests still complete', async () => {
    let call = 0;
    execFileMock.mockImplementation((_cmd: string, args: string[], _opts: object, cb: ExecCallback) => {
      call++;
      const fail = call <= 2;
      setTimeout(() => {
        if (fail) return cb(new Error('boom'));
        writeFileSync(outputPathOf(args), 'ok');
        cb(null, { stdout: '', stderr: '' });
      }, 10);
    });

    const results = await Promise.all(Array.from({ length: 5 }, (_, i) => compressPdf(Buffer.from(`orig-${i}`))));

    expect(results.map((r) => r.toString())).toEqual(['orig-0', 'orig-1', 'ok', 'ok', 'ok']);
  });
});
