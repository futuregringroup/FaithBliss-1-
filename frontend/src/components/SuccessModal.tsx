/* eslint-disable no-irregular-whitespace */
// src/components/SuccessModal.tsx (Recommended path)

import { CheckCircle, Heart, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  autoCloseMs?: number;
}

export const SuccessModal = ({
  isOpen,
  onClose,
  title = "Welcome to FaithBliss!",
  message = "Your account has been created successfully. Let's complete your profile to find your perfect match.",
  autoCloseMs = 3000,
}: SuccessModalProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);

      if (autoCloseMs > 0) {
        const timer = setTimeout(() => {
          setIsVisible(false);
          setTimeout(onClose, 300); // Wait for fade out animation
        }, autoCloseMs);

        return () => clearTimeout(timer);
      }
    } else {
      setIsVisible(false);
    }
  }, [isOpen, onClose, autoCloseMs]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className={`
    bg-gradient-to-br from-gray-800 to-gray-900 
    rounded-2xl shadow-2xl border border-gray-700/50 
    p-8 max-w-md w-full text-center
    transform transition-all duration-300 ease-out
    ${isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"}
   `}
      >
        {/* Success animation */}
        <div className="relative mb-6">
          <div className="relative flex items-center justify-center">
            {/* Animated rings */}
            <div className="absolute w-24 h-24 rounded-full border-2 border-green-500/30 animate-ping"></div>
            <div
              className="absolute w-20 h-20 rounded-full border-2 border-green-400/20 animate-ping"
              style={{ animationDelay: "0.5s" }}
            ></div>

            {/* Success checkmark with heart */}
            <div className="relative z-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full p-4">
              <CheckCircle className="w-12 h-12 text-white" />
            </div>

            {/* Floating hearts */}
            <Heart
              className="absolute top-0 right-0 w-6 h-6 text-pink-400 animate-bounce"
              fill="currentColor"
              style={{ animationDelay: "0.2s" }}
            />
            <Sparkles
              className="absolute bottom-0 left-0 w-5 h-5 text-yellow-400 animate-pulse"
              style={{ animationDelay: "0.8s" }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">
            {title}
          </h2>

          <p className="text-gray-300 leading-relaxed">{message}</p>

          {/* Progress dots */}
          <div className="flex justify-center space-x-2 pt-4">
            <div
              className="w-2 h-2 bg-green-500 rounded-full animate-bounce"
              style={{ animationDelay: "0s" }}
            ></div>
            <div
              className="w-2 h-2 bg-green-500 rounded-full animate-bounce"
              style={{ animationDelay: "0.1s" }}
            ></div>
            <div
              className="w-2 h-2 bg-green-500 rounded-full animate-bounce"
              style={{ animationDelay: "0.2s" }}
            ></div>
          </div>
        </div>

        {/* Manual close button (optional) */}
        {autoCloseMs === 0 && (
          <button
            onClick={() => {
              setIsVisible(false);
              setTimeout(onClose, 300);
            }}
            className="mt-6 bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-2 rounded-full font-medium hover:from-green-600 hover:to-green-700 transition-all duration-200"
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
};
