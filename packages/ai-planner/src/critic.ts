import { visualLayerAtoms, V1 } from "@motionvideo/motion-protocol";
import type { MotionProject } from "@motionvideo/motion-protocol";
import { getTextPayloadPlain } from "@motionvideo/motion-protocol";

export type CriticFinding = {
  code: string;
  severity: "error" | "warning" | "info";
  path: string;
  message: string;
  repairHint?: string;
};

export type CriticReport = {
  score: number;
  findings: CriticFinding[];
};

/** Structural/layout critic — deterministic, no CSS/JS (R7). */
export function critiqueProject(project: MotionProject): CriticReport {
  const findings: CriticFinding[] = [];
  let score = 100;

  const parsed = V1.MotionProjectV1Schema.safeParse(project);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      findings.push({
        code: "schema_invalid",
        severity: "error",
        path: issue.path.join("."),
        message: issue.message,
        repairHint: "Fix the schema violation before proceeding",
      });
      score -= 20;
    }
    return { score: Math.max(0, score), findings };
  }

  const layers = V1.flattenLayerTree(project.layers);
  const assetIds = new Set(project.assets.map((a) => a.id));
  for (const node of layers) {
    if (
      (node.type === "image" || node.type === "svg" || node.type === "video") &&
      "payload" in node &&
      typeof node.payload === "object" &&
      node.payload &&
      "assetId" in node.payload &&
      typeof node.payload.assetId === "string" &&
      !assetIds.has(node.payload.assetId)
    ) {
      findings.push({
        code: "asset_missing",
        severity: "error",
        path: `layers.${node.id}`,
        message: `Node references unknown asset "${node.payload.assetId}"`,
        repairHint:
          "registerAsset before referencing it, or use a valid asset id",
      });
      score -= 15;
    }
  }

  const experimental = project.capabilities?.experimental ?? [];
  if (experimental.length > 0) {
    findings.push({
      code: "experimental_capabilities",
      severity: "warning",
      path: "capabilities.experimental",
      message: `Project requires experimental capabilities: ${experimental.join(", ")}`,
      repairHint:
        "Remove experimental capability requirements for production use",
    });
    score -= 5;
  }

  const groups = project.layers.filter((layer) => layer.type === "group");
  if (groups.length === 0 && project.layers.length === 0) {
    findings.push({
      code: "empty_project",
      severity: "error",
      path: "layers",
      message: "Project has no layers",
      repairHint: "addScene then addNode",
    });
    score -= 40;
  }

  const hasCta = layers.some((node) => {
    const semantic = "semantic" in node ? node.semantic : undefined;
    return (
      semantic?.role === "cta" ||
      semantic?.key?.includes("cta") ||
      node.id.includes("cta")
    );
  });
  if (!hasCta) {
    findings.push({
      code: "missing_cta",
      severity: "warning",
      path: "layers",
      message: "No CTA scene/node detected",
      repairHint: "Add a scene with role cta and on-screen copy",
    });
    score -= 10;
  }

  for (const scene of groups) {
    if (scene.children.length === 0) {
      findings.push({
        code: "empty_scene",
        severity: "error",
        path: `scenes.${scene.id}`,
        message: `Scene ${scene.id} has no layers`,
        repairHint: "addNode with on-screen copy",
      });
      score -= 25;
    }

    const texts = V1.flattenLayerTree(scene.children).filter(
      (node) => node.type === "text",
    );
    for (const node of texts) {
      const fontSize = node.payload.fontSize;
      const width = node.frame?.width ?? 1;
      const text = getTextPayloadPlain(node.payload);
      const approx = text.length * fontSize * 0.55;
      if (approx > width * 1.05) {
        findings.push({
          code: "text_overflow",
          severity: "warning",
          path: `scenes.${scene.id}.layers.${node.id}`,
          message: `Text may overflow width at fontSize=${fontSize}`,
          repairHint: "Reduce fontSize or shorten copy",
        });
        score -= 5;
      }
    }

    for (let i = 0; i < texts.length; i += 1) {
      for (let j = i + 1; j < texts.length; j += 1) {
        const a = texts[i]!;
        const b = texts[j]!;
        const aw = a.frame?.width ?? 0;
        const ah = a.frame?.height ?? 0;
        const bw = b.frame?.width ?? 0;
        const bh = b.frame?.height ?? 0;
        const ax = a.transform.translate.x;
        const ay = a.transform.translate.y;
        const bx = b.transform.translate.x;
        const by = b.transform.translate.y;
        const overlap =
          ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
        if (overlap) {
          findings.push({
            code: "overlap",
            severity: "warning",
            path: `scenes.${scene.id}.layers`,
            message: `Text layers ${a.id} and ${b.id} overlap`,
            repairHint: "setLayoutConstraint column or adjust transforms",
          });
          score -= 4;
        }
      }
    }
  }

  return { score: Math.max(0, score), findings };
}

export function applyCriticRepair(
  project: MotionProject,
  finding: CriticFinding,
): MotionProject {
  const next = JSON.parse(JSON.stringify(project)) as MotionProject;
  if (finding.code === "text_overflow") {
    const match = /^scenes\.([^.]+)\.layers\.(.+)$/.exec(finding.path);
    if (match) {
      const node = V1.flattenLayerTree(next.layers).find(
        (item) => item.id === match[2],
      );
      if (node?.type === "text") {
        const box = Math.max(1, node.frame?.width ?? 1);
        const needed =
          box / Math.max(1, getTextPayloadPlain(node.payload).length * 0.55);
        node.payload.fontSize = Math.min(
          node.payload.fontSize,
          Math.max(12, needed),
        );
      }
    }
  }
  if (finding.code === "missing_cta") {
    const groups = next.layers.filter((layer) => layer.type === "group");
    const last = groups[groups.length - 1];
    if (last) {
      last.name = "cta";
      for (const node of V1.flattenLayerTree(last.children)) {
        if (node.type === "text") {
          node.semantic = { role: "cta", key: "cta.copy", tags: [] };
        }
      }
    }
  }
  if (finding.code === "empty_scene") {
    const match = /^scenes\.([^.]+)$/.exec(finding.path);
    const scene = next.layers.find(
      (layer) => layer.type === "group" && layer.id === match?.[1],
    );
    if (scene && scene.type === "group" && scene.children.length === 0) {
      scene.children.push({
        id: `node.repair.${scene.id}`,
        type: "text",
        parentLayerId: scene.id,
        zIndex: scene.children.length,
        timing: { start: 0, duration: scene.timing.duration },
        ...visualLayerAtoms({
          x: 540,
          y: 960,
          width: 900,
          height: 120,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          originX: 0.5,
          originY: 0.5,
          opacity: 100,
          visible: true,
        }),
        payload: {
          text: "Continue",
          fontSize: 48,
          color: "#ffffff",
          alignment: "center",
          wrap: "word" as const,
          overflow: "clip" as const,
        },
        semantic: { role: "hook", key: "hook.copy", tags: [] },
      });
    }
  }
  return next;
}
