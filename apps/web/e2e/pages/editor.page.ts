import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Page object for MotiClip desktop editor timeline interactions.
 */
export class EditorPage {
  constructor(readonly page: Page) {}

  async goto(projectId: string) {
    await this.page.goto(`/app/editor/${projectId}`);
  }

  async waitReady(clipText?: string) {
    if (clipText) {
      await expect(this.page.getByText(clipText).first()).toBeVisible({
        timeout: 30_000,
      });
    } else {
      await expect(this.page.getByTestId("runtime-preview-canvas")).toBeVisible({
        timeout: 30_000,
      });
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

  async expectClipInLane(clipId: string, laneId: string) {
    await expect(
      this.page.locator(
        `[data-clip-id="${clipId}"][data-lane-id="${laneId}"]`,
      ),
    ).toBeVisible({ timeout: 10_000 });
  }

  async expectLaneExists(laneId: string) {
    await expect(this.lane(laneId)).toBeVisible({ timeout: 10_000 });
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

    await this.page.mouse.move(
      clipBox.x + Math.min(24, clipBox.width / 2),
      clipBox.y + clipBox.height / 2,
    );
    await this.page.mouse.down();
    await this.page.mouse.move(destBox.x + 48, destBox.y + destBox.height / 2, {
      steps: 12,
    });
    await this.page.mouse.up();
  }

  async reload() {
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
