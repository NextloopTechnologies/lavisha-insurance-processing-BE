// Stored keys look like `claims/<safeName>_<uuid><ext>` (see FileService.uploadFile).
const UUID_SUFFIX = /_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\.[^.]+$|$)/i;

/** The name a user should see / save: folder and upload UUID removed, extension kept. */
export function downloadNameFromKey(key: string): string {
  const base = key.split('/').pop() || 'document';
  const name = base.replace(UUID_SUFFIX, '');
  // nothing left but the extension (e.g. "_<uuid>.png"): avoid a hidden ".png" file
  return !name || name.startsWith('.') ? `document${name}` : name;
}

/**
 * Content-Disposition that makes the browser save the file instead of showing it.
 * `filename` is an ASCII fallback; `filename*` carries the exact name (RFC 6266 / 5987).
 */
export function attachmentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(fileName).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
