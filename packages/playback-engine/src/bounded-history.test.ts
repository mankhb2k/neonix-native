import { describe, expect, it } from "vitest";
import { createBoundedHistory } from "./bounded-history";

describe("createBoundedHistory", () => {
  it("keeps the latest values in insertion order", () => {
    const history = createBoundedHistory<number>(3);
    history.push(1);
    history.push(2);
    history.push(3);
    history.push(4);

    expect(history.size).toBe(3);
    expect(history.toArray()).toEqual([2, 3, 4]);
  });

  it("does not retain values when capacity is zero", () => {
    const history = createBoundedHistory<number>(0);
    history.push(1);

    expect(history.size).toBe(0);
    expect(history.toArray()).toEqual([]);
  });

  it("returns a snapshot and clears the ring", () => {
    const history = createBoundedHistory<number>(2);
    history.push(1);
    const snapshot = history.toArray();

    history.push(2);
    history.clear();

    expect(snapshot).toEqual([1]);
    expect(history.size).toBe(0);
    expect(history.toArray()).toEqual([]);
  });
});
