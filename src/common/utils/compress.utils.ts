import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import * as sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

export async function compressImage(buffer: Buffer, mimetype: string): Promise<Buffer> {
  return sharp(buffer)
    // .resize({ width: 1280 }) // resize if needed
    .toFormat('webp', { quality: 85 })
    .toBuffer();
}

/**
 * Compresses PDF buffer using Ghostscript (must be installed on the server)
 */
export async function compressPdf(buffer: Buffer): Promise<Buffer> {
  const inputPath = join(tmpdir(), `${uuidv4()}.pdf`);
  const outputPath = join(tmpdir(), `${uuidv4()}-compressed.pdf`);

  writeFileSync(inputPath, buffer);

  try {
    execSync(
      `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/screen -dNOPAUSE -dBATCH -dQUIET -sOutputFile=${outputPath} ${inputPath}`
    );
    const compressed = readFileSync(outputPath);
    return compressed;
  } catch (err) {
    console.error('PDF compression failed:', err);
    return buffer;
  } finally {
    unlinkSync(inputPath);
    try {
      unlinkSync(outputPath);
    } catch (_) {}
  }
}
