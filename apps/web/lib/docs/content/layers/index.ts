import type { DocsPageView } from "@/lib/docs/content/page-view";
import { audioLayerPage } from "./audio";
import { componentLayerPage } from "./component";
import { framePage } from "./frame";
import { groupLayerPage } from "./group";
import { imageLayerPage } from "./image";
import { layerTypesOverviewPage } from "./overview";
import { rootZIndexPage } from "./root-zindex";
import { textLayerPage } from "./text";
import { layerTimingPage } from "./timing";
import { layerTreePage } from "./tree";
import { videoLayerPage } from "./video";
import { whatIsALayerPage } from "./what-is-a-layer";

export type LayersSlug =
  | "layer"
  | "layers/tree"
  | "layers/root-zindex"
  | "layers/timing"
  | "frame"
  | "layers"
  | "layers/group"
  | "layers/text"
  | "layers/image"
  | "layers/video"
  | "layers/audio"
  | "layers/component";

const LAYERS_SLUGS = new Set<string>([
  "layer",
  "layers/tree",
  "layers/root-zindex",
  "layers/timing",
  "frame",
  "layers",
  "layers/group",
  "layers/text",
  "layers/image",
  "layers/video",
  "layers/audio",
  "layers/component",
]);

export function isLayersSlug(slug: string): slug is LayersSlug {
  return LAYERS_SLUGS.has(slug);
}

export function getLayersPage(slug: LayersSlug): DocsPageView {
  switch (slug) {
    case "layer":
      return whatIsALayerPage();
    case "layers/tree":
      return layerTreePage();
    case "layers/root-zindex":
      return rootZIndexPage();
    case "layers/timing":
      return layerTimingPage();
    case "frame":
      return framePage();
    case "layers":
      return layerTypesOverviewPage();
    case "layers/group":
      return groupLayerPage();
    case "layers/text":
      return textLayerPage();
    case "layers/image":
      return imageLayerPage();
    case "layers/video":
      return videoLayerPage();
    case "layers/audio":
      return audioLayerPage();
    case "layers/component":
      return componentLayerPage();
  }
}
