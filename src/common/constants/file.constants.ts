export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
// multer/busboy flags a file as over the limit once it reaches fileSize bytes,
// so the stream limit is one byte above MAX_FILE_SIZE to still accept exactly 10MB
export const MULTER_FILE_SIZE_LIMIT = MAX_FILE_SIZE + 1;
export const MAX_BULK_FILES = 6;

// compressImage re-encodes every image to WebP; stored keys and Content-Type must match
export const COMPRESSED_IMAGE_EXT = '.webp';
export const COMPRESSED_IMAGE_MIME = 'image/webp';

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/jpg',
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];