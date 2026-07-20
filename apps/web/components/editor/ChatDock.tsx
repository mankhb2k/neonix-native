"use client";

import { useState } from "react";
import { useEditorStore } from "@/lib/store/editor-store";

const CHIPS = [
  "Đổi màu #C45C26",
  "Đổi CTA: Đặt bàn ngay",
  "Tỉ lệ TikTok 9:16",
  "Tỉ lệ ngang 16:9",
  "Đổi tên brand: Phở Nhà",
];

export function ChatDock() {
  const messages = useEditorStore((s) => s.messages);
  const sendChat = useEditorStore((s) => s.sendChat);
  const applyPatch = useEditorStore((s) => s.applyPatch);
  const dismissPatch = useEditorStore((s) => s.dismissPatch);
  const [draft, setDraft] = useState("");

  function submit() {
    sendChat(draft);
    setDraft("");
  }

  return (
    <aside className="mv-chat">
      <div className="mv-chat-head">
        <h2>AI Copilot</h2>
        <p>Sửa timeline bằng tiếng Việt — luôn có nút Áp dụng</p>
      </div>
      <div className="mv-chat-chips">
        {CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            className="mv-chip"
            onClick={() => sendChat(chip)}
          >
            {chip}
          </button>
        ))}
      </div>
      <div className="mv-chat-messages">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`mv-msg ${msg.role === "user" ? "mv-msg-user" : "mv-msg-assistant"}`}
          >
            <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
            {msg.pendingPatch ? (
              <div className="mv-msg-actions">
                <button
                  type="button"
                  className="mv-btn mv-btn-primary mv-btn-sm"
                  onClick={() => applyPatch(msg.id)}
                >
                  Áp dụng
                </button>
                <button
                  type="button"
                  className="mv-btn mv-btn-ghost mv-btn-sm"
                  onClick={() => dismissPatch(msg.id)}
                >
                  Bỏ qua
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div className="mv-chat-input">
        <textarea
          value={draft}
          placeholder="Vd: Đổi CTA thành Ghé quán ngay…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="mv-chat-input-row">
          <button
            type="button"
            className="mv-btn mv-btn-primary mv-btn-sm"
            onClick={submit}
          >
            Gửi
          </button>
        </div>
      </div>
    </aside>
  );
}
