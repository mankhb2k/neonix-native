import { EventEmitter } from "node:events";
import { Writable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { ExportRendererError } from "../src/errors";

const { spawn } = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock("node:child_process", () => ({ spawn }));

// Regression test for a real production incident: when the encoder process
// dies mid-stream (invalid input, crash, unsupported filter combination,
// ...), a later `child.stdin.write()` fails with EPIPE. A Writable's 'error'
// event crashes the whole Node process when nothing listens for it -
// bypassing every try/catch up the call stack, including the caller's own
// job-failure handling - instead of surfacing as an ordinary rejected
// promise. This test drives a real `stream.Writable` through a real EPIPE
// (via `.destroy(error)`, exactly how Node's own pipe internals report a
// broken pipe) so the only thing standing between "clean rejection" and
// "the whole process goes down" is whether something is listening for that
// stream's 'error' event - deterministically, without depending on OS pipe
// timing or a real ffmpeg binary.
describe("encodeRgbaFramesToMp4", () => {
  it("rejects with an ExportRendererError instead of crashing the process when the encoder's stdin breaks mid-write", async () => {
    const stdin = new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    });
    const fakeChild = Object.assign(new EventEmitter(), {
      stdin,
      stderr: new EventEmitter(),
      kill: vi.fn(),
    });
    spawn.mockReturnValue(fakeChild);

    const { encodeRgbaFramesToMp4 } = await import("../src/render/ffmpeg");

    async function* frames() {
      for (let index = 0; index < 50; index += 1) {
        if (index === 3) {
          // Simulate the encoder dying mid-stream: this is exactly how
          // Node's own pipe internals report a write to a closed pipe
          // (EPIPE), through the stream's real 'error' event. The child
          // process's own 'close' (independent of the stdin stream) follows
          // shortly after, same as a real crashed subprocess exiting.
          stdin.destroy(new Error("write EPIPE"));
          setImmediate(() => fakeChild.emit("close", 1));
        }
        yield Buffer.alloc(64, index);
        await Promise.resolve();
      }
    }

    await expect(encodeRgbaFramesToMp4({
      ffmpegPath: "fake-ffmpeg",
      outputPath: `${process.env.TEMP ?? "/tmp"}/neonix-ffmpeg-epipe-test.mp4`,
      width: 64,
      height: 64,
      fps: 30,
      frames: frames(),
    })).rejects.toBeInstanceOf(ExportRendererError);
  });
});
