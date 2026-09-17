import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

const binary = process.env.LIBYUV_COLOR_TEST_BINARY ?? "/usr/local/bin/neonix-libyuv-color-ab-test";
const reportPath = resolve(process.env.LIBYUV_COLOR_TEST_REPORT ?? "/tmp/libyuv-color-contract.json");
const enforceParity = process.env.LIBYUV_ENFORCE_PARITY === "true";

const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolveResult, reject) => {
  const child = spawn(binary, enforceParity ? ["--enforce-parity"] : [], { stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
  child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
  child.once("error", reject);
  child.once("close", (code) => resolveResult({ code: code ?? 1, stdout, stderr }));
});

const line = result.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
if (!line) {
  throw new Error(`libyuv color test emitted no JSON. exit=${result.code} stderr=${result.stderr}`);
}
const report = JSON.parse(line) as Record<string, unknown>;
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify({ ...report, binary, enforceParity }, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ reportPath, ...report }));
if (result.code !== 0) {
  throw new Error(`libyuv color contract failed. report=${reportPath} stderr=${result.stderr}`);
}
