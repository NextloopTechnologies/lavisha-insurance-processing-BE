// Uses the real AWS presigner: signing is local (no network), so this checks the actual URL S3 would receive.
process.env.AWS_REGION = 'ap-south-1';
process.env.AWS_BUCKET_NAME = 'unit-test-bucket';
process.env.AWS_ACCESS_KEY = 'AKIAUNITTEST';
process.env.AWS_SECRET_KEY = 'unit-test-secret';

import { FileService } from './file.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('FileService.getPresignedUrl', () => {
  const service = new FileService({} as PrismaService);
  const key = 'claims/scan_674b86d2-4255-458a-aa7b-8e5d40ce9627.webp';

  it('view URL: signed GET for the key, no Content-Disposition override', async () => {
    const url = new URL(await service.getPresignedUrl(key));
    expect(url.host).toBe('unit-test-bucket.s3.ap-south-1.amazonaws.com');
    expect(url.pathname).toBe(`/${key}`);
    expect(url.searchParams.get('X-Amz-Expires')).toBe('10800');
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
    expect(url.searchParams.has('response-content-disposition')).toBe(false);
  });

  it('download URL: asks S3 to send Content-Disposition: attachment with the original name, inside the signature', async () => {
    const url = new URL(await service.getPresignedUrl(key, undefined, { asAttachment: true }));
    expect(url.searchParams.get('response-content-disposition')).toBe(
      `attachment; filename="scan.webp"; filename*=UTF-8''scan.webp`,
    );
    // the parameter is part of the signed query string, so it cannot be stripped or altered by a client
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('host');
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
    const viewSig = new URL(await service.getPresignedUrl(key)).searchParams.get('X-Amz-Signature');
    expect(url.searchParams.get('X-Amz-Signature')).not.toBe(viewSig);
  });
});
