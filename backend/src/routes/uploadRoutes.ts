import express from 'express';
import multer from 'multer';
import { storage } from '../config/cloudinaryConfig';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

const imageFileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
    const error = new Error('Invalid image type. Use JPEG, PNG, or WebP.') as Error & { statusCode?: number };
    error.statusCode = 400;
    cb(error);
    return;
  }
  cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: MAX_PHOTO_SIZE_BYTES },
  fileFilter: imageFileFilter,
});

router.post('/upload-photo', protect, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const photoUrl = req.file.path;
    return res.status(200).json({ url: photoUrl });
  } catch (error: unknown) {
    const knownError = error as { message?: string };
    console.error(knownError);
    return res.status(500).json({ error: knownError.message || 'Upload failed' });
  }
});

router.post('/upload-photos', protect, upload.array('photos', 6), async (req, res) => {
  try {
    if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const urls = (req.files as Express.Multer.File[]).map((file) => file.path);
    return res.status(200).json({ urls });
  } catch (error: unknown) {
    const knownError = error as { message?: string };
    console.error(knownError);
    return res.status(500).json({ error: knownError.message || 'Upload failed' });
  }
});

export default router;
