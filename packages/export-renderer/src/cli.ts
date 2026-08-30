import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createNativeExportSmokeProject } from "./testing";
import { renderRuntimeProjectV3 } from "./render/render";

const outputRoot = join(fileURLToPath(new URL("../../..", import.meta.url)), "tmp", "export-renderer");
const outputPath = join(outputRoot, "native-export-smoke.mp4");
await mkdir(outputRoot, { recursive: true });
const stats = await renderRuntimeProjectV3(createNativeExportSmokeProject(), { outputPath });
console.log(JSON.stringify(stats, null, 2));
