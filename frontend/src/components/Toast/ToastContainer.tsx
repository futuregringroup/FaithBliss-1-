/* eslint-disable no-irregular-whitespace */
// src/components/Toast/ToastContainer.tsx

import React from "react";
import type { Toast } from "@/contexts/ToastContext"; // Import from the context file
// Import from the context file
import { ToastItem } from "@/components/Toast/ToastItem"; // Assuming this component exists

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onRemove,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-3 sm:right-5 z-[170] pointer-events-none">
      <div className="flex flex-col items-end gap-2 w-[min(360px,calc(100vw-1.5rem))]">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onRemove={() => onRemove(toast.id)}
          />
        ))}
      </div>
    </div>
  );
};
