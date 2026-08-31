import { rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const distDir = process.env.NEXT_DIST_DIR ?? ".next-dev";
const nextBinary = resolve(process.cwd(), "node_modules", "next", "dist", "bin", "next");

async function main(): Promise<void> {
  // Remove only the disposable Next development cache. Production/build output
  // in .next is left untouched unless the caller explicitly selects it.
  await rm(resolve(process.cwd(), distDir), { recursive: true, force: true });

  const child = spawn(process.execPath, [nextBinary, "dev"], {
    stdio: "inherit",
    env: { ...process.env, NEXT_DIST_DIR: distDir },
  });

  const exitCode = await new Promise<number>((resolveExit) => {
    child.once("error", (error) => {
      process.stderr.write(`${String(error)}\n`);
      resolveExit(1);
    });
    child.once("exit", (code, signal) => {
      resolveExit(code ?? (signal ? 1 : 0));
    });
  });

  process.exitCode = exitCode;
}

void main();
