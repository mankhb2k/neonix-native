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
    play: (atUs) => clock.start(atUs),
    pause: (atUs) => { clock.pause(atUs); },
    seek: (timeUs) => clock.seek(timeUs),
    nowUs: () => clock.nowUs(),
  };
}
