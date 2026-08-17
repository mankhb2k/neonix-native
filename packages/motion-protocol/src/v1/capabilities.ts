/**
 * Yêu cầu capability của project V1.
 *
 * ID dạng dotted (ví dụ primitive.group, effect.blur).
 * required = lỗi cứng; optional = cảnh báo; experimental = chặn trừ khi bật flag.
 */
import { z } from "zod";

const KNOWN_CAPABILITY_IDS = [
  "projection.orthographic-2d",
  "projection.layered-2.5d",
  "projection.perspective-3d",
  "effect.blur",
  "effect.shadow",
  "effect.glow",
  "effect.inner-glow",
  "effect.noise",
  "effect.color-adjust",
  "primitive.group",
  "primitive.text",
  "primitive.shape",
  "primitive.image",
  "primitive.svg",
  "primitive.video",
  "primitive.path",
  "primitive.audio",
  "video.trim",
  "video.loop",
  "anim.transform",
  "anim.opacity",
  "anim.drivers",
  "style.gradient",
  "style.blend",
  "camera.orthographic",
  "camera.parallax",
  "audio.render-plan",
  "audio.export",
  "component.embedding",
  "ai.patching",
  "asset.external",
] as const;

export const CAPABILITY_MANIFEST_VERSION_V1 = "v1.3" as const;

export const CapabilityIdSchema = z.union([
  z.enum(KNOWN_CAPABILITY_IDS),
  z.string().regex(/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/, {
    message: "Capability IDs must be dotted lowercase identifiers",
  }),
]);

export type CapabilityId = z.infer<typeof CapabilityIdSchema>;

export const ProjectCapabilityRequirementsSchema = z
  .object({
    required: z.array(CapabilityIdSchema).max(256).default([]),
    optional: z.array(CapabilityIdSchema).max(256).optional(),
    experimental: z.array(CapabilityIdSchema).max(256).optional(),
  })
  .strict();

export type ProjectCapabilityRequirements = z.infer<
  typeof ProjectCapabilityRequirementsSchema
>;

const NODE_CAPABILITY: Record<string, string> = {
  text: "primitive.text",
  image: "primitive.image",
  svg: "primitive.svg",
  video: "primitive.video",
  shape: "primitive.shape",
  path: "primitive.path",
  group: "primitive.group",
  bone: "primitive.group",
  camera: "camera.orthographic",
  adjustment: "effect.color-adjust",
  solid: "primitive.shape",
  audio: "audio.render-plan",
};

type LayerLike = {
  type: string;
  children?: LayerLike[];
  effects?: Array<{ type?: string }>;
};

const EFFECT_CAPABILITY: Record<string, string> = {
  blur: "effect.blur",
  shadow: "effect.shadow",
  glow: "effect.glow",
  "inner-glow": "effect.inner-glow",
  noise: "effect.noise",
  "color-adjust": "effect.color-adjust",
};

function collectNodeCapabilities(node: LayerLike, caps: Set<string>): void {
  const cap = NODE_CAPABILITY[node.type];
  if (cap) caps.add(cap);
  if (node.type === "component") caps.add("component.embedding");
  for (const effect of node.effects ?? []) {
    const effectCap = EFFECT_CAPABILITY[effect.type ?? ""];
    if (effectCap) caps.add(effectCap);
  }
}

function walkLayers(layers: LayerLike[] | undefined, visit: (node: LayerLike) => void): void {
  for (const node of layers ?? []) {
    visit(node);
    if (node.children) walkLayers(node.children, visit);
  }
}

export function inspectProjectCapabilities(project: {
  layers?: LayerLike[];
  components?: Array<{ layers?: LayerLike[] }>;
}): Set<string> {
  const caps = new Set<string>();

  walkLayers(project.layers, (node) => {
    collectNodeCapabilities(node, caps);
  });

  if ((project.components ?? []).length > 0) {
    caps.add("component.embedding");
    for (const component of project.components ?? []) {
      walkLayers(component.layers, (node) => {
        collectNodeCapabilities(node, caps);
      });
    }
  }

  return caps;
}

export interface CapabilityPreflightResult {
  ok: boolean;
  used: string[];
  declared: string[];
  undeclared: string[];
  experimentalInUse: string[];
  missing: string[];
}

export function preflightProjectCapabilities(
  project: {
    capabilities?: ProjectCapabilityRequirements;
    layers?: LayerLike[];
    components?: Array<{ layers?: LayerLike[] }>;
  },
  _availableIds?: Set<string>,
): CapabilityPreflightResult {
  void _availableIds;
  const used = inspectProjectCapabilities(project);
  const required = new Set(project.capabilities?.required ?? []);
  const experimental = new Set(project.capabilities?.experimental ?? []);

  const usedArray = [...used].sort();
  const declaredArray = [...required].sort();
  const undeclared = usedArray.filter((id) => !required.has(id));
  const experimentalInUse = usedArray.filter((id) => experimental.has(id));
  const missing: string[] = [];

  return {
    ok: undeclared.length === 0 && experimentalInUse.length === 0,
    used: usedArray,
    declared: declaredArray,
    undeclared,
    experimentalInUse,
    missing,
  };
}
