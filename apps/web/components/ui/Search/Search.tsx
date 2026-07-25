import React from "react";
import { Search as SearchIcon } from "lucide-react";

export interface SearchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  // Add custom props if needed
}

export function Search({ className, ...props }: SearchProps) {
  return (
    <div className={`relative flex items-center w-full ${className || ""}`}>
      <SearchIcon className="absolute left-3 text-[var(--fg-muted)]" size={16} strokeWidth={2} />
      <input
        type="text"
        className="w-full h-[32px] bg-[var(--bg-hover)] border border-[var(--line-strong)] rounded-md pl-9 pr-3 text-[13px] text-[var(--fg)] placeholder:text-[var(--fg-muted)] outline-none"
        placeholder="Tìm kiếm..."
        {...props}
      />
    </div>
  );
}
