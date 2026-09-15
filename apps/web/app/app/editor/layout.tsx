import type { ReactNode } from "react";

export default function EditorLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="dark" className="min-h-screen">
      {children}
    </div>
  );
}
