import { attachmentDisposition, downloadNameFromKey } from './file-name.utils';

describe('downloadNameFromKey', () => {
  it.each([
    ['claims/scan_674b86d2-4255-458a-aa7b-8e5d40ce9627.webp', 'scan.webp'],
    ['claims/Discharge_Summary_0aa1b2c3-1111-4222-8333-944455556666.pdf', 'Discharge_Summary.pdf'],
    ['hospitals/rates_0aa1b2c3-1111-4222-8333-944455556666.xlsx', 'rates.xlsx'],
    ['claims/legacy-name.pdf', 'legacy-name.pdf'],
    ['claims/_0aa1b2c3-1111-4222-8333-944455556666.png', 'document.png'],
    ['claims/_0aa1b2c3-1111-4222-8333-944455556666', 'document'],
    ['no-folder_0aa1b2c3-1111-4222-8333-944455556666.jpg', 'no-folder.jpg'],
  ])('%s -> %s', (key, expected) => {
    expect(downloadNameFromKey(key)).toBe(expected);
  });
});

describe('attachmentDisposition', () => {
  it('builds an attachment header with an ASCII fallback and an exact UTF-8 name', () => {
    expect(attachmentDisposition('scan.webp')).toBe(`attachment; filename="scan.webp"; filename*=UTF-8''scan.webp`);
  });

  it('cannot be broken out of with quotes, and encodes non-ASCII names', () => {
    const header = attachmentDisposition('ré"port\\.pdf');
    expect(header).toBe(`attachment; filename="r__port_.pdf"; filename*=UTF-8''r%C3%A9%22port%5C.pdf`);
  });
});
