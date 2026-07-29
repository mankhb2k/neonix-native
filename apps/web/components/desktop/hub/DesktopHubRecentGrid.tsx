"use client";

import { useEffect, useState } from "react";
import { AppLink } from "@/components/AppLink";
import {
  listProjects,
  deleteProject,
  saveProject,
  type StoredProject,
} from "@/lib/editor/project-storage";
import {
  LayoutGrid,
  List,
  ArrowUpDown,
  Smartphone,
  Tv,
  Square,
  Trash2,
  Copy,
  ExternalLink,
  Plus,
} from "lucide-react";

type Props = {
  onCreateNew: () => void;
};

export function DesktopHubRecentGrid({ onCreateNew }: Props) {
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "name" | "scenes">("recent");

  function reloadProjects() {
    setProjects(listProjects());
  }

  useEffect(() => {
    reloadProjects();
  }, []);

  function handleDelete(id: string, name: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`Bạn có chắc muốn xóa dự án "${name}"?`)) {
      deleteProject(id);
      reloadProjects();
    }
  }

  function handleDuplicate(stored: StoredProject, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const newId = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const copy = {
      ...stored.project,
      metadata: {
        ...stored.project.metadata,
        id: newId,
        brand: {
          ...stored.project.metadata.brand,
          name: `${stored.project.metadata.brand.name} (Bản sao)`,
        },
      },
    };
    saveProject(copy);
    reloadProjects();
  }

  // Filter & Sort
  const filtered = projects.filter((p) =>
    p.project.metadata.brand.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "name") {
      return a.project.metadata.brand.name.localeCompare(b.project.metadata.brand.name);
    }
    if (sortBy === "scenes") {
      return b.project.scenes.length - a.project.scenes.length;
    }
    return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
  });

  function formatTimeAgo(dateString: string) {
    const elapsed = Date.now() - new Date(dateString).getTime();
    const seconds = Math.floor(elapsed / 1000);
    if (seconds < 60) return `${seconds} giây trước`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    return `${days} ngày trước`;
  }

  return (
    <main className="flex-1 bg-[#1c1c1f] p-8 overflow-y-auto select-none">
      {/* Title */}
      <h1 className="text-xl font-medium text-white mb-6">Dự án gần đây</h1>

      {/* Toolbar / Sort & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 text-[12px] text-[#909095]">
        {/* Left: Sort controls */}
        <div className="flex items-center gap-2">
          <span>Sắp xếp</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-[#242428] text-white border border-[#35353a] rounded px-2 py-1 outline-none cursor-pointer"
          >
            <option value="recent">Gần đây nhất</option>
            <option value="name">Tên dự án</option>
            <option value="scenes">Số phân cảnh</option>
          </select>
          <button
            type="button"
            className="p-1 rounded hover:bg-[#28282c] text-[#a0a0a5] hover:text-white transition-colors"
            title="Đổi hướng sắp xếp"
          >
            <ArrowUpDown size={14} />
          </button>
        </div>

        {/* Right: Search filter & Grid/List View Toggle */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span>Tìm kiếm</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Lọc dự án..."
              className="bg-transparent border-b border-[#404045] text-white text-[12px] px-1 py-0.5 outline-none focus:border-[#d9381e] placeholder:text-[#55555a] w-44"
            />
          </div>

          <div className="flex items-center gap-1 bg-[#242428] border border-[#35353a] rounded p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`p-1 rounded transition-colors ${
                viewMode === "list"
                  ? "bg-[#38383e] text-white"
                  : "text-[#707075] hover:text-white"
              }`}
              title="Xem dạng danh sách"
            >
              <List size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`p-1 rounded transition-colors ${
                viewMode === "grid"
                  ? "bg-[#38383e] text-white"
                  : "text-[#707075] hover:text-white"
              }`}
              title="Xem dạng lưới"
            >
              <LayoutGrid size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {sorted.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-[#2d2d32] rounded-xl p-8 text-center">
          <p className="text-[#a0a0a5] text-sm mb-4">Chưa có dự án nào gần đây</p>
          <button
            type="button"
            onClick={onCreateNew}
            className="inline-flex items-center gap-2 py-2 px-5 rounded-full bg-[#d9381e] hover:bg-[#b92b15] text-white text-xs font-medium transition-colors cursor-pointer"
          >
            <Plus size={15} />
            <span>Tạo dự án mới</span>
          </button>
        </div>
      )}

      {/* Grid View Mode */}
      {sorted.length > 0 && viewMode === "grid" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {sorted.map(({ project, savedAt }) => {
            const aspect = project.metadata.aspectRatio || "9:16";
            return (
              <div
                key={project.metadata.id}
                className="group relative flex flex-col cursor-pointer"
              >
                <AppLink href={`/editor/${project.metadata.id}`} className="block">
                  {/* Thumbnail Card Aspect Ratio Container */}
                  <div
                    className={`w-full rounded-lg bg-[#242428] border border-[#303035] group-hover:border-[#d9381e] transition-all overflow-hidden flex flex-col items-center justify-center relative shadow-md ${
                      aspect === "9:16"
                        ? "aspect-[9/16]"
                        : aspect === "16:9"
                        ? "aspect-[16/9]"
                        : "aspect-square"
                    }`}
                  >
                    {/* Aspect Ratio Badge Icon */}
                    <div className="flex flex-col items-center justify-center gap-2 text-[#55555a] group-hover:text-[#d9381e] transition-colors">
                      {aspect === "9:16" ? (
                        <Smartphone size={32} strokeWidth={1.5} />
                      ) : aspect === "16:9" ? (
                        <Tv size={32} strokeWidth={1.5} />
                      ) : (
                        <Square size={32} strokeWidth={1.5} />
                      )}
                      <span className="text-[10px] font-mono tracking-wider opacity-80 uppercase">
                        {aspect}
                      </span>
                    </div>

                    {/* Scene Count Chip */}
                    <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-[#141416]/80 backdrop-blur-sm text-[10px] font-mono text-[#a0a0a5]">
                      {project.scenes.length} cảnh
                    </div>

                    {/* Hover Overlay Action Bar */}
                    <div className="absolute inset-0 bg-[#000000]/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                      <button
                        type="button"
                        onClick={(e) => handleDuplicate({ project, savedAt }, e)}
                        className="p-1.5 rounded-full bg-[#2a2a2e] hover:bg-[#38383e] text-white transition-colors"
                        title="Nhân bản"
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(project.metadata.id, project.metadata.brand.name, e)}
                        className="p-1.5 rounded-full bg-[#2a2a2e] hover:bg-[#dc2626] text-white transition-colors"
                        title="Xóa dự án"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Title & Metadata */}
                  <div className="mt-2.5">
                    <h3 className="text-[13px] font-normal text-[#dddddd] group-hover:text-white truncate">
                      {project.metadata.brand.name}
                    </h3>
                    <p className="text-[11px] text-[#707075] mt-0.5">
                      {formatTimeAgo(savedAt)}
                    </p>
                  </div>
                </AppLink>
              </div>
            );
          })}
        </div>
      )}

      {/* List View Mode */}
      {sorted.length > 0 && viewMode === "list" && (
        <div className="flex flex-col border border-[#2d2d32] rounded-lg overflow-hidden bg-[#222225]">
          <div className="grid grid-cols-12 px-4 py-2 text-[11px] font-medium text-[#707075] border-b border-[#2d2d32]">
            <span className="col-span-6">Tên dự án</span>
            <span className="col-span-2">Tỉ lệ khung hình</span>
            <span className="col-span-2">Sửa đổi lần cuối</span>
            <span className="col-span-2 text-right">Thao tác</span>
          </div>

          {sorted.map(({ project, savedAt }) => (
            <div
              key={project.metadata.id}
              className="grid grid-cols-12 items-center px-4 py-3 text-[12px] border-b border-[#2a2a2e] last:border-0 hover:bg-[#28282d] transition-colors"
            >
              <AppLink
                href={`/editor/${project.metadata.id}`}
                className="col-span-6 font-normal text-white hover:text-[#d9381e] truncate flex items-center gap-2"
              >
                <ExternalLink size={13} className="text-[#606065] shrink-0" />
                <span>{project.metadata.brand.name}</span>
              </AppLink>

              <span className="col-span-2 font-mono text-[11px] text-[#a0a0a5]">
                {project.metadata.aspectRatio || "9:16"}
              </span>

              <span className="col-span-2 text-[11px] text-[#808085]">
                {formatTimeAgo(savedAt)}
              </span>

              <div className="col-span-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={(e) => handleDuplicate({ project, savedAt }, e)}
                  className="p-1 text-[#808085] hover:text-white transition-colors"
                  title="Nhân bản"
                >
                  <Copy size={13} />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDelete(project.metadata.id, project.metadata.brand.name, e)}
                  className="p-1 text-[#808085] hover:text-[#ef4444] transition-colors"
                  title="Xóa dự án"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
