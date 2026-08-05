import { createElement, useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_VISUAL_POLICY } from "@motionvideo/editor-core";
import type { TimelineLaneRow } from "../lanes/timeline-lane-rows";
import { TimelineLaneLabels } from "./TimelineLaneLabels";
import { TimelineTrackCanvas } from "./TimelineTrackCanvas";
import { TimeRuler } from "../TimeRuler/TimeRuler";

let leadingIconRenders = 0;
let rulerTickRenders = 0;
let emptyDashRenders = 0;

vi.mock("../lanes/LaneLeadingIcon", () => ({
  LaneLeadingIcon: () => {
    leadingIconRenders += 1;
    return createElement("span", { "data-testid": "leading-icon" });
  },
}));

vi.mock("./EmptyTimelineDash", () => ({
  EmptyTimelineDash: () => {
    emptyDashRenders += 1;
    return createElement("div", { "data-testid": "empty-dash" });
  },
}));

vi.mock("../timeline-scale", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../timeline-scale")>();
  return {
    ...actual,
    formatRulerLabel: (...args: Parameters<typeof actual.formatRulerLabel>) => {
      rulerTickRenders += 1;
      return actual.formatRulerLabel(...args);
    },
  };
});

afterEach(() => cleanup());

beforeEach(() => {
  leadingIconRenders = 0;
  rulerTickRenders = 0;
  emptyDashRenders = 0;
});

function sampleLaneRow(): TimelineLaneRow {
  return {
    id: "base",
    kind: "visual",
    role: "base",
    order: -1,
    name: "Main",
    height: 48,
    heightClass: "h-12",
    lane: {
      id: "base",
      kind: "visual",
      role: "base",
      name: "Main",
      order: -1,
      policy: { ...DEFAULT_VISUAL_POLICY },
    },
  };
}

describe("scroll memo render boundaries", () => {
  it("LaneLabels / TimeRuler production leaves skip when their scroll axis is unchanged", () => {
    const row = sampleLaneRow();
    const laneRows = [row];
    const mountedRows = [
      { kind: "lane" as const, key: row.id, row, index: 0 },
    ];
    const laneContentKindById = new Map([["base", "component" as const]]);
    const onExecute = () => undefined;
    const tracksScrollRef = { current: null as HTMLDivElement | null };

    function Shell() {
      const [scrollLeft, setScrollLeft] = useState(0);
      const [scrollTop, setScrollTop] = useState(0);
      const [noise, setNoise] = useState(0);
      return createElement(
        "div",
        null,
        createElement(
          "button",
          {
            "data-testid": "h",
            type: "button",
            onClick: () => setScrollLeft((v) => v + 10),
          },
          String(scrollLeft),
        ),
        createElement(
          "button",
          {
            "data-testid": "v",
            type: "button",
            onClick: () => setScrollTop((v) => v + 10),
          },
          String(scrollTop),
        ),
        createElement(
          "button",
          {
            "data-testid": "noise",
            type: "button",
            onClick: () => setNoise((n) => n + 1),
          },
          String(noise),
        ),
        createElement(TimelineLaneLabels, {
          tracksScrollRef,
          scrollTop,
          mountedOffsetTop: 0,
          mountedRows,
          laneRows,
          bottomSpacer: 0,
          laneContentKindById,
          disabled: false,
          onExecute,
        }),
        createElement(TimeRuler, {
          duration: 10,
          fps: 30,
          pixelsPerSecond: 50,
          viewWidth: 400,
          scrollLeft,
        }),
      );
    }

    render(createElement(Shell));
    const labelsAfterMount = leadingIconRenders;
    const rulerAfterMount = rulerTickRenders;
    expect(labelsAfterMount).toBeGreaterThan(0);
    expect(rulerAfterMount).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId("h"));
    expect(leadingIconRenders).toBe(labelsAfterMount);
    expect(rulerTickRenders).toBeGreaterThan(rulerAfterMount);

    const rulerAfterH = rulerTickRenders;
    fireEvent.click(screen.getByTestId("noise"));
    expect(leadingIconRenders).toBe(labelsAfterMount);
    expect(rulerTickRenders).toBe(rulerAfterH);

    fireEvent.click(screen.getByTestId("v"));
    expect(leadingIconRenders).toBeGreaterThan(labelsAfterMount);
    expect(rulerTickRenders).toBe(rulerAfterH);
  });

  it("TimelineTrackCanvas leaf skips when props identity is unchanged", () => {
    const row = sampleLaneRow();
    const layout = {
      canvasWidth: 800,
      trackViewWidth: 400,
      contentHeight: 200,
      topPadding: 40,
      pixelsPerSecond: 50,
      scrollLeft: 0,
    };
    const virtualRows = {
      laneRows: [row],
      mountedOffsetTop: 40,
      mountedRows: [],
      bottomSpacer: 40,
      timelineEmpty: true,
    };
    const actions = {
      onScroll: () => undefined,
      beginMarquee: () => undefined,
      beginGesture: (() => null) as never,
      onSelect: () => undefined,
      onExecute: () => undefined,
      onExecuteProperty: () => undefined,
      getPlayheadTime: () => 0,
      clipsForLane: () => [],
      isLayerMode: false,
      stripFlags: { trimEnabled: true, layerSession: null },
    };

    const props = {
      tracksScrollRef: { current: null },
      selection: { kind: "none" as const },
      disabled: false,
      canPaste: false,
      clips: [],
      lanes: [row.lane],
      layout,
      virtualRows,
      actions,
    };

    const { rerender } = render(createElement(TimelineTrackCanvas, props));
    expect(screen.getByTestId("empty-dash")).toBeTruthy();
    const afterMount = emptyDashRenders;
    expect(afterMount).toBeGreaterThan(0);

    rerender(createElement(TimelineTrackCanvas, props));
    expect(emptyDashRenders).toBe(afterMount);

    rerender(
      createElement(TimelineTrackCanvas, {
        ...props,
        layout: { ...layout, scrollLeft: 40 },
      }),
    );
    expect(emptyDashRenders).toBeGreaterThan(afterMount);
  });
});
