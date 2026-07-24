import type { ReactNode } from "react";

import "./appai.css";

export default function AppAiLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="aiRenew">{children}</div>;
}
