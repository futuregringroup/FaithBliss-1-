export const MAX_PROFILE_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const ALLOWED_PROFILE_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const;

type AllowedPhotoType = (typeof ALLOWED_PROFILE_PHOTO_TYPES)[number];

interface FaceDetectorLike {
  detect: (image: ImageBitmapSource) => Promise<unknown[]>;
}

interface FaceDetectorConstructorLike {
  new (options?: { fastMode?: boolean; maxDetectedFaces?: number }): FaceDetectorLike;
}

export interface FaceAnalysisResult {
  supported: boolean;
  faceCount: number | null;
}

export function validatePhotoFileBasics(file: File): string | null {
  if (!ALLOWED_PROFILE_PHOTO_TYPES.includes(file.type as AllowedPhotoType)) {
    return `Invalid file type: ${file.name}. Use JPEG, PNG, or WebP.`;
  }

  if (file.size > MAX_PROFILE_PHOTO_SIZE_BYTES) {
    return `File too large: ${file.name}. Max size is 5MB.`;
  }

  return null;
}

function getFaceDetectorCtor(): FaceDetectorConstructorLike | undefined {
  const maybeDetector = globalThis as typeof globalThis & { FaceDetector?: FaceDetectorConstructorLike };
  return maybeDetector.FaceDetector;
}

export async function analyzePhotoFaces(file: File): Promise<FaceAnalysisResult> {
  const FaceDetectorCtor = getFaceDetectorCtor();
  if (!FaceDetectorCtor || typeof createImageBitmap !== 'function') {
    return { supported: false, faceCount: null };
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const detector = new FaceDetectorCtor({ fastMode: true, maxDetectedFaces: 10 });
    const faces = await detector.detect(bitmap);
    return { supported: true, faceCount: faces.length };
  } catch {
    return { supported: false, faceCount: null };
  } finally {
    if (bitmap) {
      bitmap.close();
    }
  }
}
