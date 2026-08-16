import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compileMotionProject } from "@motionvideo/motion-compiler";
import { parseMotionProjectV1 } from "@motionvideo/motion-protocol";
import {
  ALL_VISUAL_PROJECTS,
  DOCS_ASSET_PHOTO_SQUARE,
  DOCS_ASSET_PHOTO_WIDE,
  DOCS_ASSET_TREE,
} from "./visual-fixtures";

function jpegSize(filePath: string): { width: number; height: number } {
  const data = readFileSync(filePath);
  let i = 2;
  while (i < data.length) {
    if (data[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = data[i + 1];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return {
        height: data.readUInt16BE(i + 5),
        width: data.readUInt16BE(i + 7),
      };
    }
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x00) {
      i += 2;
      continue;
    }
    const seg = data.readUInt16BE(i + 2);
    i += 2 + seg;
  }
  throw new Error(`No SOF in ${filePath}`);
}

const PUBLIC_DOCS = path.resolve(__dirname, "../../public/docs");

describe("docs visual fixtures", () => {
  it("matches public raster dimensions", () => {
    const square = path.join(PUBLIC_DOCS, "example1-1.jpg");
    const wide = path.join(PUBLIC_DOCS, "example16-9.jpg");
    const tree = path.join(PUBLIC_DOCS, "tree-svgrepo-com.svg");
    expect(existsSync(square)).toBe(true);
    expect(existsSync(wide)).toBe(true);
    expect(existsSync(tree)).toBe(true);
    expect(jpegSize(square)).toEqual({
      width: DOCS_ASSET_PHOTO_SQUARE.width,
      height: DOCS_ASSET_PHOTO_SQUARE.height,
    });
    expect(jpegSize(wide)).toEqual({
      width: DOCS_ASSET_PHOTO_WIDE.width,
      height: DOCS_ASSET_PHOTO_WIDE.height,
    });
    expect(readFileSync(tree, "utf8")).toContain(DOCS_ASSET_TREE.viewBox);
  });

  it("parses and compiles every visual example", () => {
    expect(ALL_VISUAL_PROJECTS.length).toBe(15);
    for (const project of ALL_VISUAL_PROJECTS) {
      const parsed = parseMotionProjectV1(project);
      expect(() => compileMotionProject(parsed)).not.toThrow();
    }
  });
});
