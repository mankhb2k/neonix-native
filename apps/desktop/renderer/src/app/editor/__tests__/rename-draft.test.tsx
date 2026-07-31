/**
 * Project name input commits once on blur — not per keystroke.
 * @vitest-environment happy-dom
 */

import React, { useEffect, useReducer, useRef, useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildBlankDesktopProject } from "../../../../../src/shared/project-file/envelope";
import {
  createInitialTimelineSession,
  reduceTimelineSession,
} from "../../../editor/session/timeline-session";

function RenameHarness({
  documentJson,
  onRenameCount,
}: {
  documentJson: string;
  onRenameCount: (n: number) => void;
}) {
  const [session, dispatch] = useReducer(
    reduceTimelineSession,
    undefined,
    () =>
      reduceTimelineSession(createInitialTimelineSession(), {
        type: "REPLACE_DOCUMENT",
        documentJson,
      }),
  );
  const [draft, setDraft] = useState(session.projectName);
  const dirty = useRef(false);
  useEffect(() => {
    if (!dirty.current) setDraft(session.projectName);
  }, [session.projectName]);

  const renameCount = session.history.past.filter(
    (e) => e.label === "Rename project",
  ).length;
  useEffect(() => {
    onRenameCount(renameCount);
  }, [renameCount, onRenameCount]);

  return (
    <input
      aria-label="Project name"
      value={draft}
      onChange={(e) => {
        dirty.current = true;
        setDraft(e.target.value);
      }}
      onBlur={() => {
        dirty.current = false;
        if ((draft.trim() || "Untitled") === session.projectName) {
          setDraft(session.projectName);
          return;
        }
        dispatch({
          type: "SET_PROJECT_NAME",
          name: draft,
          entryId: `rename_${renameCount + 1}`,
        });
      }}
    />
  );
}

describe("rename draft commit", () => {
  afterEach(() => cleanup());

  it("many keystrokes then blur create a single rename history entry", () => {
    const blank = buildBlankDesktopProject({
      name: "Original",
      createId: (p) => `${p}_draft`,
    });
    const counts: number[] = [];
    render(
      <RenameHarness
        documentJson={blank.documentJson}
        onRenameCount={(n) => counts.push(n)}
      />,
    );
    const input = screen.getByLabelText("Project name");
    fireEvent.change(input, { target: { value: "A" } });
    fireEvent.change(input, { target: { value: "Ab" } });
    fireEvent.change(input, { target: { value: "Abc" } });
    expect(Math.max(0, ...counts, 0)).toBe(0);
    fireEvent.blur(input);
    expect(Math.max(0, ...counts)).toBe(1);
  });
});
