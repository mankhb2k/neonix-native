import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import type { HtmlCompilerFontAsset, HtmlCompilerMediaAsset, HtmlCompilerOptions } from "../../source";
import type { Node } from "../model";
import { mediaMimeType } from "../media";

export type ProtocolAsset = NonNullable<MotionProtocolV2["assets"]>[number];
export type MediaAssetKind = "image" | "video" | "audio";

export type AssetRegistry = {
  readonly assets: NonNullable<MotionProtocolV2["assets"]>;
  add(items: readonly ProtocolAsset[]): void;
  registerImage(node: Node, uri: string, suffix?: string): string;
  registerVideo(node: Node, uri: string, suffix?: string): string;
  registerAudio(node: Node, uri: string, suffix?: string): string;
  registerMedia(node: Node, kind: MediaAssetKind, uri: string, suffix?: string): string;
  registerFonts(fontAssets: readonly HtmlCompilerFontAsset[]): string[];
};

function protocolFontAsset(asset: HtmlCompilerFontAsset): ProtocolAsset {
  return { id: asset.id, kind: "font", uri: asset.uri, weight: asset.weight, integrity: asset.integrity };
}

function mediaAsset(
  node: Node,
  kind: MediaAssetKind,
  uri: string,
  catalog: HtmlCompilerMediaAsset | undefined,
  suffix: string,
): ProtocolAsset {
  const id = `${node.atomicId}-${suffix}`;
  return {
    id,
    kind,
    uri,
    mimeType: catalog?.mimeType ?? mediaMimeType(uri, kind),
    ...(catalog?.width !== undefined ? { width: catalog.width } : {}),
    ...(catalog?.height !== undefined ? { height: catalog.height } : {}),
    ...(catalog?.duration !== undefined ? { duration: catalog.duration } : {}),
    ...(catalog?.fps !== undefined ? { fps: catalog.fps } : {}),
    ...(catalog?.sampleRate !== undefined ? { sampleRate: catalog.sampleRate } : {}),
    ...(catalog?.channels !== undefined ? { channels: catalog.channels } : {}),
  } as ProtocolAsset;
}

export function createAssetRegistry(
  options: Pick<HtmlCompilerOptions, "mediaAssets">,
  output: NonNullable<MotionProtocolV2["assets"]> = [],
): AssetRegistry {
  const add = (items: readonly ProtocolAsset[]): void => {
    for (const asset of items) if (!output.some((candidate) => candidate.id === asset.id)) output.push(asset);
  };
  const registerMedia = (node: Node, kind: MediaAssetKind, uri: string, suffix = "asset"): string => {
    const id = `${node.atomicId}-${suffix}`;
    const catalog = options.mediaAssets?.find((asset) => asset.uri === uri && asset.kind === kind);
    add([mediaAsset(node, kind, uri, catalog, suffix)]);
    return id;
  };
  return {
    assets: output,
    add,
    registerImage: (node, uri, suffix = "asset") => registerMedia(node, "image", uri, suffix),
    registerVideo: (node, uri, suffix = "asset") => registerMedia(node, "video", uri, suffix),
    registerAudio: (node, uri, suffix = "asset") => registerMedia(node, "audio", uri, suffix),
    registerMedia,
    registerFonts: (fontAssets) => {
      const protocolAssets = fontAssets.map(protocolFontAsset);
      add(protocolAssets);
      return fontAssets.map((asset) => asset.id);
    },
  };
}
