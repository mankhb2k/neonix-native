"use client";

import { useEffect, useState } from "react";
import { AppLink } from "@/components/AppLink";
import { listProjects, type StoredProject } from "@/lib/project-storage";

export function ProjectList() {
  const [items, setItems] = useState<StoredProject[]>([]);

  useEffect(() => {
    setItems(listProjects());
  }, []);

  if (items.length === 0) {
    return (
      <div className="mv-card-grid">
        <div className="mv-card">
          <h3>Chưa có dự án</h3>
          <p>Tạo TVC đầu tiên từ template F&B tiếng Việt.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mv-card-grid">
      {items.map(({ project, savedAt }) => (
        <AppLink
          key={project.id}
          href={`/editor/${project.id}`}
          className="mv-card"
        >
          <h3>{project.brand.name}</h3>
          <p>
            {project.industry ?? "general"} · {project.aspectRatio} ·{" "}
            {project.scenes.length} scene
          </p>
          <p style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
            {new Date(savedAt).toLocaleString("vi-VN")}
          </p>
        </AppLink>
      ))}
    </div>
  );
}
