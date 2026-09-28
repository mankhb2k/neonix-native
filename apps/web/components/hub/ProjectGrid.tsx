"use client";

import { useRouter } from "next/navigation";
import { useTranslations, useFormatter } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { removeProject } from "@/lib/api/projects";
import { appUrl, previewUrl } from "@/lib/hosts";

export type ProjectCardData = {
  projectId: string;
  title: string;
  href: string;
  layers: string;
  duration: string;
  updatedAt: string;
  accent: string;
};

type MenuPosition = { x: number; y: number };

function useUpdatedLabel(updatedAt: string) {
  const t = useTranslations("ProjectGrid");
  const format = useFormatter();

  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return t("updatedRecently");
  return t("updatedAt", { time: format.relativeTime(date, new Date()) });
}

function ProjectCard({ project, onRemoved }: { project: ProjectCardData; onRemoved: (projectId: string) => void }) {
  const t = useTranslations("ProjectGrid");
  const updatedLabel = useUpdatedLabel(project.updatedAt);
  const [menu, setMenu] = useState<MenuPosition | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!menu) return undefined;
    function closeMenu(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(null);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenu(null);
    }
    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menu]);

  async function confirmRemoveProject() {
    setRemoving(true);
    setError(null);
    try {
      await removeProject(project.projectId);
      setConfirming(false);
      onRemoved(project.projectId);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("removeDialog.error"));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <>
      <a
        href={previewUrl(`/preview/${project.projectId}`)}
        onContextMenu={(event) => {
          event.preventDefault();
          setError(null);
          setMenu({
            x: Math.min(event.clientX, window.innerWidth - 220),
            y: Math.min(event.clientY, window.innerHeight - 170),
          });
        }}
        className="min-w-0 overflow-hidden rounded-xl border border-[var(--hub-border)] bg-[var(--hub-card-bg)] no-underline"
      >
        <div className={`relative aspect-video overflow-hidden bg-gradient-to-br ${project.accent}`}>
          <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(135deg,transparent_35%,rgba(255,255,255,0.08)_36%,transparent_37%),linear-gradient(45deg,transparent_48%,rgba(34,211,238,0.12)_49%,transparent_50%)] [background-size:32px_32px,48px_48px]" />
          <span className="absolute bottom-3 left-3 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-caption font-medium text-slate-200 backdrop-blur-sm">Neonix JSON V2</span>
          <span className="absolute right-3 bottom-3 rounded-md bg-black/45 px-2 py-1 font-mono text-caption text-slate-200 backdrop-blur-sm">{project.duration}</span>
        </div>
        <div className="space-y-1.5 px-4 py-3.5">
          <h3 className="truncate text-base font-semibold text-[var(--fg-primary)]">{project.title}</h3>
          <p className="pt-1 font-mono text-caption text-[var(--fg-muted)]">{project.layers} · {updatedLabel}</p>
        </div>
      </a>

      {menu ? (
        <div ref={menuRef} role="menu" aria-label={t("actionsAriaLabel", { title: project.title })} className="fixed z-50 min-w-56 rounded-xl border border-[var(--hub-border)] bg-[var(--hub-card-bg)] p-1.5 shadow-[0_18px_50px_rgba(15,23,42,0.18)]" style={{ left: menu.x, top: menu.y }}>
          <button type="button" role="menuitem" onClick={() => { setMenu(null); window.location.assign(appUrl(project.href)); }} className="block w-full rounded-lg px-3 py-2.5 text-left text-base font-medium text-[var(--fg-primary)] hover:bg-[var(--hub-hover)]">{t("menu.openEditor")}</button>
          <button type="button" role="menuitem" onClick={() => { setMenu(null); window.location.assign(previewUrl(`/preview/${project.projectId}`)); }} className="block w-full rounded-lg px-3 py-2.5 text-left text-base font-medium text-[var(--fg-primary)] hover:bg-[var(--hub-hover)]">{t("menu.openPreview")}</button>
          <div className="my-1 border-t border-[var(--hub-border)]" />
          <button type="button" role="menuitem" onClick={() => { setMenu(null); setConfirming(true); }} className="block w-full rounded-lg px-3 py-2.5 text-left text-base font-medium text-red-600 hover:bg-red-50">{t("menu.remove")}</button>
        </div>
      ) : null}

      {confirming ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/30 px-5" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby={`remove-project-${project.projectId}`} className="w-full max-w-md rounded-2xl border border-[var(--hub-border)] bg-[var(--hub-card-bg)] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.2)]">
            <h2 id={`remove-project-${project.projectId}`} className="text-xl font-semibold text-[var(--fg-primary)]">{t("removeDialog.title")}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--fg-muted)]">{t("removeDialog.body", { title: project.title })}</p>
            {error ? <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" disabled={removing} onClick={() => { setConfirming(false); setError(null); }} className="rounded-lg border border-[var(--hub-border)] px-4 py-2 text-sm font-medium text-[var(--fg-primary)] hover:bg-[var(--hub-hover)] disabled:opacity-60">{t("removeDialog.cancel")}</button>
              <button type="button" disabled={removing} onClick={() => void confirmRemoveProject()} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">{removing ? t("removeDialog.confirming") : t("removeDialog.confirm")}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function ProjectGrid({ projects: initialProjects }: { projects: ProjectCardData[] }) {
  const [projects, setProjects] = useState(initialProjects);
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {projects.map((project) => (
        <ProjectCard key={project.projectId} project={project} onRemoved={(projectId) => setProjects((current) => current.filter((item) => item.projectId !== projectId))} />
      ))}
    </div>
  );
}
