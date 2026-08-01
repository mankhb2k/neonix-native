import { useEffect, useState, type CSSProperties } from "react";
import type { DesktopAPI } from "../../../shared/ipc/contracts";

type Props = {
  api: DesktopAPI;
  title: string;
  dirty?: boolean;
};

export function TitleBar({ api, title, dirty }: Props) {
  const [maximized, setMaximized] = useState(false);
  const isMac =
    typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);

  useEffect(() => {
    void api.window.isMaximized().then(setMaximized);
    const onResize = () => {
      void api.window.isMaximized().then(setMaximized);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [api]);

  return (
    <header
      className="titlebar"
      data-geometry="titlebar"
      style={{ WebkitAppRegion: "drag" } as CSSProperties}
    >
      <div className="titlebar__brand">
        <img src="/brand-mark.svg" alt="" width={18} height={18} />
        <span className="titlebar__title">
          {title}
          {dirty ? " •" : ""}
        </span>
      </div>
      <div
        id="desktop-titlebar-menu-portal"
        className="titlebar__menu-portal"
        style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
      />
      {!isMac ? (
        <div
          className="titlebar__controls"
          style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
        >
          <button
            type="button"
            className="titlebar__btn"
            title="Minimize"
            onClick={() => void api.window.minimize()}
          >
            ─
          </button>
          <button
            type="button"
            className="titlebar__btn"
            title={maximized ? "Restore" : "Maximize"}
            onClick={() => {
              void api.window.toggleMaximize().then(setMaximized);
            }}
          >
            {maximized ? "❐" : "□"}
          </button>
          <button
            type="button"
            className="titlebar__btn titlebar__btn--close"
            title="Close"
            onClick={() => void api.window.close()}
          >
            ✕
          </button>
        </div>
      ) : null}
    </header>
  );
}
