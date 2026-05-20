import { getAuth } from 'firebase/auth';

const API_URL = import.meta.env.VITE_API_URL || '';

if (!import.meta.env.VITE_API_URL) {
  console.error('[cloudinaryUpload] VITE_API_URL is not set. Upload requests will fail.');
}

// 90s upper bound for photo uploads. Generous enough for 3–6 photos on a
// 3G/Edge connection, short enough that a hung network produces a clear
// error instead of trapping the user on the onboarding screen.
const PHOTO_UPLOAD_TIMEOUT_MS = 90_000;

export const uploadPhotosToCloudinary = async (files: File[]) => {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) throw new Error('User not authenticated');

  const token = await user.getIdToken();

  const formData = new FormData();
  files.forEach((file) => formData.append('photos', file));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PHOTO_UPLOAD_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/uploads/upload-photos`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
      signal: controller.signal,
    });
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') {
      throw new Error(
        'Photo upload timed out. Please check your internet connection and try again.',
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    let errorMessage = 'Upload failed';

    try {
      const errorData = await res.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch {
      try {
        const errorText = await res.text();
        if (errorText.trim()) {
          errorMessage = errorText.trim();
        }
      } catch {
        // Fall back to the default message.
      }
    }

    throw new Error(errorMessage);
  }

  const data = await res.json();
  return data.urls as string[];
};
