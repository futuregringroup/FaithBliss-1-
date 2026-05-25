import React from 'react';
import { Sparkles, Upload, X } from 'lucide-react';
import type { ProfileData } from '@/types/profile';

interface PhotosSectionProps {
  profileData: ProfileData;
  handlePhotoUpload: (event: React.ChangeEvent<HTMLInputElement>, slotIndex: number) => void;
  removePhoto: (index: number) => void;
}

const PhotosSection = ({ profileData, handlePhotoUpload, removePhoto }: PhotosSectionProps) => {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-gray-700/50 bg-gray-800/50 p-8">
        <div className="mb-8 text-center">
          <h2 className="mb-2 text-2xl font-bold text-white">Your Photos</h2>
          <p className="text-gray-400">Add up to 6 photos that show your personality</p>
          <p className="mt-2 text-sm text-cyan-300">Upload a clear solo photo as your first image.</p>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {profileData.photos.map((photo, index) => (
            <div key={index} className="group relative aspect-[3/4] overflow-hidden rounded-2xl bg-gray-700">
              {photo ? (
                <>
                  <img src={photo} alt={`Profile ${index + 1}`} className="absolute left-0 top-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => removePhoto(index)}
                      className="rounded-full bg-red-500 p-2 text-white transition-colors hover:bg-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {index === 0 && (
                    <div className="absolute left-3 top-3 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 px-3 py-1 text-xs font-bold text-white">
                      MAIN
                    </div>
                  )}
                </>
              ) : (
                <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/3 transition-all hover:border-pink-400/50 hover:bg-pink-500/5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-all group-hover:border-pink-400/30 group-hover:bg-pink-500/10">
                    <Upload className="h-5 w-5 text-slate-500 transition-colors group-hover:text-pink-400" />
                  </div>
                  <span className="text-xs font-medium text-slate-500 transition-colors group-hover:text-pink-300">Add Photo</span>
                  {index === 0 && (
                    <span className="text-[10px] text-slate-600 transition-colors group-hover:text-pink-400/70">Primary</span>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => handlePhotoUpload(event, index)}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-pink-500/20 bg-gradient-to-r from-pink-500/10 to-purple-500/10 p-6">
          <div className="flex items-start space-x-3">
            <Sparkles className="mt-1 h-5 w-5 text-pink-400" />
            <div>
              <h3 className="mb-1 font-semibold text-pink-300">Photo Tips</h3>
              <ul className="space-y-1 text-sm text-gray-300">
                <li>- Use recent photos that clearly show your face</li>
                <li>- Keep your main photo solo, without group shots</li>
                <li>- Include close-ups, full body, and activities you enjoy</li>
                <li>- Smile naturally and let your personality show</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhotosSection;
