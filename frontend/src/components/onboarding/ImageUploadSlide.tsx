import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, UploadCloud, X } from 'lucide-react';
import React from 'react';
import type { OnboardingData } from './types';
import { analyzePhotoFaces, validatePhotoFileBasics } from '@/utils/photoValidation';
import { MIN_ONBOARDING_PHOTOS } from '@/constants/onboarding';

interface ImageUploadSlideProps {
  onboardingData: OnboardingData;
  setOnboardingData: React.Dispatch<React.SetStateAction<OnboardingData>>;
  isVisible: boolean;
}
 
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

const ImageUploadSlide = ({ onboardingData, setOnboardingData, isVisible }: ImageUploadSlideProps) => {
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState<File[]>(onboardingData.photos || []);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    const newPreviews = photos.map((file) => URL.createObjectURL(file));
    setPhotoPreviews(newPreviews);

    return () => {
      newPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photos]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setHint(null);
    const files = event.target.files;
    if (!files) return;

    setUploading(true);
    const newFiles = Array.from(files);
    const acceptedFiles: File[] = [];
    const warnings: string[] = [];
    let nextSlotIndex = photos.length;

    try {
      for (const file of newFiles) {
        if (nextSlotIndex >= 6) break;

        const basicValidationError = validatePhotoFileBasics(file);
        if (basicValidationError) {
          setError(basicValidationError);
          return;
        }

        const faceAnalysis = await analyzePhotoFaces(file);

        if (nextSlotIndex === 0 && faceAnalysis.supported && faceAnalysis.faceCount !== 1) {
          setError('Primary photo must contain one clear face. Upload a clear solo photo.');
          return;
        }

        if (faceAnalysis.supported && (faceAnalysis.faceCount ?? 0) > 1) {
          warnings.push(`Photo ${nextSlotIndex + 1} looks like a group photo. Solo photos usually perform better.`);
        } else if (faceAnalysis.supported && faceAnalysis.faceCount === 0) {
          warnings.push(`Photo ${nextSlotIndex + 1} has no clear face detected. Use a clearer face photo.`);
        } else if (!faceAnalysis.supported && nextSlotIndex === 0) {
          warnings.push('Thank you for uploading your photo. Your images are securely stored and protected in our database.');
        }

        acceptedFiles.push(file);
        nextSlotIndex += 1;
      }

      if (acceptedFiles.length === 0) {
        return;
      }

      const combinedPhotos = [...photos, ...acceptedFiles].slice(0, 6);
      setPhotos(combinedPhotos);
      setOnboardingData((prev) => ({ ...prev, photos: combinedPhotos }));
      if (warnings.length > 0) {
        setHint(warnings[0]);
      }
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const removePhoto = (indexToRemove: number) => {
    const newPhotos = photos.filter((_, index) => index !== indexToRemove);
    setPhotos(newPhotos);
    setOnboardingData((prev) => ({ ...prev, photos: newPhotos }));
  };

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.5 }}
      className="space-y-8"
    >
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white">Upload Your Photos</h2>
        <p className="text-gray-400">Add 3-6 photos. The first three are required. Max 5MB each.</p>
        <p className="mt-2 text-sm text-cyan-300">Upload a clear solo photo as your first image.</p>
      </div>

      {error && (
        <div className="relative flex items-center rounded-lg border border-red-500 bg-red-900/50 px-4 py-3 text-red-300">
          <AlertCircle className="mr-2" />
          <span>{error}</span>
        </div>
      )}

      {hint && !error && (
        <div className="relative flex items-center rounded-lg border border-cyan-500/60 bg-cyan-900/40 px-4 py-3 text-cyan-200">
          <AlertCircle className="mr-2" />
          <span>{hint}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {photoPreviews.map((previewUrl, index) => (
          <div key={index} className="group relative h-40 w-full">
            <img src={previewUrl} alt={`photo-${index}`} className="absolute inset-0 h-full w-full rounded-lg object-cover" />
            <button
              onClick={() => removePhoto(index)}
              className="absolute right-2 top-2 z-10 rounded-full bg-red-500 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              <X size={16} />
            </button>
          </div>
        ))}

        {photos.length < 6 && (
          <div className="relative flex h-40 items-center justify-center rounded-lg border-2 border-dashed border-gray-600">
            <input
              type="file"
              multiple
              accept={ALLOWED_FILE_TYPES.join(',')}
              onChange={handleFileUpload}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              disabled={uploading || photos.length >= 6}
            />
            {uploading ? (
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
            ) : (
              <div className="text-center text-gray-400">
                <UploadCloud size={32} className="mx-auto" />
                <p>Upload</p>
              </div>
            )}
          </div>
        )}
      </div>

      {onboardingData.photos.length < MIN_ONBOARDING_PHOTOS && (
        <p className="text-center font-semibold text-red-500">
          Kindly upload at least {MIN_ONBOARDING_PHOTOS} photos to continue.
        </p>
      )}
    </motion.div>
  );
};

export default ImageUploadSlide;
