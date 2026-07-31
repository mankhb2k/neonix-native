/**
 * Project name input commits once on blur — not per keystroke.
 * Escape rolls back without committing.
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
  const skipCommit = useRef(false);
  useEffect(() => {
    if (!dirty.current) setDraft(session.projectName);
  }, [session.projectName]);

  const renameCount = session.history.past.filter(
    (e) => e.label === "Rename project",
  ).length;
  useEffect(() => {
    onRenameCount(renameCount);
  }, [renameCount, onRenameCount]);

  const commit = () => {
    if (skipCommit.current) {
      skipCommit.current = false;
      return;
    }
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
  };

  return (
    <input
      aria-label="Project name"
      value={draft}
      onChange={(e) => {
        dirty.current = true;
        setDraft(e.target.value);
      }}
      onBlur={() => commit()}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          skipCommit.current = true;
          dirty.current = false;
          setDraft(session.projectName);
          (e.target as HTMLInputElement).blur();
        }
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

  it("Escape rolls back draft and does not commit on blur", () => {
    const blank = buildBlankDesktopProject({
      name: "Original",
      createId: (p) => `${p}_esc`,
    });
    const counts: number[] = [];
    render(
      <RenameHarness
        documentJson={blank.documentJson}
        onRenameCount={(n) => counts.push(n)}
      />,
    );
    const input = screen.getByLabelText("Project name") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Temp" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input.value).toBe("Original");
    expect(Math.max(0, ...counts, 0)).toBe(0);
  });
});
