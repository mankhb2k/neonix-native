import { expect, type Locator, type Page } from "@playwright/test";
import { STORAGE_KEY } from "../fixtures/project-builders";

/** Match DesktopEditorShell AUTOSAVE_DEBOUNCE_MS (+ buffer for slow CI). */
const AUTOSAVE_WAIT_MS = 900;

/**
 * Page object for MotiClip desktop editor timeline interactions.
 */
export class EditorPage {
  constructor(readonly page: Page) {}

  async goto(projectId: string, search = "") {
    const query = search
      ? search.startsWith("?")
        ? search
        : `?${search}`
      : "";
    await this.page.goto(`/app/editor/${projectId}${query}`);
  }

  async waitReady(clipText?: string) {
    if (clipText) {
      await expect(this.page.getByText(clipText).first()).toBeVisible({
        timeout: 30_000,
      });
    } else {
      await expect(this.page.getByTestId("runtime-preview-canvas")).toBeVisible(
        {
          timeout: 30_000,
        },
      );
    }
  }

  clip(clipId: string): Locator {
    return this.page.locator(`[data-clip-id="${clipId}"]`);
  }

  lane(laneId: string): Locator {
    return this.page.locator(`[data-track-lane][data-lane-id="${laneId}"]`);
  }

  playhead(): Locator {
    return this.page.getByRole("slider", { name: "Playhead" });
  }

  currentTime(): Locator {
    return this.page.getByTestId("timeline-current-time");
  }

  playheadTransform(): Promise<string> {
    return this.playhead().evaluate((el) => {
      const root = el.parentElement as HTMLElement | null;
      return root?.style.transform ?? "";
    });
  }

  async expectClipInLane(clipId: string, laneId: string) {
    await expect(
      this.page.locator(`[data-clip-id="${clipId}"][data-lane-id="${laneId}"]`),
    ).toBeVisible({ timeout: 10_000 });
  }

  async expectLaneExists(laneId: string) {
    await expect(this.lane(laneId)).toBeVisible({ timeout: 10_000 });
  }

  async expectLaneRemoved(laneId: string) {
    await expect(this.lane(laneId)).toBeHidden({ timeout: 10_000 });
  }

  async dragClipToLane(clipId: string, destLaneId: string) {
    const clip = this.clip(clipId);
    const destLane = this.lane(destLaneId);
    await expect(clip).toBeVisible({ timeout: 30_000 });
    await expect(destLane).toBeVisible();

    const clipBox = await clip.boundingBox();
    const destBox = await destLane.boundingBox();
    if (!clipBox || !destBox) {
      throw new Error(`missing boxes for ${clipId} → ${destLaneId}`);
    }

    // Drop in lane body at an early start time (labels are a sibling column).
    const startX = clipBox.x + Math.min(24, clipBox.width / 2);
    const startY = clipBox.y + clipBox.height / 2;
    const targetX = destBox.x + 40;
    const targetY = destBox.y + destBox.height / 2;

    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    // Exceed move threshold then settle on destination body.
    await this.page.mouse.move(startX + 8, startY + 8, { steps: 4 });
    await this.page.mouse.move(targetX, targetY, { steps: 20 });
    await this.page.waitForTimeout(50);
    await this.page.mouse.up();

    await this.expectClipInLane(clipId, destLaneId);
  }

  async waitForAutosave() {
    await this.page.waitForTimeout(AUTOSAVE_WAIT_MS);
  }

  /** Poll localStorage until clip.laneId matches (autosave caught up). */
  async expectStoredClipLane(
    projectId: string,
    clipId: string,
    laneId: string,
  ) {
    await expect
      .poll(
        async () => {
          return this.page.evaluate(
            ({ key, id, clip }) => {
              const raw = window.localStorage.getItem(key);
              if (!raw) return null;
              const projects = JSON.parse(raw) as Record<
                string,
                { timelineClips?: Array<{ id: string; laneId: string }> }
              >;
              const clips = projects[id]?.timelineClips ?? [];
              return clips.find((c) => c.id === clip)?.laneId ?? null;
            },
            { key: STORAGE_KEY, id: projectId, clip: clipId },
          );
        },
        { timeout: 5_000 },
      )
      .toBe(laneId);
  }

  /** Poll localStorage until lane id is present. */
  async expectStoredLane(projectId: string, laneId: string) {
    await expect
      .poll(
        async () => {
          return this.page.evaluate(
            ({ key, id, lane }) => {
              const raw = window.localStorage.getItem(key);
              if (!raw) return false;
              const projects = JSON.parse(raw) as Record<
                string,
                { timelineLanes?: Array<{ id: string }> }
              >;
              return Boolean(
                projects[id]?.timelineLanes?.some((l) => l.id === lane),
              );
            },
            { key: STORAGE_KEY, id: projectId, lane: laneId },
          );
        },
        { timeout: 5_000 },
      )
      .toBe(true);
  }

  async reload() {
    await this.waitForAutosave();
    await this.page.reload();
  }

  async scrubPlayheadByKeyboard(steps = 1) {
    const playhead = this.playhead();
    await expect(playhead).toBeVisible();
    await playhead.focus();
    for (let i = 0; i < steps; i++) {
      await this.page.keyboard.press("ArrowRight");
    }
  }
}
