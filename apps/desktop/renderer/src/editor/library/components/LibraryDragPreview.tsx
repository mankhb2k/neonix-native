import { useEffect, useState } from "react";
import {
  getLibraryDragSession,
  subscribeLibraryDrag,
  type LibraryDragSession,
} from "../interactions/library-drag-session";

/** Floating preview — session UI only, never written into the document. */
export function LibraryDragPreview() {
  const [session, setSession] = useState<LibraryDragSession | null>(() =>
    getLibraryDragSession(),
  );

  useEffect(() => subscribeLibraryDrag(setSession), []);

  if (!session?.active) return null;

  return (
    <div
      className="library-drag-preview"
      style={{
        position: "fixed",
        left: session.clientX + 12,
        top: session.clientY + 12,
        pointerEvents: "none",
        zIndex: 2000,
        padding: "6px 10px",
        borderRadius: 6,
        background: "var(--panel)",
        border: "1px solid var(--border)",
        color: "var(--fg)",
        fontSize: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      }}
    >
      {session.item.label}
    </div>
  );
}
