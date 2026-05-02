/* eslint-disable no-irregular-whitespace */
// src/components/auth/PopupInstruction.tsx (Recommended path)

import { AlertCircle, X } from "lucide-react";
// The 'use client' directive is harmless in a Vite project, so it can be kept or removed.

interface PopupInstructionProps {
  show: boolean;
  onDismiss: () => void;
}

export const PopupInstruction = ({
  show,
  onDismiss,
}: PopupInstructionProps) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-start gap-3 mb-4">
          <AlertCircle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-2">
              Allow Popups for Google Sign-In
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Your browser blocked the Google sign-in popup. To continue:
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <ol className="text-sm text-gray-600 space-y-2 mb-4 ml-4">
          <li>1. Look for a popup blocker icon in your address bar</li>
          <li>
            2. Click it and select &quot;Always allow popups from this
            site&quot;
          </li>
          <li>3. Refresh the page and try signing in again</li>
        </ol>

        <div className="flex gap-3">
          <button
            onClick={onDismiss}
            className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors"
          >
            Got it
          </button>
          <button
            onClick={() => {
              window.location.reload();
              onDismiss();
            }}
            className="flex-1 px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-xl transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    </div>
  );
};
