/**
 * Expand session authoring (core + optional sugar) to strict core MotionProjectV1.
 */
import {
  MotionProjectV1Schema,
  V1,
  type AuthoringSugarV1,
  type MotionProject,
  type MotionProjectV1,
} from "@motionvideo/motion-protocol";

type LegacyLayer = Record<string, unknown>;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function migrateAnimationProperty(property: string): string {
  if (property === "appearance.opacity") return "opacity";
  return property;
}

function migrateVisualLayer(layer: LegacyLayer): LegacyLayer {
  const next: LegacyLayer = { ...layer };

  if ("appearance" in next && next.appearance && typeof next.appearance === "object") {
    const appearance = next.appearance as { opacity?: number; visible?: boolean };
    if (typeof appearance.opacity === "number") {
      next.opacity = appearance.opacity;
    }
    if (appearance.visible === false) {
      next.opacity = 0;
    }
    delete next.appearance;
  }

  if ("visible" in next) delete next.visible;
  if ("layout" in next) delete next.layout;
  if ("layoutItem" in next) delete next.layoutItem;
  if ("inheritFlags" in next) delete next.inheritFlags;
  if ("semantic" in next) delete next.semantic;
  if ("name" in next) delete next.name;

  if (next.compositing && typeof next.compositing === "object") {
    const compositing = { ...(next.compositing as Record<string, unknown>) };
    delete compositing.isolation;
    next.compositing =
      Object.keys(compositing).length > 0 ? compositing : undefined;
  }

  if (Array.isArray(next.animations)) {
    next.animations = next.animations.map((animation: LegacyLayer) => {
      const migrated = { ...animation };
      delete migrated.id;
      delete migrated.kind;
      if (typeof migrated.property === "string") {
        migrated.property = migrateAnimationProperty(migrated.property);
      }
      return migrated;
    });
  }

  if (next.type === "group" && Array.isArray(next.children)) {
    next.children = next.children.map((child: LegacyLayer) =>
      migrateVisualLayer(child),
    );
  }

  return next;
}

function migrateLayers(layers: unknown[]): unknown[] {
  return layers.map((layer) => {
    if (!layer || typeof layer !== "object") return layer;
    const record = layer as LegacyLayer;
    if (record.type === "audio") {
      const { name: _name, ...rest } = record;
      void _name;
      return rest;
    }
    return migrateVisualLayer(record);
  });
}

function applyBindingsToProject(
  project: LegacyLayer,
  sugar: AuthoringSugarV1,
): void {
  const bindings = sugar.bindings ?? [];
  const variables = new Map(
    (sugar.variables ?? []).map((variable) => [variable.id, variable.value]),
  );
  if (bindings.length === 0) return;

  const layers = project.layers as LegacyLayer[];
  const components = project.components as Array<{
    id: string;
    props: Array<{ id: string }>;
  }>;
  const componentById = new Map(components.map((c) => [c.id, c]));
  const layerById = new Map<string, LegacyLayer>();

  const walk = (nodes: LegacyLayer[]): void => {
    for (const node of nodes) {
      layerById.set(String(node.id), node);
      if (node.type === "group" && Array.isArray(node.children)) {
        walk(node.children as LegacyLayer[]);
      }
    }
  };
  walk(layers);

  for (const binding of bindings) {
    const target = binding.target;
    const layer = layerById.get(target.layerId);
    if (!layer || layer.type !== "component") continue;
    const payload = layer.payload as {
      componentId: string;
      props?: Record<string, unknown>;
    };
    const component = componentById.get(payload.componentId);
    if (!component) continue;
    if (!component.props.some((prop) => prop.id === target.propId)) continue;
    const value = variables.get(binding.source.variableId);
    if (value === undefined) continue;
    payload.props = { ...(payload.props ?? {}), [target.propId]: value };
  }
}

function stripMetadataExtras(metadata: Record<string, unknown>): Record<string, unknown> {
  const { id, name, locale } = metadata;
  return { id, name, locale };
}

function stripComponentPropSemantics(components: unknown[]): unknown[] {
  return (components as LegacyLayer[]).map((component) => {
    const next = { ...component };
    if (Array.isArray(next.props)) {
      next.props = (next.props as LegacyLayer[]).map((prop) => {
        const { semantic: _semantic, ...rest } = prop;
        void _semantic;
        return rest;
      });
    }
    if (Array.isArray(next.layers)) {
      next.layers = migrateLayers(next.layers as unknown[]);
    }
    return next;
  });
}

export function expandAuthoringToCore(
  project: MotionProject,
  sugar: AuthoringSugarV1 = {},
): MotionProjectV1 {
  const draft = clone(project) as LegacyLayer;

  applyBindingsToProject(draft, sugar);

  draft.metadata = stripMetadataExtras(
    draft.metadata as Record<string, unknown>,
  );
  draft.layers = migrateLayers((draft.layers as unknown[]) ?? []);
  draft.components = stripComponentPropSemantics(
    (draft.components as unknown[]) ?? [],
  );

  delete draft.tokens;
  delete draft.variables;
  delete draft.bindings;
  delete draft.capabilities;
  delete draft.dependencies;
  delete draft.provenance;
  delete draft.extensions;
  delete draft.timeline;

  const parsed = MotionProjectV1Schema.parse(draft);
  return parsed;
}

export function mergeAuthoringSugar(
  project: MotionProject,
  sugar: AuthoringSugarV1,
): MotionProject {
  return {
    ...project,
    ...(sugar.tokens !== undefined ? { tokens: sugar.tokens } : {}),
    ...(sugar.variables !== undefined ? { variables: sugar.variables } : {}),
    ...(sugar.bindings !== undefined ? { bindings: sugar.bindings } : {}),
    ...(sugar.capabilities !== undefined
      ? { capabilities: sugar.capabilities }
      : {}),
    ...(sugar.dependencies !== undefined
      ? { dependencies: sugar.dependencies }
      : {}),
    ...(sugar.provenance !== undefined ? { provenance: sugar.provenance } : {}),
    ...(sugar.extensions !== undefined ? { extensions: sugar.extensions } : {}),
  } as MotionProject;
}

export function envelopeToAuthoringSugar(
  envelope: {
    authoring: {
      metadataExtras?: AuthoringSugarV1["metadataExtras"];
      tokens?: AuthoringSugarV1["tokens"];
      variables?: AuthoringSugarV1["variables"];
      bindings?: AuthoringSugarV1["bindings"];
      capabilities?: AuthoringSugarV1["capabilities"];
      dependencies?: AuthoringSugarV1["dependencies"];
      provenance?: AuthoringSugarV1["provenance"];
      extensions?: AuthoringSugarV1["extensions"];
      layerDisplayNames?: AuthoringSugarV1["layerDisplayNames"];
      propSemantics?: AuthoringSugarV1["propSemantics"];
    };
  },
): AuthoringSugarV1 {
  const { authoring } = envelope;
  return {
    metadataExtras: authoring.metadataExtras,
    tokens: authoring.tokens,
    variables: authoring.variables,
    bindings: authoring.bindings,
    capabilities: authoring.capabilities,
    dependencies: authoring.dependencies,
    provenance: authoring.provenance,
    extensions: authoring.extensions,
    layerDisplayNames: authoring.layerDisplayNames,
    propSemantics: authoring.propSemantics,
  };
}
