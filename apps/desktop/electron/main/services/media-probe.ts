/**
 * Lightweight media metadata probe (Wave E).
 * Images: PNG/JPEG header parse. A/V: ffprobe when available.
 */

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import type { AssetType } from "../../../shared/ipc/contracts";

export type MediaProbeResult = {
  width?: number;
  height?: number;
  duration?: number;
  fps?: number;
};

function readUInt32BE(buf: Buffer, offset: number): number {
  return buf.readUInt32BE(offset);
}

function probePng(buf: Buffer): MediaProbeResult | null {
  if (buf.length < 24) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) {
    return null;
  }
  // IHDR chunk starts at byte 8; width/height at 16/20
  const width = readUInt32BE(buf, 16);
  const height = readUInt32BE(buf, 20);
  if (width < 1 || height < 1) return null;
  return { width, height };
}

function probeJpeg(buf: Buffer): MediaProbeResult | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1]!;
    if (marker === 0xd9 || marker === 0xda) break;
    const len = buf.readUInt16BE(i + 2);
    if (len < 2) break;
    // SOF0..SOF3
    if (marker >= 0xc0 && marker <= 0xc3 && i + 8 < buf.length) {
      const height = buf.readUInt16BE(i + 5);
      const width = buf.readUInt16BE(i + 7);
      if (width > 0 && height > 0) return { width, height };
    }
    i += 2 + len;
  }
  return null;
}

async function probeImageFile(filePath: string): Promise<MediaProbeResult> {
  const buf = Buffer.from(await fs.readFile(filePath));
  return probePng(buf) ?? probeJpeg(buf) ?? {};
}

function runFfprobe(filePath: string): Promise<MediaProbeResult> {
  return new Promise((resolve) => {
    const child = spawn(
      "ffprobe",
      [
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        filePath,
      ],
      { windowsHide: true },
    );
    let stdout = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.on("error", () => resolve({}));
    child.on("close", (code) => {
      if (code !== 0) {
        resolve({});
        return;
      }
      try {
        const json = JSON.parse(stdout) as {
          format?: { duration?: string };
          streams?: Array<{
            codec_type?: string;
            width?: number;
            height?: number;
            avg_frame_rate?: string;
            duration?: string;
          }>;
        };
        const video = json.streams?.find((s) => s.codec_type === "video");
        const audio = json.streams?.find((s) => s.codec_type === "audio");
        const durationRaw =
          json.format?.duration ?? video?.duration ?? audio?.duration;
        const duration = durationRaw ? Number(durationRaw) : undefined;
        let fps: number | undefined;
        const rate = video?.avg_frame_rate;
        if (rate && rate.includes("/")) {
          const [a, b] = rate.split("/").map(Number);
          if (a && b) fps = a / b;
        }
        resolve({
          width: video?.width,
          height: video?.height,
          duration:
            duration != null && Number.isFinite(duration) && duration > 0
              ? duration
              : undefined,
          fps: fps != null && Number.isFinite(fps) && fps > 0 ? fps : undefined,
        });
      } catch {
        resolve({});
      }
    });
  });
}

export async function probeMediaFile(
  filePath: string,
  assetType: AssetType,
): Promise<MediaProbeResult> {
  if (assetType === "image" || assetType === "svg") {
    return probeImageFile(filePath);
  }
  if (assetType === "video" || assetType === "audio") {
    return runFfprobe(filePath);
  }
  return {};
}
