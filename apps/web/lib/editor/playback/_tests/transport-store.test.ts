import { describe, expect, it } from "vitest";
import { createTransportStore } from "../transport-store";

describe("editor transport store", () => {
  it("mirrors the runtime ended transition without deriving duration", () => {
    const store = createTransportStore();

    expect(store.getState()).toMatchObject({ ended: false, duration: 0 });

    expect(store.publishTransport({
      time: 2,
      playing: false,
      ended: true,
      generation: 7,
      duration: 2,
    })).toBe(true);

    expect(store.getState()).toMatchObject({
      currentTime: 2,
      playing: false,
      ended: true,
      duration: 2,
      generation: 7,
    });
  });
});
