export type StructuredTask = "creative-plan" | "scene-design" | "command-batch" | "repair";

export type StructuredGenerateRequest = {
  task: StructuredTask;
  systemPromptVersion: string;
  schemaDescription: string;
  input: unknown;
  model: string;
  seed?: string;
  maxOutputTokens: number;
};

export type StructuredGenerateResult<T> = {
  value: T;
  usage: { inputTokens: number; outputTokens: number };
  latencyMs: number;
  providerRequestId?: string;
  rawText?: string;
};

export interface ModelGateway {
  generateStructured<T>(request: StructuredGenerateRequest): Promise<StructuredGenerateResult<T>>;
}
