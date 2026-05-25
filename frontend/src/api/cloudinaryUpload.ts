const CLOUDINARY_CLOUD_NAME = 'dygdz7cla';
const CLOUDINARY_UPLOAD_PRESET = 'FaithBliss Upload';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

const PHOTO_UPLOAD_TIMEOUT_MS = 90_000;

const uploadSinglePhoto = async (file: File, index: number): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  // public_id must not include a folder path when folder is set separately
  formData.append('public_id', `profile_${index}_${Date.now()}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PHOTO_UPLOAD_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(CLOUDINARY_UPLOAD_URL, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') {
      throw new Error('Photo upload timed out. Please check your internet connection and try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    let errorMessage = 'Upload failed';
    try {
      const errorData = await res.json();
      errorMessage = errorData.error?.message || errorMessage;
    } catch {
      // fall through
    }
    throw new Error(errorMessage);
  }

  const data = await res.json();
  return data.secure_url as string;
};

export const uploadPhotosToCloudinary = async (files: File[]): Promise<string[]> => {
  // Upload all photos in parallel directly to Cloudinary — bypasses Vercel's 4.5MB limit
  const urls = await Promise.all(files.map((file, i) => uploadSinglePhoto(file, i)));
  return urls;
};
