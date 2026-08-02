import { CloudCheck, Gem, Upload } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { Button, Avatar, Tooltip } from "./ui";
import type { DesktopAPI } from "../shared/ipc/contracts";

type Props = {
  api: DesktopAPI;
  title: string;
  dirty?: boolean;
  /** Editor chrome matches web TitleBar; home stays compact. */
  mode?: "home" | "editor";
  onHome?: () => void;
  onTitleChange?: (name: string) => void;
};

const noDrag = { WebkitAppRegion: "no-drag" } as CSSProperties;

type WindowControlIconName = "minimize" | "maximize" | "restore" | "close";

function WindowControlIcon({ name }: { name: WindowControlIconName }) {
  const src = `/icon-windown-control/${name}.svg`;
  return (
    <span
      aria-hidden
      className="inline-block h-[10px] w-[10px] bg-current"
      style={{
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}

function WindowControls({ api }: { api: DesktopAPI }) {
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

  if (isMac) return null;

  const btn =
    "inline-flex h-full w-[46px] cursor-default items-center justify-center border-0 bg-transparent text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]";

  // Fixed width; height stretches to match content-driven titlebar.
  return (
    <div
      className="flex shrink-0 items-stretch self-stretch"
      data-geometry="titlebar-window-controls"
      style={noDrag}
    >
      <button
        type="button"
        title="Minimize"
        className={btn}
        onClick={() => void api.window.minimize()}
      >
        <WindowControlIcon name="minimize" />
      </button>
      <button
        type="button"
        title={maximized ? "Restore" : "Maximize"}
        className={btn}
        onClick={() => {
          void api.window.toggleMaximize().then(setMaximized);
        }}
      >
        <WindowControlIcon name={maximized ? "restore" : "maximize"} />
      </button>
      <button
        type="button"
        title="Close"
        className={`${btn} hover:bg-[#e81123] hover:text-white`}
        onClick={() => void api.window.close()}
      >
        <WindowControlIcon name="close" />
      </button>
    </div>
  );
}

function MenuBar() {
  return (
    <div className="flex items-center gap-0.5 select-none" style={noDrag}>
      <Button type="button" variant="ghost" size="sm">
        File
      </Button>
      <Button type="button" variant="ghost" size="sm">
        Edit
      </Button>
      <Button type="button" variant="ghost" size="sm">
        View
      </Button>
      <Button type="button" variant="ghost" size="sm">
        Help
      </Button>
    </div>
  );
}

export function TitleBarDesktop({
  api,
  title,
  dirty,
  mode = "home",
  onHome,
  onTitleChange,
}: Props) {
  const isEditor = mode === "editor";

  return (
    // Child-driven height: no fixed h-* on header. Tallest control + padding sets bar height.
    // Window controls stretch (items-stretch) to match that height.
    <header
      className="desktop-titlebar flex shrink-0 items-stretch bg-[var(--bg-panel)] select-none"
      data-geometry="titlebar"
      style={{ WebkitAppRegion: "drag" } as CSSProperties}
    >
      {/*
        [1] CONTENT — left
        Children (Button/Avatar size) decide height. py/px only add padding around them.
        flex-1 + min-w-0: takes all remaining width after window controls.
      */}
      <div
        className="flex min-w-0 flex-1 items-center gap-3 px-2 py-1"
        data-geometry="titlebar-content"
      >
        <div className="flex min-w-0 items-center gap-2" style={noDrag}>
          <Avatar
            variant="logo"
            size="sm"
            fallback="M"
            alt="Home"
            title="Home"
            onClick={onHome}
          />

          {isEditor ? <MenuBar /> : null}

          {isEditor ? (
            <input
              className="h-[26px] w-[160px] rounded-[4px] border border-transparent bg-transparent px-1.5 text-[13px] font-medium text-[var(--fg-primary)] outline-none hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] focus:border-[var(--border-strong)] focus:bg-[var(--bg-hover)]"
              value={title}
              onChange={(e) => onTitleChange?.(e.target.value)}
              readOnly={!onTitleChange}
              aria-label="Project name"
              placeholder="Untitled"
            />
          ) : (
            <span className="truncate text-[13px] font-medium text-[var(--fg-primary)]">
              {title}
              {dirty ? " •" : ""}
            </span>
          )}

          {isEditor ? (
            <Tooltip content={dirty ? "Unsaved changes" : "Saved"} side="bottom">
              <span className="inline-flex items-center">
                <CloudCheck
                  size={15}
                  strokeWidth={1.2}
                  color={dirty ? "#eab308" : "#22c55e"}
                />
              </span>
            </Tooltip>
          ) : null}
        </div>

        <div className="min-w-0 flex-1" />

        {isEditor ? (
          <div className="flex items-center gap-2" style={noDrag}>
            <Tooltip content="Pro" side="bottom">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Gem size={13} strokeWidth={1.2} color="#eab308" />}
              >
                Pro
              </Button>
            </Tooltip>
            <Tooltip content="Export MP4" side="bottom">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Upload size={13} strokeWidth={1.2} />}
                disabled
              >
                Export
              </Button>
            </Tooltip>
            <Avatar variant="user" size="md" fallback="U" alt="Account" />
          </div>
        ) : null}
      </div>

      {/*
        [2] WINDOW CONTROLS — right
        Fixed width (3 × 46px). Height follows content column via stretch.
      */}
      <WindowControls api={api} />
    </header>
  );
}
