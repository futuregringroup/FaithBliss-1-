// src/middleware/uploadMiddleware.ts

import fs from 'fs';
import multer from 'multer';
import path from 'path';

const uploadDir = path.join(__dirname, '../../uploads/photos');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Magic-byte signatures for allowed image formats.
// Multer streams the file to disk before fileFilter runs, so we read the saved
// file back to verify its actual content — not just the declared MIME type.
const IMAGE_SIGNATURES: Array<{ bytes: number[]; offset?: number }> = [
  { bytes: [0xff, 0xd8, 0xff] },                          // JPEG
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }, // PNG
  { bytes: [0x47, 0x49, 0x46, 0x38] },                    // GIF87a / GIF89a
  { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 },         // WebP (RIFF header)
];

const hasValidMagicBytes = (filePath: string): boolean => {
  let fd: number | null = null;
  try {
    fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(12);
    fs.readSync(fd, header, 0, 12, 0);
    return IMAGE_SIGNATURES.some(({ bytes, offset = 0 }) =>
      bytes.every((b, i) => header[offset + i] === b)
    );
  } catch {
    return false;
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch { /* ignore */ }
    }
  }
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `photo-${Date.now()}-${safeName}`);
  },
});

export const uploadPhotos = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMime = /^image\/(jpeg|jpg|png|gif|webp)$/;
    const allowedExt = /\.(jpe?g|png|gif|webp)$/i;

    if (!allowedMime.test(file.mimetype) || !allowedExt.test(file.originalname)) {
      return cb(new Error('Only JPEG, PNG, GIF, and WebP images are allowed'));
    }
    cb(null, true);
  },
});

// Call after Multer saves the file to verify magic bytes match the declared type.
export const verifyUploadedFileMagicBytes = (filePath: string): boolean => {
  return hasValidMagicBytes(filePath);
};