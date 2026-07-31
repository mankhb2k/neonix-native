import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  loadPanelLayoutPrefs,
  savePanelLayoutPrefs,
  type PanelLayoutPrefs,
} from "./panel-layout-prefs";

type Edge = "sidebar" | "inspector" | "timeline";

/**
 * Independent panel resize for editor chrome.
 * Does not touch project document JSON.
 */
export function usePanelResize() {
  const [layout, setLayout] = useState<PanelLayoutPrefs>(() =>
    typeof localStorage === "undefined"
      ? {
          sidebarWidth: 260,
          inspectorWidth: 300,
          timelineHeight: 240,
        }
      : loadPanelLayoutPrefs(),
  );
  const dragRef = useRef<{
    edge: Edge;
    startX: number;
    startY: number;
    origin: PanelLayoutPrefs;
  } | null>(null);

  useEffect(() => {
    savePanelLayoutPrefs(layout);
  }, [layout]);

  const onPointerMove = useCallback((ev: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = ev.clientX - drag.startX;
    const dy = ev.clientY - drag.startY;
    setLayout(() => {
      if (drag.edge === "sidebar") {
        return {
          ...drag.origin,
          sidebarWidth: Math.min(
            480,
            Math.max(180, drag.origin.sidebarWidth + dx),
          ),
        };
      }
      if (drag.edge === "inspector") {
        return {
          ...drag.origin,
          inspectorWidth: Math.min(
            480,
            Math.max(220, drag.origin.inspectorWidth - dx),
          ),
        };
      }
      return {
        ...drag.origin,
        timelineHeight: Math.min(
          560,
          Math.max(160, drag.origin.timelineHeight - dy),
        ),
      };
    });
  }, []);

  const endDrag = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
  }, [onPointerMove]);

  const beginResize = useCallback(
    (edge: Edge, ev: ReactPointerEvent) => {
      ev.preventDefault();
      dragRef.current = {
        edge,
        startX: ev.clientX,
        startY: ev.clientY,
        origin: layout,
      };
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", endDrag);
    },
    [endDrag, layout, onPointerMove],
  );

  useEffect(() => () => endDrag(), [endDrag]);

  return { layout, beginResize };
}
