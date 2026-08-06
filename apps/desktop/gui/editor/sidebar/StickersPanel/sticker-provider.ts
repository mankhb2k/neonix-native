import type { StickerCategory, StickerItem } from "./types";

import beerCanAsset from "../../../../../../assets/stickers/beer-can_8798947.png";
import chillOutAsset from "../../../../../../assets/stickers/chill-out_8335999.png";
import cuteAsset from "../../../../../../assets/stickers/cute_7980701.png";
import doneAsset from "../../../../../../assets/stickers/done_6999494.png";
import goodVibesAsset from "../../../../../../assets/stickers/good-vibes_7590158.png";
import noWayAsset from "../../../../../../assets/stickers/no-way_6028780.png";
import readyAsset from "../../../../../../assets/stickers/ready_7958340.png";

/**
 * Sticker CDN Architecture Seam.
 *
 * To connect to Cloud/CDN, set STICKER_CDN_BASE_URL (or VITE_STICKER_CDN_URL in .env)
 * e.g. "https://cdn.moticlip.com/assets/stickers".
 * If null, falls back seamlessly to local bundled assets.
 */
export const STICKER_CDN_BASE_URL: string | null =
  (import.meta as unknown as { env?: Record<string, string> }).env
    ?.VITE_STICKER_CDN_URL ?? null;

export function resolveStickerUrl(item: StickerItem): string {
  if (STICKER_CDN_BASE_URL) {
    const baseUrl = STICKER_CDN_BASE_URL.replace(/\/$/, "");
    const cleanPath = item.cdnPath.replace(/^\//, "");
    return `${baseUrl}/${cleanPath}`;
  }
  return item.localUrl;
}

export const STICKER_CATEGORIES: StickerCategory[] = [
  { id: "all", name: "Tất cả" },
  { id: "popular", name: "Phổ biến" },
  { id: "cute", name: "Dễ thương" },
  { id: "vibes", name: "Cảm xúc" },
];

export const ALL_STICKERS: StickerItem[] = [
  {
    id: "sticker-beer-can",
    name: "Beer Can",
    category: "popular",
    cdnPath: "beer-can_8798947.png",
    localUrl: beerCanAsset,
    tags: ["beer", "drink", "can", "party"],
  },
  {
    id: "sticker-chill-out",
    name: "Chill Out",
    category: "vibes",
    cdnPath: "chill-out_8335999.png",
    localUrl: chillOutAsset,
    tags: ["chill", "out", "vibes", "relax"],
  },
  {
    id: "sticker-cute",
    name: "Cute Girl",
    category: "cute",
    cdnPath: "cute_7980701.png",
    localUrl: cuteAsset,
    tags: ["cute", "girl", "happy", "love"],
    isPro: true,
  },
  {
    id: "sticker-done",
    name: "Done Check",
    category: "popular",
    cdnPath: "done_6999494.png",
    localUrl: doneAsset,
    tags: ["done", "check", "complete", "ok"],
  },
  {
    id: "sticker-good-vibes",
    name: "Good Vibes",
    category: "vibes",
    cdnPath: "good-vibes_7590158.png",
    localUrl: goodVibesAsset,
    tags: ["good", "vibes", "sun", "happy"],
  },
  {
    id: "sticker-no-way",
    name: "No Way",
    category: "vibes",
    cdnPath: "no-way_6028780.png",
    localUrl: noWayAsset,
    tags: ["no", "way", "stop", "shock"],
  },
  {
    id: "sticker-ready",
    name: "Ready Go",
    category: "popular",
    cdnPath: "ready_7958340.png",
    localUrl: readyAsset,
    tags: ["ready", "go", "start", "game"],
  },
];
