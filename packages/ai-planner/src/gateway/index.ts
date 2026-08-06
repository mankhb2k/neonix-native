import { AnthropicGateway } from "./anthropic-gateway";
import { StubModelGateway } from "./stub-gateway";
import type { ModelGateway } from "./types";

export type { ModelGateway, StructuredGenerateRequest, StructuredGenerateResult, StructuredTask } from "./types";
export { AnthropicGateway } from "./anthropic-gateway";
export { StubModelGateway } from "./stub-gateway";

export function createModelGateway(options?: {
  mode?: string;
  apiKey?: string;
}): ModelGateway {
  const mode = (options?.mode ?? process.env.AI_MODE ?? "stub").toLowerCase();
  if (mode === "live" || mode === "anthropic") {
    return new AnthropicGateway(options?.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "");
  }
  return new StubModelGateway();
}
