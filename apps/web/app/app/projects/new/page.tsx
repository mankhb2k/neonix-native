"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { planMotionProject } from "@motionvideo/ai-planner";
import { AppLink, appHref } from "@/components/AppLink";
import { marketingUrl } from "@/lib/hosts";
import { saveProject } from "@/lib/project-storage";

export default function NewProjectPage() {
  const router = useRouter();
  const [brandName, setBrandName] = useState("Cà Phê Sáng");
  const [industry, setIndustry] = useState("fnb");
  const [primaryColor, setPrimaryColor] = useState("#1A5D3A");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9" | "1:1">(
    "9:16",
  );
  const [script, setScript] = useState(
    "Cà phê ngon mỗi sáng\nGiảm 30% hôm nay\nGhé quán ngay",
  );
  const [busy, setBusy] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const project = planMotionProject({
        brandName,
        industry,
        primaryColor,
        aspectRatio,
        tags: industry === "fnb" ? ["cà phê", "khuyến mãi"] : [industry],
        script,
      });
      saveProject(project);
      router.push(appHref(`/editor/${project.id}`));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mv-hub">
      <header className="mv-hub-header">
        <AppLink href="/" className="mv-hub-brand">
          MotionVideo
        </AppLink>
        <nav className="mv-hub-nav">
          <AppLink href="/">Workspace</AppLink>
          <a href={marketingUrl("/")}>Landing</a>
        </nav>
      </header>
      <main className="mv-hub-main">
        <p className="mv-hub-kicker">Dự án mới</p>
        <h1 className="mv-hub-title">Nhập brand & kịch bản</h1>
        <p className="mv-hub-lead">
          AI planner (stub) sẽ chọn template tiếng Việt và tạo timeline — bạn
          chỉnh tiếp trong editor.
        </p>
        <form className="mv-form" onSubmit={onSubmit}>
          <div className="mv-field">
            <label htmlFor="brand">Tên brand</label>
            <input
              id="brand"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              required
            />
          </div>
          <div className="mv-field">
            <label htmlFor="industry">Ngành</label>
            <select
              id="industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            >
              <option value="fnb">F&B / cà phê</option>
              <option value="spa">Spa / thẩm mỹ</option>
              <option value="saas">SaaS / app</option>
            </select>
          </div>
          <div className="mv-field">
            <label htmlFor="color">Màu brand</label>
            <input
              id="color"
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
            />
          </div>
          <div className="mv-field">
            <label htmlFor="ratio">Tỉ lệ</label>
            <select
              id="ratio"
              value={aspectRatio}
              onChange={(e) =>
                setAspectRatio(e.target.value as typeof aspectRatio)
              }
            >
              <option value="9:16">9:16 TikTok / Reels</option>
              <option value="16:9">16:9 YouTube</option>
              <option value="1:1">1:1 Feed</option>
            </select>
          </div>
          <div className="mv-field">
            <label htmlFor="script">Kịch bản (mỗi dòng ~ 1 scene)</label>
            <textarea
              id="script"
              value={script}
              onChange={(e) => setScript(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="mv-btn mv-btn-primary"
            disabled={busy}
          >
            {busy ? "Đang tạo…" : "Tạo timeline & mở editor"}
          </button>
        </form>
      </main>
    </div>
  );
}
