import {
  compileProtocol,
  sampleMotionLayerAtTime,
} from "@motionvideo/motion-compiler";
import type { MotionProtocolV2, V2Layer } from "@motionvideo/motion-protocol/v2";
import {
  evaluateRuntimeProjectV3,
  frameIndexAtTime,
  type RuntimeFrameV3,
  type RuntimeProjectV3,
} from "@motionvideo/motion-runtime";

export type EditorRuntimeSession = {
  load(document: MotionProtocolV2): RuntimeProjectV3;
  update(document: MotionProtocolV2): RuntimeProjectV3;
  preview(document: MotionProtocolV2): RuntimeProjectV3;
  replaceRuntime(project: RuntimeProjectV3): void;
  sampleLayer(layer: V2Layer, timeSeconds: number): V2Layer;
  evaluate(timeSeconds: number, project?: RuntimeProjectV3): RuntimeFrameV3 | undefined;
  current(): RuntimeProjectV3 | undefined;
  generation(): number;
  dispose(): void;
};

/**
 * Owns the editor document -> RuntimeProjectV3 boundary. React and playback
 * only consume the cached project/frame; neither needs to compile a document.
 */
export function createEditorRuntimeSession(): EditorRuntimeSession {
  let source: MotionProtocolV2 | undefined;
  let runtime: RuntimeProjectV3 | undefined;
  let generation = 0;
  let disposed = false;

  const load = (document: MotionProtocolV2): RuntimeProjectV3 => {
    if (disposed) throw new Error("Editor runtime session is disposed");
    if (source === document && runtime) return runtime;
    source = document;
    const compiled = compileProtocol(document);
    runtime = runtime ? reusePreparedTextContent(compiled, runtime) : compiled;
    generation += 1;
    return runtime;
  };

  return {
    load,
    update: load,
    preview(document) {
      if (disposed) throw new Error("Editor runtime session is disposed");
      const compiled = compileProtocol(document);
      return runtime ? reusePreparedTextContent(compiled, runtime) : compiled;
    },
    replaceRuntime(project) {
      if (disposed) throw new Error("Editor runtime session is disposed");
      runtime = project;
    },
    sampleLayer: sampleMotionLayerAtTime,
    evaluate(timeSeconds, project = runtime) {
      if (!project) return undefined;
      return evaluateRuntimeProjectV3(
        project,
        frameIndexAtTime(timeSeconds, project.visual.composition.fps),
        { time: timeSeconds },
      );
    },
    current: () => runtime,
    generation: () => generation,
    dispose() {
      disposed = true;
      source = undefined;
      runtime = undefined;
    },
  };
}

function reusePreparedTextContent(
  compiled: RuntimeProjectV3,
  previous: RuntimeProjectV3,
): RuntimeProjectV3 {
  const previousById = new Map(previous.visual.nodes.map((node) => [node.id, node]));
  return {
    ...compiled,
    visual: {
      ...compiled.visual,
      nodes: compiled.visual.nodes.map((node) => {
        const previousNode = previousById.get(node.id);
        if (node.content.kind !== "text" || previousNode?.content.kind !== "text") return node;
        return { ...node, content: previousNode.content };
      }),
    },
  };
}

export { sampleMotionLayerAtTime as sampleEditorLayerAtTime } from "@motionvideo/motion-compiler";
