import { describe, expect, it } from "vitest";
import {
  createHistoryState,
  pushHistory,
  replaceOrPushHistory,
  type HistoryEntry,
  type TimelineDocument,
} from "..";
import { fixtureMainOnly } from "../testing/fixtures/projects";

function doc(): TimelineDocument {
  const { project, clips, lanes } = fixtureMainOnly();
  return { project, clips, lanes };
}

function entry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: "h1",
    timestamp: 1,
    label: "scrub",
    before: doc(),
    after: doc(),
    ...overrides,
  };
}

describe("replaceOrPushHistory (coalesce)", () => {
  it("pushes a new entry when no coalesce key is present", () => {
    let state = createHistoryState();
    state = replaceOrPushHistory(state, entry({ id: "h1" }));
    state = replaceOrPushHistory(state, entry({ id: "h2", timestamp: 2 }));
    expect(state.past).toHaveLength(2);
    expect(state.past.map((e) => e.id)).toEqual(["h1", "h2"]);
  });

  it("replaces the last entry when coalesce keys match", () => {
    const before = doc();
    let state = createHistoryState();
    state = replaceOrPushHistory(
      state,
      entry({ id: "h1", before, coalesceKey: "scrub:x" }),
      { coalesceKey: "scrub:x" },
    );
    const after = doc();
    state = replaceOrPushHistory(
      state,
      entry({
        id: "h2",
        timestamp: 2,
        before: after,
        after,
        coalesceKey: "scrub:x",
      }),
      { coalesceKey: "scrub:x" },
    );

    expect(state.past).toHaveLength(1);
    expect(state.past[0]!.id).toBe("h2");
    // Keep original before so undo restores pre-scrub state.
    expect(state.past[0]!.before).toBe(before);
    expect(state.past[0]!.after).toBe(after);
  });

  it("falls back to entry.coalesceKey when options omit it", () => {
    let state = createHistoryState();
    state = replaceOrPushHistory(
      state,
      entry({ id: "h1", coalesceKey: "scrub:y" }),
    );
    state = replaceOrPushHistory(
      state,
      entry({ id: "h2", timestamp: 2, coalesceKey: "scrub:y" }),
    );
    expect(state.past).toHaveLength(1);
    expect(state.past[0]!.coalesceKey).toBe("scrub:y");
  });

  it("keeps entries separate when coalesce keys differ", () => {
    let state = createHistoryState();
    state = replaceOrPushHistory(
      state,
      entry({ id: "h1", coalesceKey: "scrub:a" }),
      { coalesceKey: "scrub:a" },
    );
    state = replaceOrPushHistory(
      state,
      entry({ id: "h2", timestamp: 2, coalesceKey: "scrub:b" }),
      { coalesceKey: "scrub:b" },
    );
    expect(state.past).toHaveLength(2);
  });

  it("clears the future stack on replace and on push", () => {
    let state = createHistoryState();
    state = pushHistory(state, entry({ id: "h0", coalesceKey: "k0" }));
    state = pushHistory(state, entry({ id: "h1", coalesceKey: "k1" }));
    // Simulate undo → future has an entry.
    state = {
      ...state,
      past: state.past.slice(0, -1),
      future: [state.past[state.past.length - 1]!],
    };
    expect(state.future).toHaveLength(1);

    state = replaceOrPushHistory(
      state,
      entry({ id: "h2", timestamp: 2, coalesceKey: "k1" }),
      { coalesceKey: "k1" },
    );
    expect(state.future).toHaveLength(0);
  });
});
