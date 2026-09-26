import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { compileDocument, stampNodeIds } from "@motionvideo/html-compiler";
import { compileHtmlWithLayoutSnapshot, fetchLayoutSnapshot } from "./layout-snapshot";

const HTML = `<!doctype html>
<html><head><meta name="neonix-document" content='{"kind":"neonix-html-document","schemaVersion":2,"composition":{"width":1920,"height":1080,"fps":30,"durationMs":1000,"background":"#081018","colorSpace":"srgb"}}'></head>
<body><div id="box" style="position:absolute;left:10px;top:10px;width:100px;height:50px;background:#22d3ee"></div></body></html>`;

function resetEnv() {
  delete process.env.LAYOUT_SNAPSHOT_ENABLED;
  delete process.env.LAYOUT_SNAPSHOT_URL;
  delete process.env.LAYOUT_SNAPSHOT_TIMEOUT_MS;
  delete process.env.INTERNAL_WORKER_TOKEN;
}

afterEach(() => {
  resetEnv();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("fetchLayoutSnapshot", () => {
  it("returns undefined and never calls fetch when the flag is off (the default)", async () => {
    resetEnv();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await fetchLayoutSnapshot("job-1", HTML, []);
    expect(result).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns undefined when the flag is on but URL/token are unconfigured", async () => {
    resetEnv();
    process.env.LAYOUT_SNAPSHOT_ENABLED = "true";
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await fetchLayoutSnapshot("job-1", HTML, [])).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns undefined on a network error (never throws)", async () => {
    resetEnv();
    process.env.LAYOUT_SNAPSHOT_ENABLED = "true";
    process.env.LAYOUT_SNAPSHOT_URL = "http://layout-probe.internal";
    process.env.INTERNAL_WORKER_TOKEN = "test-token";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    await expect(fetchLayoutSnapshot("job-1", HTML, [])).resolves.toBeUndefined();
  });

  it("returns undefined on a non-2xx response", async () => {
    resetEnv();
    process.env.LAYOUT_SNAPSHOT_ENABLED = "true";
    process.env.LAYOUT_SNAPSHOT_URL = "http://layout-probe.internal";
    process.env.INTERNAL_WORKER_TOKEN = "test-token";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503, json: () => Promise.resolve({}) }));
    expect(await fetchLayoutSnapshot("job-1", HTML, [])).toBeUndefined();
  });

  it("returns undefined when the service itself reports ok: false", async () => {
    resetEnv();
    process.env.LAYOUT_SNAPSHOT_ENABLED = "true";
    process.env.LAYOUT_SNAPSHOT_URL = "http://layout-probe.internal";
    process.env.INTERNAL_WORKER_TOKEN = "test-token";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ ok: false, error: "layout_probe_unavailable" }) }));
    expect(await fetchLayoutSnapshot("job-1", HTML, [])).toBeUndefined();
  });

  it("returns the snapshot on success", async () => {
    resetEnv();
    process.env.LAYOUT_SNAPSHOT_ENABLED = "true";
    process.env.LAYOUT_SNAPSHOT_URL = "http://layout-probe.internal";
    process.env.INTERNAL_WORKER_TOKEN = "test-token";
    const snapshot = { n0: { x: 10, y: 10, width: 100, height: 50, padding: [0, 0, 0, 0], border: [0, 0, 0, 0] } };
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, snapshot }) });
    vi.stubGlobal("fetch", fetchSpy);
    expect(await fetchLayoutSnapshot("job-1", HTML, [])).toEqual(snapshot);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://layout-probe.internal/v1/layout/probe");
    expect((init.headers as Record<string, string>)["x-internal-worker-token"]).toBe("test-token");
  });

  it("aborts and returns undefined when the service never responds within the timeout", async () => {
    resetEnv();
    process.env.LAYOUT_SNAPSHOT_ENABLED = "true";
    process.env.LAYOUT_SNAPSHOT_URL = "http://layout-probe.internal";
    process.env.INTERNAL_WORKER_TOKEN = "test-token";
    process.env.LAYOUT_SNAPSHOT_TIMEOUT_MS = "10";
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      })),
    );
    await expect(fetchLayoutSnapshot("job-1", HTML, [])).resolves.toBeUndefined();
  });
});

describe("compileHtmlWithLayoutSnapshot", () => {
  it("with the flag off (the default), compiles identically to calling compileDocument directly - stamping is inert", async () => {
    resetEnv();
    const withHelper = await compileHtmlWithLayoutSnapshot({ html: HTML }, []);
    const direct = compileDocument({ html: stampNodeIds(HTML) }, {});
    expect(withHelper.protocol?.layers).toEqual(direct.protocol?.layers);
  });
});
