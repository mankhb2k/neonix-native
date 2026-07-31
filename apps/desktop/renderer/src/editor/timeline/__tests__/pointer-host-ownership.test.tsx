/**
 * Host-level pointer ownership: foreign unmount must not free another gesture's token.
 * @vitest-environment happy-dom
 */

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEffect } from "react";
import {
  PointerSessionController,
  resetActivePointerSessionToken,
} from "../interactions/pointer-session-controller";
import { usePointerSessionHost } from "../interactions/use-pointer-session";

function Host({
  onReady,
}: {
  onReady: (api: ReturnType<typeof usePointerSessionHost>) => void;
}) {
  const api = usePointerSessionHost();
  useEffect(() => {
    onReady(api);
  }, [api, onReady]);
  return <div data-testid="host" />;
}

describe("usePointerSessionHost ownership", () => {
  afterEach(() => {
    cleanup();
    resetActivePointerSessionToken();
  });

  it("unmounting an idle host does not clear another active gesture token", () => {
    let ownerApi: ReturnType<typeof usePointerSessionHost> | null = null;
    const owner = render(
      <Host
        onReady={(api) => {
          ownerApi = api;
        }}
      />,
    );
    expect(ownerApi).not.toBeNull();
    const started = ownerApi!.beginGesture(
      { name: "owner-drag", onStart: () => ({}) },
      { x: 0, y: 0 },
    );
    expect(started).not.toBeNull();
    expect(started!.isRunning).toBe(true);

    let idleApi: ReturnType<typeof usePointerSessionHost> | null = null;
    const idle = render(
      <Host
        onReady={(api) => {
          idleApi = api;
        }}
      />,
    );
    expect(idleApi).not.toBeNull();
    idle.unmount();

    // Foreign unmount must not free owner's token.
    const blocked = new PointerSessionController({
      name: "blocked",
      onStart: () => ({}),
    });
    expect(blocked.start({ x: 9, y: 9 })).toBe(false);

    owner.unmount();
    const after = new PointerSessionController({
      name: "after-owner-unmount",
      onStart: () => ({}),
    });
    expect(after.start({ x: 1, y: 1 })).toBe(true);
    after.cancel();
  });
});
