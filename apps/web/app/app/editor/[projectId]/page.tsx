"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppLink } from "@/components/AppLink";
import { EditorShell } from "@/components/editor/EditorShell";
import {
  loadEditorProjectSnapshot,
  type EditorProjectSnapshot,
} from "@/lib/editor/project-storage";

const hubBg =
  "min-h-screen text-[var(--fg-primary)] [background:radial-gradient(ellipse_70%_45%_at_12%_-8%,rgba(13,148,136,0.1)_0%,transparent_55%),radial-gradient(ellipse_55%_40%_at_92%_8%,rgba(2,132,199,0.08)_0%,transparent_50%),var(--bg-app)]";

export default function EditorPage() {
  const params = useParams<{ projectId: string }>();
  const [snapshot, setSnapshot] = useState<EditorProjectSnapshot | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const found = loadEditorProjectSnapshot(params.projectId);
    if (!found) {
      setMissing(true);
      return;
    }
    setSnapshot(found);
  }, [params.projectId]);

  if (missing) {
    return (
      <div className={hubBg} data-testid="editor-missing">
        <main className="mx-auto max-w-[920px] px-6 pt-11 pb-16">
          <h1 className="mb-3 font-semibold tracking-[-0.03em] text-[var(--fg-primary)] [font-family:var(--font-display)] [font-size:clamp(1.85rem,4vw,2.55rem)] [line-height:1.12]">
            Không tìm thấy dự án
          </h1>
          <p className="m-0 max-w-[36rem] text-[1.05rem] leading-[1.65] text-[var(--fg-muted)]">
            Project có thể chỉ lưu trên trình duyệt này. Hãy tạo lại.
          </p>
          <AppLink
            href="/"
            className="mt-6 inline-flex h-10 items-center justify-center rounded-full border border-transparent bg-[var(--accent)] px-4 font-semibold text-[var(--accent-on)] no-underline shadow-[0_6px_18px_rgba(13,148,136,0.28)] transition hover:-translate-y-px hover:bg-[var(--accent-hover)]"
          >
            Về workspace
          </AppLink>
        </main>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className={hubBg} data-testid="editor-loading">
        <main className="mx-auto max-w-[920px] px-6 pt-11 pb-16">
          <p className="m-0 max-w-[36rem] text-[1.05rem] leading-[1.65] text-[var(--fg-muted)]">
            Đang mở AI Studio…
          </p>
        </main>
      </div>
    );
  }

  return <EditorShell initialSnapshot={snapshot} />;
}
