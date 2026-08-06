import { modelCapabilityPromptBlock } from "../model-allowlist";
import type { ModelGateway, StructuredGenerateRequest, StructuredGenerateResult } from "./types";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

/**
 * Anthropic Messages API gateway with JSON object extraction + Zod-ready parse at caller.
 */
export class AnthropicGateway implements ModelGateway {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = "https://api.anthropic.com/v1/messages",
  ) {
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is required when AI_MODE=live");
    }
  }

  async generateStructured<T>(request: StructuredGenerateRequest): Promise<StructuredGenerateResult<T>> {
    const started = Date.now();
    const system = [
      `You are MotiClip zero-template planner. Task=${request.task}. PromptVersion=${request.systemPromptVersion}.`,
      modelCapabilityPromptBlock(),
      "Respond with a single JSON object only. No markdown fences. No commentary.",
      `Schema:\n${request.schemaDescription}`,
    ].join("\n\n");

    const body = {
      model: request.model || DEFAULT_MODEL,
      max_tokens: request.maxOutputTokens,
      system,
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            seed: request.seed,
            input: request.input,
          }),
        },
      ],
    };

    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic ${response.status}: ${errText.slice(0, 500)}`);
    }

    const payload = (await response.json()) as {
      id?: string;
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const text = payload.content?.find((block) => block.type === "text")?.text ?? "";
    const jsonText = extractJsonObject(text);
    let value: T;
    try {
      value = JSON.parse(jsonText) as T;
    } catch (error) {
      throw new Error(
        `Failed to parse Anthropic JSON for ${request.task}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return {
      value,
      usage: {
        inputTokens: payload.usage?.input_tokens ?? 0,
        outputTokens: payload.usage?.output_tokens ?? 0,
      },
      latencyMs: Date.now() - started,
      providerRequestId: payload.id,
      rawText: text,
    };
  }
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenced?.[1]) return fenced[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  throw new Error("No JSON object found in model response");
}
