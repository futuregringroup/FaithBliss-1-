import { getAuth } from 'firebase/auth';

const API_URL = import.meta.env.VITE_API_URL || '';

if (!import.meta.env.VITE_API_URL) {
  console.error('[cloudinaryUpload] VITE_API_URL is not set. Upload requests will fail.');
}

export const uploadPhotosToCloudinary = async (files: File[]) => {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) throw new Error('User not authenticated');

  const token = await user.getIdToken(); 

  const formData = new FormData();
  files.forEach((file) => formData.append('photos', file));

  const res = await fetch(`${API_URL}/api/uploads/upload-photos`, { // <-- FIX IS HERE
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`, 
    },
    body: formData,
  });

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
