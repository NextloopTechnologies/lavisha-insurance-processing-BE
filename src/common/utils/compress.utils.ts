import { readFile, writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import * as sharp from 'sharp';

const execFileAsync = promisify(execFile);

const PDF_COMPRESS_TIMEOUT_MS = 60_000;
const MAX_CONCURRENT_PDF_COMPRESSIONS = 2;

export async function compressImage(buffer: Buffer, mimetype: string): Promise<Buffer> {
  return sharp(buffer)
    // .resize({ width: 1280 }) // resize if needed
    .toFormat('webp', { quality: 85 })
    .toBuffer();
}

// simple semaphore so a burst of uploads can't spawn unbounded Ghostscript processes
let activePdfCompressions = 0;
const pdfCompressionQueue: Array<() => void> = [];

async function acquirePdfSlot(): Promise<void> {
  if (activePdfCompressions < MAX_CONCURRENT_PDF_COMPRESSIONS) {
    activePdfCompressions++;
    return;
  }
  await new Promise<void>(resolve => pdfCompressionQueue.push(resolve));
}

function releasePdfSlot(): void {
  const next = pdfCompressionQueue.shift();
  if (next) next();
  else activePdfCompressions--;
}

/**
 * Compresses PDF buffer using Ghostscript (must be installed on the server).
 * Runs asynchronously with a timeout so untrusted PDFs can't block the event loop.
 */
export async function compressPdf(buffer: Buffer): Promise<Buffer> {
  const inputPath = join(tmpdir(), `${randomUUID()}.pdf`);
  const outputPath = join(tmpdir(), `${randomUUID()}-compressed.pdf`);

  await acquirePdfSlot();
  try {
    await writeFile(inputPath, buffer);
    await execFileAsync(
      'gs',
      [
        '-dSAFER',
        '-sDEVICE=pdfwrite',
        '-dCompatibilityLevel=1.4',
        '-dPDFSETTINGS=/screen',
        '-dNOPAUSE',
        '-dBATCH',
        '-dQUIET',
        `-sOutputFile=${outputPath}`,
        inputPath,
      ],
      { timeout: PDF_COMPRESS_TIMEOUT_MS, killSignal: 'SIGKILL' }
    );
    return await readFile(outputPath);
  } catch (err) {
    console.error('PDF compression failed:', err);
    return buffer;
  } finally {
    releasePdfSlot();
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}
