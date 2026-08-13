import type { MotionProject } from "@motionvideo/motion-protocol";
import { getTextPayloadPlain, V1 } from "@motionvideo/motion-protocol";

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

/** Structural/layout critic — deterministic, no CSS/JS (R7). Phase 9: V1-aware. */
export function critiqueProject(project: MotionProject): CriticReport {
  const findings: CriticFinding[] = [];
  let score = 100;

  // ── Phase 9: V1 schema validity ──
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

  // ── V1 visualTracks integrity ──
  const sceneIds = new Set(project.scenes.map((s) => s.id));
  const componentIds = new Set(project.components.map((c) => c.id));
  for (const track of project.timeline.visualTracks) {
    for (const clip of track.clips) {
      if (clip.source.kind === "scene" && !sceneIds.has(clip.source.sceneId)) {
        findings.push({
          code: "clip_target_missing",
          severity: "error",
          path: `timeline.visualTracks.${track.id}.clips.${clip.id}`,
          message: `Visual clip references unknown scene "${clip.source.sceneId}"`,
          repairHint: "Add the scene first, or point clip to an existing scene",
        });
        score -= 25;
      }
      if (
        clip.source.kind === "component" &&
        !componentIds.has(clip.source.componentId)
      ) {
        findings.push({
          code: "clip_component_missing",
          severity: "error",
          path: `timeline.visualTracks.${track.id}.clips.${clip.id}`,
          message: `Visual clip references unknown component "${clip.source.componentId}"`,
          repairHint:
            "Embed the component definition, or point clip to an existing component",
        });
        score -= 25;
      }
    }
  }

  // ── Clip timing ──
  for (const track of project.timeline.visualTracks) {
    if (track.role !== "main") continue;
    const sorted = [...track.clips].sort((a, b) => a.start - b.start);
    for (let i = 0; i < sorted.length; i += 1) {
      const clip = sorted[i]!;
      if (clip.start < 0) {
        findings.push({
          code: "clip_negative_start",
          severity: "error",
          path: `timeline.visualTracks.${track.id}.clips.${clip.id}`,
          message: `Clip start is negative (${clip.start})`,
          repairHint: "Set clip start >= 0",
        });
        score -= 10;
      }
      if (clip.duration <= 0) {
        findings.push({
          code: "clip_zero_duration",
          severity: "error",
          path: `timeline.visualTracks.${track.id}.clips.${clip.id}`,
          message: `Clip duration is non-positive (${clip.duration})`,
          repairHint: "Set clip duration > 0",
        });
        score -= 10;
      }
      // Check for overlapping clips in the base lane
      if (i > 0) {
        const prev = sorted[i - 1]!;
        const prevEnd = prev.start + prev.duration;
        if (clip.start < prevEnd - 1e-9) {
          findings.push({
            code: "clip_overlap",
            severity: "warning",
            path: `timeline.visualTracks.${track.id}.clips`,
            message: `Clips "${prev.id}" and "${clip.id}" overlap`,
            repairHint:
              "Adjust clip start times to eliminate overlap, or use overlay tracks",
          });
          score -= 5;
        }
      }
    }
  }

  // ── Asset integrity ──
  const assetIds = new Set(project.assets.map((a) => a.id));
  for (const scene of project.scenes) {
    for (const node of scene.layers) {
      const payload = node.payload as Record<string, unknown>;
      if (
        (node.type === "image" ||
          node.type === "svg" ||
          node.type === "video") &&
        typeof payload.assetId === "string" &&
        !assetIds.has(payload.assetId)
      ) {
        findings.push({
          code: "asset_missing",
          severity: "error",
          path: `scenes.${scene.id}.layers.${node.id}`,
          message: `Node references unknown asset "${payload.assetId}"`,
          repairHint:
            "registerAsset before referencing it, or use a valid asset id",
        });
        score -= 15;
      }
    }
  }

  // ── Unsupported capabilities ──
  const capabilities = project.capabilities;
  const experimental = capabilities?.experimental ?? [];
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
      scene.layers.some(
        (node) =>
          node.semantic?.role === "cta" || node.semantic?.key?.includes("cta"),
      ) || scene.id.includes("cta"),
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
    if (scene.layers.length === 0) {
      findings.push({
        code: "empty_scene",
        severity: "error",
        path: `scenes.${scene.id}`,
        message: `Scene ${scene.id} has no layers`,
        repairHint: "addNode with on-screen copy",
      });
      score -= 25;
    }

    const safe = project.metadata.safeArea;
    for (const node of scene.layers) {
      if (node.type !== "text") continue;
      const fontSize = node.payload.fontSize;
      const width = node.transform.width;
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
      if (safe) {
        const top =
          (safe.top ?? 0) *
          (project.metadata.aspectRatio === "9:16" ? 1920 : 1080);
        if (node.transform.y < top) {
          findings.push({
            code: "safe_area",
            severity: "info",
            path: `scenes.${scene.id}.layers.${node.id}.transform.y`,
            message: "Node may sit in platform safe-area top inset",
            repairHint: "Increase y or apply layout padding",
          });
          score -= 2;
        }
      }
    }

    // Overlap among sibling text layers (AABB)
    const texts = scene.layers.filter((node) => node.type === "text");
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
            path: `scenes.${scene.id}.layers`,
            message: `Text layers ${a.id} and ${b.id} overlap`,
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
export function applyCriticRepair(
  project: MotionProject,
  finding: CriticFinding,
): MotionProject {
  const next = JSON.parse(JSON.stringify(project)) as MotionProject;
  if (finding.code === "text_overflow") {
    const match = /^scenes\.([^.]+)\.layers\.(.+)$/.exec(finding.path);
    if (match) {
      const scene = next.scenes.find((item) => item.id === match[1]);
      const node = scene?.layers.find((item) => item.id === match[2]);
      if (node?.type === "text") {
        const box = Math.max(1, node.transform.width);
        const needed =
          box / Math.max(1, getTextPayloadPlain(node.payload).length * 0.55);
        node.payload.fontSize = Math.min(
          node.payload.fontSize,
          Math.max(12, needed),
        );
      }
    }
  }
  if (finding.code === "missing_cta" && next.scenes.length > 0) {
    const last = next.scenes[next.scenes.length - 1]!;
    last.name = "cta";
    for (const node of last.layers) {
      if (node.type === "text") {
        node.semantic = { role: "cta", key: "cta.copy", tags: [] };
      }
    }
  }
  if (finding.code === "empty_scene") {
    const match = /^scenes\.([^.]+)$/.exec(finding.path);
    const scene = next.scenes.find((item) => item.id === match?.[1]);
    if (scene && scene.layers.length === 0) {
      scene.layers.push({
        id: `node.repair.${scene.id}`,
        type: "text",
        parentLayerId: null,
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
        payload: {
          content: { kind: "plain", text: "Continue" },
          fontSize: 48,
          align: "center",
        },
        style: { fill: "#ffffff" },
        semantic: { role: "hook", key: "hook.copy", tags: [] },
      });
    }
  }
  return next;
}
