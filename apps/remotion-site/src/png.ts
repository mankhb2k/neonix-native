import { inflateSync } from "node:zlib";

export type Rgba = readonly [number, number, number, number];
export type RgbaImage = { width: number; height: number; pixels: Uint8Array };

function paeth(left: number, up: number, upLeft: number): number {
  const candidate = left + up - upLeft;
  const leftDistance = Math.abs(candidate - left);
  const upDistance = Math.abs(candidate - up);
  const upLeftDistance = Math.abs(candidate - upLeft);
  return leftDistance <= upDistance && leftDistance <= upLeftDistance
    ? left
    : upDistance <= upLeftDistance ? up : upLeft;
}

export function decodeRgbaPng(input: Buffer): RgbaImage {
  if (input.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("Expected PNG output");
  let width = 0;
  let height = 0;
  let colorType = -1;
  const idat: Buffer[] = [];
  for (let offset = 8; offset < input.length;) {
    const length = input.readUInt32BE(offset);
    const type = input.subarray(offset + 4, offset + 8).toString("ascii");
    const payload = input.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = payload.readUInt32BE(0);
      height = payload.readUInt32BE(4);
      colorType = payload[9]!;
      if (payload[8] !== 8 || (colorType !== 2 && colorType !== 6) || payload[12] !== 0) throw new Error("Expected an 8-bit non-interlaced RGB or RGBA PNG");
    } else if (type === "IDAT") idat.push(payload);
    offset += length + 12;
  }
  if (!width || !height || !idat.length) throw new Error("PNG is missing image data");
  const raw = inflateSync(Buffer.concat(idat));
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const pixels = new Uint8Array(width * height * 4);
  let inputOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[inputOffset++]!;
    const row = new Uint8Array(stride);
    for (let x = 0; x < stride; x += 1) {
      const encoded = raw[inputOffset++]!;
      const left = x >= channels ? row[x - channels]! : 0;
      const up = y > 0 ? pixels[((y - 1) * width * 4) + Math.floor(x / channels) * 4 + (x % channels)]! : 0;
      const upLeft = y > 0 && x >= channels ? pixels[((y - 1) * width * 4) + Math.floor((x - channels) / channels) * 4 + ((x - channels) % channels)]! : 0;
      row[x] = (filter === 0 ? encoded : filter === 1 ? encoded + left : filter === 2 ? encoded + up : filter === 3 ? encoded + Math.floor((left + up) / 2) : filter === 4 ? encoded + paeth(left, up, upLeft) : (() => { throw new Error(`Unsupported PNG filter ${filter}`); })()) & 0xff;
    }
    for (let x = 0; x < width; x += 1) {
      const source = x * channels;
      const target = (y * width + x) * 4;
      pixels[target] = row[source]!;
      pixels[target + 1] = row[source + 1]!;
      pixels[target + 2] = row[source + 2]!;
      pixels[target + 3] = channels === 4 ? row[source + 3]! : 255;
    }
  }
  return { width, height, pixels };
}

export function pixel(image: RgbaImage, x: number, y: number): Rgba {
  const offset = (y * image.width + x) * 4;
  return [image.pixels[offset]!, image.pixels[offset + 1]!, image.pixels[offset + 2]!, image.pixels[offset + 3]!];
}

export function countPixels(image: RgbaImage, predicate: (value: Rgba) => boolean): number {
  let count = 0;
  for (let offset = 0; offset < image.pixels.length; offset += 4) {
    if (predicate([image.pixels[offset]!, image.pixels[offset + 1]!, image.pixels[offset + 2]!, image.pixels[offset + 3]!])) count += 1;
  }
  return count;
}
