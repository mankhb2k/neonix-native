"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppLink } from "@/components/AppLink";
import { EditorShell } from "@/components/editor/EditorShell";
import {
  loadEditorProjectSnapshot,
  type EditorProjectSnapshot,
} from "@/lib/editor/project-storage";

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
      <div className="mv-hub" data-testid="editor-missing">
        <main className="mv-hub-main">
          <h1 className="mv-hub-title">Không tìm thấy dự án</h1>
          <p className="mv-hub-lead">
            Project có thể chỉ lưu trên trình duyệt này. Hãy tạo lại.
          </p>
          <AppLink href="/" className="mv-btn mv-btn-primary mt-6 inline-flex">
            Về workspace
          </AppLink>
        </main>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="mv-hub" data-testid="editor-loading">
        <main className="mv-hub-main">
          <p className="mv-hub-lead">Đang mở AI Studio…</p>
        </main>
      </div>
    );
  }

  return <EditorShell initialSnapshot={snapshot} />;
}
