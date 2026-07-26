"use client";

import { useState } from "react";
import { AppLink } from "@/components/AppLink";
import { NewProjectModal } from "@/components/hub/NewProjectModal";
import { ProjectList } from "@/components/hub/ProjectList";
import { marketingUrl } from "@/lib/hosts";

export function WorkspaceHome() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="mv-hub">
      <header className="mv-hub-header">
        <AppLink href="/" className="mv-hub-brand">
          MotionVideo
        </AppLink>
        <nav className="mv-hub-nav">
          <button
            type="button"
            className="mv-link-btn"
            onClick={() => setModalOpen(true)}
          >
            Tạo TVC
          </button>
          <a href={marketingUrl("/")}>Landing</a>
        </nav>
      </header>
      <main className="mv-hub-main">
        <p className="mv-hub-kicker">Workspace</p>
        <h1 className="mv-hub-title">Tạo TVC motion 2D tiếng Việt</h1>
        <p className="mv-hub-lead">
          Đặt tên và chọn tỉ lệ — màu, chữ, CTA chỉnh tiếp trong editor.
        </p>
        <button
          type="button"
          className="mv-btn mv-btn-primary"
          onClick={() => setModalOpen(true)}
        >
          Tạo dự án mới
        </button>
        <ProjectList />
      </main>
      <NewProjectModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
