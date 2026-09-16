export type FrameRange = {
  startFrame: number;
  endFrameExclusive: number;
};

export type FrameChunk = FrameRange & {
  chunkId: string;
  attempt: number;
};

type FrameRangeTaskOptions<T> = {
  concurrency: number;
  maxRetries?: number;
  signal?: AbortSignal;
  task: (chunk: FrameChunk) => Promise<T>;
};

export type CompletedFrameChunk<T> = {
  chunk: FrameChunk;
  result: T;
};

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive integer.`);
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new Error("Frame range scheduling was cancelled.");
  }
}

export function planFrameRanges(totalFrames: number, chunkSize: number): FrameRange[] {
  if (!Number.isInteger(totalFrames) || totalFrames < 0) {
    throw new RangeError("totalFrames must be a non-negative integer.");
  }
  assertPositiveInteger(chunkSize, "chunkSize");

  const ranges: FrameRange[] = [];
  for (let startFrame = 0; startFrame < totalFrames; startFrame += chunkSize) {
    ranges.push({
      startFrame,
      endFrameExclusive: Math.min(totalFrames, startFrame + chunkSize),
    });
  }
  return ranges;
}

export async function runFrameRangeTasks<T>(
  ranges: FrameRange[],
  options: FrameRangeTaskOptions<T>,
): Promise<CompletedFrameChunk<T>[]> {
  assertPositiveInteger(options.concurrency, "concurrency");
  const maxRetries = options.maxRetries ?? 0;
  if (!Number.isInteger(maxRetries) || maxRetries < 0) {
    throw new RangeError("maxRetries must be a non-negative integer.");
  }

  const results: Array<CompletedFrameChunk<T> | undefined> = new Array(ranges.length);
  let nextIndex = 0;
  let failure: unknown;
  const abortController = new AbortController();
  const onAbort = (): void => abortController.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", onAbort, { once: true });
  if (options.signal?.aborted) onAbort();

  const worker = async (): Promise<void> => {
    while (failure === undefined) {
      throwIfAborted(options.signal);
      throwIfAborted(abortController.signal);
      const index = nextIndex;
      nextIndex += 1;
      if (index >= ranges.length) return;

      const range = ranges[index];
      let attempt = 1;
      while (true) {
        const chunk: FrameChunk = { ...range, chunkId: `chunk-${index}`, attempt };
        try {
          const result = await options.task(chunk);
          results[index] = { chunk, result };
          break;
        } catch (error) {
          if (attempt > maxRetries) {
            failure = error;
            abortController.abort(error);
            return;
          }
          attempt += 1;
          throwIfAborted(options.signal);
        }
      }
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.min(options.concurrency, Math.max(1, ranges.length)) }, worker));
  } finally {
    options.signal?.removeEventListener("abort", onAbort);
  }

  if (failure !== undefined) throw failure;
  return results as CompletedFrameChunk<T>[];
}
