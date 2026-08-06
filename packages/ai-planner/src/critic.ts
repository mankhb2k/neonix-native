import type { MotionProject } from "@motionvideo/motion-schema";
import { getTextPayloadPlain } from "@motionvideo/motion-schema";

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

  if (project.scenes.length === 0) {
    findings.push({
      code: "empty_project",
      severity: "error",
      path: "scenes",
      message: "Project has no scenes",
      repairHint: "addScene then addNode",
    });
    score -= 40;
  }

  const hasCta = project.scenes.some(
    (scene) =>
      scene.nodes.some((node) => node.semantic?.role === "cta" || node.semantic?.key?.includes("cta")) ||
      scene.id.includes("cta"),
  );
  if (!hasCta) {
    findings.push({
      code: "missing_cta",
      severity: "warning",
      path: "scenes",
      message: "No CTA scene/node detected",
      repairHint: "Add a scene with role cta and on-screen copy",
    });
    score -= 10;
  }

  for (const scene of project.scenes) {
    if (scene.nodes.length === 0) {
      findings.push({
        code: "empty_scene",
        severity: "error",
        path: `scenes.${scene.id}`,
        message: `Scene ${scene.id} has no nodes`,
        repairHint: "addNode with on-screen copy",
      });
      score -= 25;
    }

    const safe = project.metadata.safeArea;
    for (const node of scene.nodes) {
      if (node.type !== "text") continue;
      const fontSize = node.payload.fontSize;
      const width = node.transform.width;
      const text = getTextPayloadPlain(node.payload);
      const approx = text.length * fontSize * 0.55;
      if (approx > width * 1.05) {
        findings.push({
          code: "text_overflow",
          severity: "warning",
          path: `scenes.${scene.id}.nodes.${node.id}`,
          message: `Text may overflow width at fontSize=${fontSize}`,
          repairHint: "Enable fitText or shorten copy",
        });
        score -= 5;
      }
      if (safe) {
        const top = (safe.top ?? 0) * (project.metadata.aspectRatio === "9:16" ? 1920 : 1080);
        if (node.transform.y < top) {
          findings.push({
            code: "safe_area",
            severity: "info",
            path: `scenes.${scene.id}.nodes.${node.id}.transform.y`,
            message: "Node may sit in platform safe-area top inset",
            repairHint: "Increase y or apply layout padding",
          });
          score -= 2;
        }
      }
    }

    // Overlap among sibling text nodes (AABB)
    const texts = scene.nodes.filter((node) => node.type === "text");
    for (let i = 0; i < texts.length; i += 1) {
      for (let j = i + 1; j < texts.length; j += 1) {
        const a = texts[i]!;
        const b = texts[j]!;
        const overlap =
          a.transform.x < b.transform.x + b.transform.width &&
          a.transform.x + a.transform.width > b.transform.x &&
          a.transform.y < b.transform.y + b.transform.height &&
          a.transform.y + a.transform.height > b.transform.y;
        if (overlap) {
          findings.push({
            code: "overlap",
            severity: "warning",
            path: `scenes.${scene.id}.nodes`,
            message: `Text nodes ${a.id} and ${b.id} overlap`,
            repairHint: "setLayoutConstraint stack or adjust transforms",
          });
          score -= 4;
        }
      }
    }
  }

  return { score: Math.max(0, score), findings };
}

/** Apply one targeted repair from critic findings (R7). */
export function applyCriticRepair(project: MotionProject, finding: CriticFinding): MotionProject {
  const next = JSON.parse(JSON.stringify(project)) as MotionProject;
  if (finding.code === "text_overflow") {
    const match = /^scenes\.([^.]+)\.nodes\.(.+)$/.exec(finding.path);
    if (match) {
      const scene = next.scenes.find((item) => item.id === match[1]);
      const node = scene?.nodes.find((item) => item.id === match[2]);
      if (node?.type === "text") {
        node.payload.fitText = {
          minFontSize: Math.min(16, node.payload.fontSize),
          maxFontSize: node.payload.fontSize,
        };
        const box = Math.max(1, node.transform.width);
        const needed = box / Math.max(1, getTextPayloadPlain(node.payload).length * 0.55);
        node.payload.fontSize = Math.min(node.payload.fontSize, Math.max(12, needed));
      }
    }
  }
  if (finding.code === "missing_cta" && next.scenes.length > 0) {
    const last = next.scenes[next.scenes.length - 1]!;
    last.name = "cta";
    for (const node of last.nodes) {
      if (node.type === "text") {
        node.semantic = { role: "cta", key: "cta.copy", tags: [] };
      }
    }
  }
  if (finding.code === "empty_scene") {
    const match = /^scenes\.([^.]+)$/.exec(finding.path);
    const scene = next.scenes.find((item) => item.id === match?.[1]);
    if (scene && scene.nodes.length === 0) {
      scene.nodes.push({
        id: `node.repair.${scene.id}`,
        type: "text",
        parentId: null,
        transform: {
          x: 540,
          y: 960,
          width: 900,
          height: 120,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          anchorX: 0.5,
          anchorY: 0.5,
          opacity: 1,
          visible: true,
          flipX: false,
          flipY: false,
        },
        payload: { content: { kind: "plain", text: "Continue" }, fontSize: 48, align: "center" },
        style: { fill: "#ffffff" },
        semantic: { role: "hook", key: "hook.copy", tags: [] },
      });
    }
  }
  return next;
}
