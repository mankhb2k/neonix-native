import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runCli } from "./index";

describe("html compiler CLI", () => {
  it("creates a blue rectangle project with source and compiled protocol files", async () => {
    const directory = await mkdtemp(join(tmpdir(), "neonix-html-cli-"));
    const projectDirectory = join(directory, "blue-rectangle");

    expect((await runCli(["new", projectDirectory, "--example", "blue-rectangle"])).exitCode).toBe(0);
    expect((await runCli(["compile", projectDirectory])).exitCode).toBe(0);

    const html = await readFile(join(projectDirectory, "src", "scene.html"), "utf8");
    const css = await readFile(join(projectDirectory, "src", "scene.css"), "utf8");
    const config = JSON.parse(await readFile(join(projectDirectory, "neonix.config.json"), "utf8")) as Record<string, unknown>;
    const protocol = JSON.parse(await readFile(join(projectDirectory, "protocol-v2.json"), "utf8")) as { composition: Record<string, unknown>; layers: Array<Record<string, unknown>> };
    expect(config).toMatchObject({
      kind: "neonix-html-project",
      schemaVersion: 1,
      composition: { width: 1920, height: 1080, fps: 30, background: "#081018", colorSpace: "srgb" },
    });
    expect(html).toContain('<div id="blue-rectangle"></div>');
    expect(css).toContain("#2563eb");
    expect(protocol.composition).toMatchObject({ width: 1920, height: 1080, fps: 30 });
    expect(protocol.layers[0]).toMatchObject({ id: "blue-rectangle", type: "shape", style: { fill: "#2563eb" } });
  });

  it("does not overwrite an existing source file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "neonix-html-cli-"));
    expect((await runCli(["new", directory])).exitCode).toBe(0);
    expect((await runCli(["new", directory])).exitCode).toBe(1);
  });
});
