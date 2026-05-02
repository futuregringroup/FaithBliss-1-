/* eslint-disable no-irregular-whitespace */
import { Heart } from "lucide-react";
// Note: Ensure your index.css file (or equivalent) contains the .mini-heartbeat class

interface HeartBeatIconProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const HeartBeatIcon = ({
  size = "md",
  className = "",
}: HeartBeatIconProps) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  return (
    <Heart
      className={`${sizeClasses[size]} text-current mini-heartbeat ${className}`}
      fill="currentColor"
    />
  );
};
