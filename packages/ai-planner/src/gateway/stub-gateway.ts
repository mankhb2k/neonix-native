import {
  buildBlankProjectCommands,
  buildCreativePlanFromBrief,
  buildSceneDesignFromPlan,
} from "../from-scratch";
import {
  parseCreativeBriefV1,
  type CreativeBriefV1,
  type CreativePlanV1,
  type SceneDesignPlanV1,
} from "../contracts";
import type { AuthoringCommand } from "../commands";
import type {
  ModelGateway,
  StructuredGenerateRequest,
  StructuredGenerateResult,
} from "./types";

type RepairInput = {
  projectSummary: unknown;
  findings: Array<{
    code: string;
    path: string;
    message: string;
    repairHint?: string;
  }>;
  targetedIds?: string[];
};

/**
 * Deterministic gateway — mirrors from-scratch assemblers (AI_MODE=stub).
 */
export class StubModelGateway implements ModelGateway {
  async generateStructured<T>(
    request: StructuredGenerateRequest,
  ): Promise<StructuredGenerateResult<T>> {
    const started = Date.now();
    let value: unknown;

    switch (request.task) {
      case "creative-plan": {
        const brief = parseCreativeBriefV1(
          (request.input as { brief: unknown }).brief,
        );
        const industry =
          (request.input as { industry?: string }).industry ?? "fnb";
        value = buildCreativePlanFromBrief(brief, industry);
        break;
      }
      case "scene-design": {
        const plan = (request.input as { plan: CreativePlanV1 }).plan;
        const planId = (request.input as { planId: string }).planId;
        value = buildSceneDesignFromPlan(plan, planId);
        break;
      }
      case "command-batch": {
        const brief = parseCreativeBriefV1(
          (request.input as { brief: CreativeBriefV1 }).brief,
        );
        const plan = (request.input as { plan: CreativePlanV1 }).plan;
        const sceneDesign = (
          request.input as { sceneDesign: SceneDesignPlanV1 }
        ).sceneDesign;
        const projectId = (request.input as { projectId: string }).projectId;
        const allowlistedAssetIds =
          (request.input as { allowlistedAssetIds?: string[] })
            .allowlistedAssetIds ?? [];
        const commands = buildBlankProjectCommands({
          brief,
          plan,
          sceneDesign,
          projectId,
        });
        // Inject supplied media when brief supplies allowlisted assets (Z2/Z10 stub path).
        if (allowlistedAssetIds.length > 0 && plan.scenes[0]) {
          const sceneId = plan.scenes[0]!.id;
          const assetId = allowlistedAssetIds[0]!;
          const assets = (brief.suppliedAssets ?? []).filter((a) =>
            allowlistedAssetIds.includes(a.id),
          );
          const first = assets[0];
          const isSvg =
            (first?.uri ?? "").endsWith(".svg") || first?.role === "logo";
          commands.splice(
            commands.findIndex((c) => c.type === "validateProject"),
            0,
            isSvg
              ? {
                  type: "addSvgNode",
                  sceneId,
                  layerId: `node.svg.${assetId}`,
                  assetId,
                  fit: "contain",
                  transform: {
                    x: brief.aspectRatio === "16:9" ? 960 : 540,
                    y: brief.aspectRatio === "9:16" ? 520 : 360,
                    width: 320,
                    height: 320,
                    anchorX: 0.5,
                    anchorY: 0.5,
                  },
                  semanticRole: "logo",
                  semanticKey: "brand.logo",
                }
              : {
                  type: "addImageNode",
                  sceneId,
                  layerId: `node.image.${assetId}`,
                  assetId,
                  fit: "contain",
                  transform: {
                    x: brief.aspectRatio === "16:9" ? 960 : 540,
                    y: brief.aspectRatio === "9:16" ? 520 : 360,
                    width: brief.aspectRatio === "16:9" ? 640 : 720,
                    height: brief.aspectRatio === "9:16" ? 720 : 480,
                    anchorX: 0.5,
                    anchorY: 0.5,
                  },
                  semanticRole: "demo",
                  semanticKey: "product.image",
                },
          );
        }
        value = {
          format: "moticlip-command-batch",
          formatVersion: 1,
          baseRevision: 0,
          commands,
        };
        break;
      }
      case "repair": {
        const repair = request.input as RepairInput;
        const commands: AuthoringCommand[] = [];
        for (const finding of repair.findings.slice(0, 8)) {
          if (finding.code === "text_overflow") {
            const match = /^scenes\.([^.]+)\.layers\.(.+)$/.exec(finding.path);
            if (match) {
              commands.push({
                type: "setNodePayload",
                sceneId: match[1]!,
                layerId: match[2]!,
                payload: { fontSize: 48 },
              });
            }
          } else if (
            finding.code === "empty_scene" ||
            finding.code === "empty_project"
          ) {
            const sceneMatch = /^scenes\.([^.]+)/.exec(finding.path);
            const sceneId = sceneMatch?.[1] ?? "scene.hook.1";
            commands.push({
              type: "addNode",
              sceneId,
              layerId: `node.repair.${sceneId.replace(/\./g, "_")}`,
              nodeType: "text",
              text: "Continue",
              fontSize: 48,
              fill: "#ffffff",
              semanticRole: "hook",
              transform: {
                x: 540,
                y: 960,
                width: 900,
                height: 120,
                anchorX: 0.5,
                anchorY: 0.5,
              },
            });
          } else if (finding.code === "overlap") {
            const match = /^scenes\.([^.]+)/.exec(finding.path);
            if (match) {
              commands.push({
                type: "setLayoutConstraint",
                sceneId: match[1]!,
                layerId: `group.${match[1]}`,
                modifierId: `lay.repair.${match[1]}`,
                constraint: {
                  kind: "stack",
                  direction: "vertical",
                  gap: 24,
                  padding: 16,
                  align: "center",
                },
              });
            }
          }
        }
        if (commands.length === 0) {
          commands.push({ type: "validateProject" });
        }
        value = {
          format: "moticlip-command-batch",
          formatVersion: 1,
          baseRevision:
            (request.input as { baseRevision?: number }).baseRevision ?? 0,
          commands,
        };
        break;
      }
      default:
        throw new Error(`Unknown task: ${request.task}`);
    }

    return {
      value: value as T,
      usage: { inputTokens: 0, outputTokens: 0 },
      latencyMs: Date.now() - started,
      providerRequestId: `stub_${request.task}_${request.seed ?? "0"}`,
    };
  }
}
