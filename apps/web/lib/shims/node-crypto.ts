/**
 * Client webpack shim for `node:crypto`.
 * Server bundles keep the real Node module. Hashing on the client is only
 * needed so protocol/compiler barrels can load; docs/editor do not rely on
 * projectHash in the browser.
 */
export function createHash(_algorithm: string) {
  void _algorithm;
  const parts: string[] = [];
  return {
    update(data: string | Uint8Array, _encoding?: string) {
      void _encoding;
      parts.push(
        typeof data === "string" ? data : new TextDecoder().decode(data),
      );
      return this;
    },
    digest(encoding?: string) {
      const text = parts.join("");
      let h = 2166136261;
      for (let i = 0; i < text.length; i += 1) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      const hex = (h >>> 0).toString(16).padStart(8, "0").repeat(8).slice(0, 64);
      if (encoding === "hex" || encoding == null) return hex;
      return hex;
    },
  };
}

export function createHmac() {
  throw new Error("createHmac is not available in the browser bundle");
}

export function randomUUID(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `web-${Date.now().toString(16)}`;
}

export function timingSafeEqual(a: ArrayBufferView, b: ArrayBufferView): boolean {
  if (a.byteLength !== b.byteLength) return false;
  const left = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  const right = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}
