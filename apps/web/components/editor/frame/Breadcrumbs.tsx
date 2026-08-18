/**
 * Breadcrumbs — group drill-down trail mirroring clipkit's
 * `frame/Breadcrumbs.tsx`. Renders "Composition › Group › …" and lets the
 * user click any crumb to pop back out to that depth.
 */

import { resolveGroupPath, type MotionLayer } from "@motionvideo/editor-core";

export interface BreadcrumbsProps {
  /** Root layers (the whole document's top level). */
  layers: readonly MotionLayer[];
  /** Group ids currently entered, outermost first. */
  groupPath: readonly string[];
  /** Pop back out to a depth (0 = composition root). */
  onNavigate: (depth: number) => void;
}

export function Breadcrumbs({
  layers,
  groupPath,
  onNavigate,
}: BreadcrumbsProps) {
  if (groupPath.length === 0) return null;
  const { crumbs } = resolveGroupPath(layers, groupPath);

  return (
    <div className="flex items-center gap-1 px-2 py-1 text-[12px] text-zinc-400">
      <button
        type="button"
        className="rounded px-1 py-0.5 hover:bg-zinc-800 hover:text-zinc-200"
        onClick={() => onNavigate(0)}
      >
        Composition
      </button>
      {crumbs.map((group, i) => (
        <span key={group.id} className="flex items-center gap-1">
          <span className="text-zinc-600">›</span>
          <button
            type="button"
            className={`rounded px-1 py-0.5 hover:bg-zinc-800 ${
              i === crumbs.length - 1 ? "text-zinc-100" : "hover:text-zinc-200"
            }`}
            onClick={() => onNavigate(i + 1)}
          >
            {group.name ?? group.id}
          </button>
        </span>
      ))}
    </div>
  );
}
