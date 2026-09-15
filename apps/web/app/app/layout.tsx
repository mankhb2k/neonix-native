import type { ReactNode } from "react";

export default function AppRootLayout({ children }: { children: ReactNode }) {
  // Keep the app route on the light root theme. The editor adds its focused
  // dark surface in its own nested layout so preview pages stay light.
  return <div className="min-h-screen">{children}</div>;
}
