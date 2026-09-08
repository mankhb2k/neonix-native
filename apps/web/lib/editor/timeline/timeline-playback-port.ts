export type TimelinePlaybackTimeEvent = {
  time: number;
  playing: boolean;
  duration: number;
  ended: boolean;
};

export type TimelinePlaybackPort = {
  currentTime: number;
  duration: number;
  playing: boolean;
  previewSeek: (time: number) => void;
  toggle: () => void;
  registerTimeSink: (
    sink: (event: TimelinePlaybackTimeEvent) => void,
  ) => () => void;
};
