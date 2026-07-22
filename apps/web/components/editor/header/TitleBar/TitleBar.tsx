"use client";

import { AppLink } from "@/components/AppLink";
import { useEditorStore } from "@/lib/store/editor-store";
import { Grid3X3, CloudCheck, Search, Sparkles, Settings } from "lucide-react";

export function TitleBar() {
  const project = useEditorStore((s) => s.project);
  const updateBrand = useEditorStore((s) => s.updateBrand);

  return (
    <div className="mv-ppt-top-row">
      <div className="mv-ppt-top-left">
        {/* 9 Dots App Launcher */}
        <button type="button" className="mv-ppt-launcher-btn" title="Ứng dụng">
          <Grid3X3 size={15} strokeWidth={1.2} />
        </button>

        {/* App Logo */}
        <AppLink href="/" className="mv-ppt-logo" title="Trang chủ">
          <span className="mv-ppt-logo-badge">P</span>
        </AppLink>

        {/* Project Name Input */}
        <input
          className="mv-ppt-name-input"
          value={project?.brand.name ?? "Presentation 2"}
          onChange={(e) => updateBrand({ name: e.target.value })}
          aria-label="Tên dự án"
          placeholder="Dự án không tên"
        />

        {/* Cloud Saved Icon */}
        <span className="mv-ppt-saved-icon" title="Đã lưu vào đám mây">
          <CloudCheck size={15} strokeWidth={1.2} color="#22c55e" />
        </span>
      </div>

      {/* Search Box in Middle */}
      <div className="mv-ppt-top-center">
        <div className="mv-ppt-search-box">
          <Search size={14} strokeWidth={1.2} />
          <input type="text" placeholder="Tìm kiếm" className="mv-ppt-search-input" />
        </div>
      </div>

      {/* Top Right Utilities */}
      <div className="mv-ppt-top-right">
        <span className="mv-ppt-upgrade-badge">
          <Sparkles size={13} strokeWidth={1.2} />
          Mua Microsoft 365
        </span>
        <button type="button" className="mv-ppt-icon-btn" title="Cài đặt">
          <Settings size={14} strokeWidth={1.2} />
        </button>
        <div className="mv-ppt-avatar" title="Tài khoản">
          <img
            src="https://api.dicebear.com/7.x/avataaars/svg?seed=Admin"
            alt="User Avatar"
            width="24"
            height="24"
          />
        </div>
      </div>
    </div>
  );
}
