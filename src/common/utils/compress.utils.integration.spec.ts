import { spawnSync } from 'child_process';
import { compressPdf } from './compress.utils';

// Runs real Ghostscript; skipped on machines without `gs` on PATH.
const hasGs = spawnSync('gs', ['--version']).status === 0;
const describeIfGs = hasGs ? describe : describe.skip;

// smallest valid one-page PDF with a text object
function minimalPdf(): Buffer {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    null, // content stream, filled below
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const stream = 'BT /F1 12 Tf 20 100 Td (lavisha test) Tj ET';
  objects[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;

  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(body));
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefAt = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => (body += `${String(o).padStart(10, '0')} 00000 n \n`));
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(body);
}

describeIfGs('compressPdf with real Ghostscript', () => {
  jest.setTimeout(120_000);

  it('produces a valid PDF from a valid PDF', async () => {
    const input = minimalPdf();
    const output = await compressPdf(input);

    expect(output.subarray(0, 5).toString()).toBe('%PDF-');
    expect(output.equals(input)).toBe(false); // rewritten by gs, not the fallback
    expect(output.toString('latin1')).toContain('%%EOF');
  });

  it('returns the original bytes for a file that is not a PDF', async () => {
    const garbage = Buffer.from('this is not a pdf at all');
    const output = await compressPdf(garbage);
    expect(output.equals(garbage)).toBe(true);
  });

  it('keeps the event loop free while gs runs (the old execSync blocked it)', async () => {
    let ticks = 0;
    const timer = setInterval(() => ticks++, 10);
    try {
      await compressPdf(minimalPdf());
    } finally {
      clearInterval(timer);
    }
    expect(ticks).toBeGreaterThan(5);
  });

  it('handles several concurrent PDFs', async () => {
    const outputs = await Promise.all(Array.from({ length: 4 }, () => compressPdf(minimalPdf())));
    outputs.forEach((o) => expect(o.subarray(0, 5).toString()).toBe('%PDF-'));
  });
});
