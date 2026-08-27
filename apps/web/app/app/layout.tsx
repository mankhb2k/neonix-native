import type { ReactNode } from "react";

export default function AppRootLayout({ children }: { children: ReactNode }) {
  // The editor workspace keeps its focused dark surface while the public
  // control plane and docs use the light root theme by default.
  return (
    <div data-theme="dark" className="min-h-screen">
      {children}
    </div>
  );
}
