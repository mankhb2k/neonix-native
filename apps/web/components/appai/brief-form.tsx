"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function BriefForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [brief, setBrief] = useState("");
  const [ratio, setRatio] = useState("9:16");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = `draft-${Date.now()}`;
    window.localStorage.setItem(`motionvideo.renew.${id}`, JSON.stringify({ name: name.trim() || "Video chưa đặt tên", brief, ratio }));
    router.push(`/appai/projects/${id}`);
  }

  return (
    <form className="briefCard" onSubmit={submit}>
      <label>Tên dự án<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: Ra mắt cà phê mùa hè" /></label>
      <label>Mô tả video<textarea required value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="Tạo video 20 giây giới thiệu cà phê cold brew mới, trẻ trung, tập trung vào cảm giác mát lạnh và CTA đặt hàng…" /></label>
      <div><span className="fieldLabel">Tỷ lệ khung hình</span><div className="ratioOptions">{["9:16", "16:9", "1:1"].map((value) => <button className={ratio === value ? "selected" : ""} type="button" key={value} onClick={() => setRatio(value)}>{value}</button>)}</div></div>
      <label>Giọng điệu<select defaultValue="energetic"><option value="energetic">Năng động, rõ ràng</option><option value="warm">Ấm áp, gần gũi</option><option value="premium">Tinh tế, cao cấp</option></select></label>
      <button className="primaryButton wide" type="submit">Tạo bản nháp bằng AI <span>→</span></button>
      <p className="formNote">Baseline UI: thao tác này tạo draft cục bộ. Generation API sẽ được nối ở milestone M1.</p>
    </form>
  );
}
