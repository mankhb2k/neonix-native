"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { MotionProject } from "@motionvideo/motion-schema";
import { EditorShell } from "@/components/editor/EditorShell";
import { AppLink } from "@/components/AppLink";
import { loadProject, saveProject } from "@/lib/project-storage";
import { useEditorStore } from "@/lib/store/editor-store";

export default function EditorPage() {
  const params = useParams<{ projectId: string }>();
  const [initial, setInitial] = useState<MotionProject | null>(null);
  const [missing, setMissing] = useState(false);
  const project = useEditorStore((s) => s.project);

  useEffect(() => {
    const found = loadProject(params.projectId);
    if (!found) {
      setMissing(true);
      return;
    }
    setInitial(found);
  }, [params.projectId]);

  useEffect(() => {
    if (project && project.id === params.projectId) {
      saveProject(project);
    }
  }, [project, params.projectId]);

  if (missing) {
    return (
      <div className="mv-hub">
        <main className="mv-hub-main">
          <h1 className="mv-hub-title">Không tìm thấy dự án</h1>
          <p className="mv-hub-lead">
            Project có thể chỉ lưu trên trình duyệt này. Hãy tạo lại.
          </p>
          <AppLink href="/projects/new" className="mv-btn mv-btn-primary">
            Tạo dự án mới
          </AppLink>
        </main>
      </div>
    );
  }

  if (!initial) {
    return (
      <div className="mv-hub">
        <main className="mv-hub-main">
          <p className="mv-hub-lead">Đang mở editor…</p>
        </main>
      </div>
    );
  }

  return <EditorShell initialProject={initial} />;
}
