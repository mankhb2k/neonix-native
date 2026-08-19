import type { DocsPageView } from "@/lib/docs/content/page-view";
import { adjustmentLayerPage } from "./adjustment";
import { audioLayerPage } from "./audio";
import { componentLayerPage } from "./component";
import { framePage } from "./frame";
import { groupLayerPage } from "./group";
import { imageLayerPage } from "./image";
import { layoutOverviewPage } from "@/lib/docs/content/layout/overview";
import { layerTypesOverviewPage } from "./overview";
import { pathLayerPage } from "./path";
import { rootZIndexPage } from "./root-zindex";
import { shapeLayerPage } from "./shape";
import { solidLayerPage } from "./solid";
import { svgLayerPage } from "./svg";
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
  | "layers/layout"
  | "layers/text"
  | "layers/shape"
  | "layers/path"
  | "layers/image"
  | "layers/svg"
  | "layers/video"
  | "layers/audio"
  | "layers/solid"
  | "layers/adjustment"
  | "layers/component";

const LAYERS_SLUGS = new Set<string>([
  "layer",
  "layers/tree",
  "layers/root-zindex",
  "layers/timing",
  "frame",
  "layers",
  "layers/group",
  "layers/layout",
  "layers/text",
  "layers/shape",
  "layers/path",
  "layers/image",
  "layers/svg",
  "layers/video",
  "layers/audio",
  "layers/solid",
  "layers/adjustment",
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
    case "layers/layout":
      return layoutOverviewPage();
    case "layers/text":
      return textLayerPage();
    case "layers/shape":
      return shapeLayerPage();
    case "layers/path":
      return pathLayerPage();
    case "layers/image":
      return imageLayerPage();
    case "layers/svg":
      return svgLayerPage();
    case "layers/video":
      return videoLayerPage();
    case "layers/audio":
      return audioLayerPage();
    case "layers/solid":
      return solidLayerPage();
    case "layers/adjustment":
      return adjustmentLayerPage();
    case "layers/component":
      return componentLayerPage();
  }
}
