import type { PlaybackClockV3 } from "../core/types";

export type ClockControllerV3 = {
  readonly clock: PlaybackClockV3;
  play(atUs?: number): void;
  pause(atUs?: number): void;
  seek(timeUs: number): void;
  nowUs(): number;
};

export function createClockControllerV3(clock: PlaybackClockV3): ClockControllerV3 {
  return {
    clock,
    play: (atUs) => clock.setPlaying(true, atUs),
    pause: (atUs) => clock.setPlaying(false, atUs),
    seek: (timeUs) => clock.seek(timeUs),
    nowUs: () => clock.nowUs(),
  };
}
