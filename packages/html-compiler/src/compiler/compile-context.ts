import type { MotionProtocolV2, V2SvgDefinitionNode } from "@motionvideo/motion-protocol/v2";
import type { HtmlCompilerOptions, HtmlCssComposition, HtmlCssSource } from "../source";
import type { KeyframeDefinition, Node, Rule, Style } from "./model";
import type { LayoutBox, LayoutRect } from "./layout-ir";

export type LayoutOverride = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LayoutState = {
  origins: Map<Node, { x: number; y: number }>;
  flowOrigins: Map<Node, { x: number; y: number }>;
  sizes: Map<Node, { width: number; height: number }>;
  layoutBoxes: Map<Node, LayoutBox>;
  layoutOverrides: Map<Node, LayoutOverride>;
  anchorBoxes: Map<string, LayoutRect>;
};

export type CompileContextInput = {
  source: HtmlCssSource;
  options: HtmlCompilerOptions;
  composition: HtmlCssComposition;
  root: Node;
  body: Node | null;
  rules: Rule[];
  keyframes: Map<string, KeyframeDefinition>;
  styles: Map<Node, Style>;
  width: number;
  height: number;
  fps: number;
  baseDuration: number;
  viewport: { width: number; height: number };
};

export type CompileContext = CompileContextInput & {
  layers: MotionProtocolV2["layers"];
  assets: NonNullable<MotionProtocolV2["assets"]>;
  audioTracks: MotionProtocolV2["audio"]["tracks"];
  clipPaths: NonNullable<MotionProtocolV2["clipPaths"]>;
  masks: NonNullable<MotionProtocolV2["masks"]>;
  layout: LayoutState;
};

export function createCompileContext(input: CompileContextInput): CompileContext {
  return {
    ...input,
    layers: [],
    assets: [],
    audioTracks: [],
    clipPaths: [],
    masks: [],
    layout: {
      origins: new Map(),
      flowOrigins: new Map(),
      sizes: new Map(),
      layoutBoxes: new Map(),
      layoutOverrides: new Map(),
      anchorBoxes: new Map(),
    },
  };
}

export type CompileClipPaths = NonNullable<MotionProtocolV2["clipPaths"]>;
export type CompileMasks = NonNullable<MotionProtocolV2["masks"]>;
export type CompileSvgDefinitionNode = V2SvgDefinitionNode;
