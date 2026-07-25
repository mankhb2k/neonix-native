"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Draft = { name: string; brief: string; ratio: string };

export function ReviewWorkspace({ projectId }: { projectId: string }) {
  const [draft, setDraft] = useState<Draft>({ name: "AI Motion Draft", brief: "Video giới thiệu sản phẩm với thông điệp rõ ràng và CTA ở cảnh cuối.", ratio: "9:16" });
  const [scene, setScene] = useState(0);

  useEffect(() => {
    const raw = window.localStorage.getItem(`motionvideo.renew.${projectId}`);
    if (raw) setDraft(JSON.parse(raw) as Draft);
  }, [projectId]);

  return (
    <main className="reviewShell">
      <header className="reviewHeader"><div className="reviewTitle"><Link className="back" href="/appai">←</Link><div><strong>{draft.name}</strong><span>Đã lưu cục bộ · bản nháp</span></div></div><div className="reviewActions"><button className="quietButton" type="button">Chia sẻ</button><button className="primaryButton compact" type="button">Xuất video</button></div></header>
      <div className="reviewBody">
        <aside className="scenes"><p className="panelLabel">Scenes</p>{["Hook", "Product", "Benefits", "CTA"].map((name, index) => <button type="button" key={name} className={scene === index ? "active" : ""} onClick={() => setScene(index)}><span className="sceneThumb">0{index + 1}</span><span><strong>{name}</strong><small>{index === 0 ? "3.0s" : "5.0s"}</small></span></button>)}<button className="regenerate" type="button">↻ Tạo lại cấu trúc</button></aside>
        <section className="stageArea"><div className={`previewFrame ratio-${draft.ratio.replace(":", "-")}`}><div className="previewBadge">Runtime preview · M1</div><div className="mockComposition"><span>SCENE 0{scene + 1}</span><h2>{scene === 0 ? "Một ý tưởng lớn, kể thật gọn." : scene === 3 ? "Sẵn sàng bắt đầu?" : "Chuyển động được tạo từ primitive."}</h2><p>{draft.brief}</p><div className="mockShape" /></div></div><div className="player"><button type="button">▶</button><div className="track"><span style={{ width: `${(scene + 1) * 25}%` }} /></div><time>00:0{scene * 3} / 00:18</time></div></section>
        <aside className="controls"><div><p className="panelLabel">Public controls</p><h2>Nội dung dự án</h2></div><label>Tên chiến dịch<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label>Thông điệp<textarea value={draft.brief} onChange={(event) => setDraft({ ...draft, brief: event.target.value })} /></label><label>Màu thương hiệu<div className="colorControl"><span /><input defaultValue="#F2FF66" /></div></label><label>Voiceover<select defaultValue="none"><option value="none">Chưa chọn</option><option value="warm">Nữ · ấm áp</option><option value="clear">Nam · rõ ràng</option></select></label><button className="secondaryButton" type="button">↻ Tạo lại scene này</button><p className="formNote">Không hiển thị layer, keyframe hoặc Bone nội bộ cho AI User.</p></aside>
      </div>
    </main>
  );
}
