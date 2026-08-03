import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TimeRuler } from "./TimeRuler";

function zeroTick(container: HTMLElement): HTMLElement {
  const label = Array.from(container.querySelectorAll("span")).find(
    (element) => element.textContent === "00:00",
  );
  if (!label?.parentElement) throw new Error("Expected the zero-time tick");
  return label.parentElement;
}

describe("TimeRuler", () => {
  afterEach(cleanup);

  it("scrolls the content origin with the gutter", () => {
    const { container, rerender } = render(
      <TimeRuler
        duration={10}
        fps={30}
        pixelsPerSecond={100}
        viewWidth={500}
        scrollLeft={0}
        originOffsetPx={16}
      />,
    );

    expect(zeroTick(container).style.left).toBe("16px");

    rerender(
      <TimeRuler
        duration={10}
        fps={30}
        pixelsPerSecond={100}
        viewWidth={500}
        scrollLeft={16}
        originOffsetPx={16}
      />,
    );
    expect(zeroTick(container).style.left).toBe("0px");
  });

  it("seeks only for a primary pointer when enabled", () => {
    const onSeekClick = vi.fn();
    const { container } = render(
      <TimeRuler
        duration={10}
        fps={30}
        pixelsPerSecond={100}
        viewWidth={500}
        scrollLeft={0}
        onSeekClick={onSeekClick}
      />,
    );
    const ruler = container.firstElementChild as HTMLElement;

    fireEvent.pointerDown(ruler, { button: 2, clientX: 80 });
    expect(onSeekClick).not.toHaveBeenCalled();

    fireEvent.pointerDown(ruler, { button: 0, clientX: 123 });
    expect(onSeekClick).toHaveBeenCalledOnce();
    expect(onSeekClick).toHaveBeenCalledWith(123);
    expect(ruler.getAttribute("aria-hidden")).toBe("false");
  });

  it("is non-interactive when no seek callback is supplied", () => {
    const { container } = render(
      <TimeRuler
        duration={10}
        fps={30}
        pixelsPerSecond={100}
        viewWidth={500}
        scrollLeft={0}
      />,
    );
    const ruler = container.firstElementChild as HTMLElement;
    expect(ruler.getAttribute("aria-hidden")).toBe("true");
    expect(ruler.className).toContain("cursor-default");
  });
});
