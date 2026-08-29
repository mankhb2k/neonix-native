import type { VideoPlanSinkV3 } from "../core/types";

export type VideoEngineV3 = VideoPlanSinkV3 & { start?(): void; stop?(): void; flush?(): void };
