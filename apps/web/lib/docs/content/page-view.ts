import type { ReactNode } from "react";

export type DocsPageView = {
  title: string;
  toc: Array<{ id: string; title: string }>;
  /** Sticky “On this page” rail. Omit on short pages that do not scroll. */
  showToc?: boolean;
  previewProject?: unknown;
  body: ReactNode;
};
