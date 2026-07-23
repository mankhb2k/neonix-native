import React from "react";
import { cn } from "@/lib/utils";

export interface MediaItemProps {
  title: string;
  thumbnailUrl?: string;
  duration?: string;
  isAdded?: boolean;
  logoUrl?: string;
  logoText?: string;
  className?: string;
  onClick?: () => void;
}

export function MediaItem({
  title,
  thumbnailUrl,
  duration,
  isAdded,
  logoUrl,
  logoText,
  className,
  onClick,
}: MediaItemProps) {
  return (
    <div className={cn("flex flex-col gap-1.5 w-full cursor-pointer group", className)} onClick={onClick}>
      <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-[#27272A] border-2 border-transparent transition-all group-hover:border-[var(--line-strong)]">
        {/* Background Image */}
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#27272A] to-[#18181B]" />
        )}

        {/* Added Badge */}
        {isAdded && (
          <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/60 backdrop-blur-sm text-white text-[10px] rounded-sm font-medium">
            Đã thêm
          </div>
        )}

        {/* Duration Badge */}
        {duration && (
          <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 backdrop-blur-sm text-white text-[10px] rounded-sm font-medium">
            {duration}
          </div>
        )}

        {/* Logo / Brand Text */}
        {(logoUrl || logoText) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            {logoUrl && (
              <div className="w-8 h-8 rounded-full overflow-hidden bg-black/40 p-1 backdrop-blur-sm flex items-center justify-center">
                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
              </div>
            )}
            {logoText && (
              <span className="text-white text-[10px] font-semibold tracking-wide drop-shadow-md">
                {logoText}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Title */}
      <div className="text-[12px] font-medium text-[var(--fg)] truncate w-full px-0.5 group-hover:text-[var(--accent)] transition-colors">
        {title}
      </div>
    </div>
  );
}
