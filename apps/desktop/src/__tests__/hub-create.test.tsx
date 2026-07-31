/**
 * Hub create dialog — validates name and forwards CreateProjectInput.
 * @vitest-environment happy-dom
 */

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HubScreen } from "../../renderer/src/app/hub/HubScreen";

describe("HubScreen create project", () => {
  afterEach(() => cleanup());

  it("passes name and aspectRatio to onNew and keeps dialog open on failure", async () => {
    const onNew = vi.fn(async () => false);
    render(
      <HubScreen
        recent={[]}
        error={null}
        onNew={onNew}
        onOpen={() => undefined}
        onOpenRecent={() => undefined}
        onDiagnostics={() => undefined}
        onClearError={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /new project|create/i }));
    // Sidebar/grid may use different labels — open via first Create if dialog not open
    if (!screen.queryByRole("dialog")) {
      const buttons = screen.getAllByRole("button");
      const opener = buttons.find((b) => /new|create/i.test(b.textContent ?? ""));
      if (opener) fireEvent.click(opener);
    }

    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());

    const nameInput = screen.getByLabelText("Project name");
    fireEvent.change(nameInput, { target: { value: "My Film" } });
    fireEvent.click(screen.getByRole("button", { name: /^Create$/i }));

    await waitFor(() =>
      expect(onNew).toHaveBeenCalledWith({
        name: "My Film",
        aspectRatio: "16:9",
      }),
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("blocks empty name without calling onNew", async () => {
    const onNew = vi.fn(async () => true);
    render(
      <HubScreen
        recent={[]}
        error={null}
        onNew={onNew}
        onOpen={() => undefined}
        onOpenRecent={() => undefined}
        onDiagnostics={() => undefined}
        onClearError={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /create your first project/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Project name"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Create$/i }));
    expect(onNew).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/required/i);
  });
});
