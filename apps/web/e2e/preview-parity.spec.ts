import { expect, test } from "@playwright/test";

/** Worker golden values from validate-runtime-primitives hierarchy assertions. */
const WORKER = {
  t0: {
    shoulder: { x: 605, y: 720 },
    elbow: { x: 715, y: 720 },
    wrist: { x: 805, y: 720 },
  },
  t1: {
    elbow: { x: 682.7817, y: 797.7817 },
    wrist: { x: 756.5054, y: 746.1598 },
    propOpacity: 0.65,
  },
} as const;

async function readParity(page: import("@playwright/test").Page) {
  const raw = await page.getByTestId("runtime-parity-json").textContent();
  expect(raw).toBeTruthy();
  return JSON.parse(raw!) as {
    time: number;
    nodes: Array<{
      id: string;
      worldOrigin: { x: number; y: number };
      worldOpacity: number;
      flipX: boolean;
      worldMatrixA: number;
    }>;
  };
}

function nodeAt(payload: Awaited<ReturnType<typeof readParity>>, id: string) {
  const node = payload.nodes.find((entry) => entry.id === id);
  expect(node, `missing node ${id}`).toBeTruthy();
  return node!;
}

test.describe("Runtime IR preview parity", () => {
  test("hierarchy-transform t=0/1/1.5 matches worker evaluateScene", async ({ page }) => {
    await page.goto("/appai/runtime-harness");
    await expect(page.getByRole("heading", { name: /Runtime IR harness/i })).toBeVisible();

    await page.getByTestId("parity-time-0").click();
    const at0 = await readParity(page);
    expect(at0.time).toBe(0);
    expect(nodeAt(at0, "bone.shoulder").worldOrigin.x).toBeCloseTo(WORKER.t0.shoulder.x, 3);
    expect(nodeAt(at0, "bone.shoulder").worldOrigin.y).toBeCloseTo(WORKER.t0.shoulder.y, 3);
    expect(nodeAt(at0, "bone.elbow").worldOrigin.x).toBeCloseTo(WORKER.t0.elbow.x, 3);
    expect(nodeAt(at0, "bone.elbow").worldOrigin.y).toBeCloseTo(WORKER.t0.elbow.y, 3);
    expect(nodeAt(at0, "bone.wrist").worldOrigin.x).toBeCloseTo(WORKER.t0.wrist.x, 3);
    expect(nodeAt(at0, "bone.wrist").worldOrigin.y).toBeCloseTo(WORKER.t0.wrist.y, 3);

    await page.getByTestId("parity-time-1").click();
    const at1 = await readParity(page);
    expect(at1.time).toBe(1);
    expect(nodeAt(at1, "bone.elbow").worldOrigin.x).toBeCloseTo(WORKER.t1.elbow.x, 3);
    expect(nodeAt(at1, "bone.elbow").worldOrigin.y).toBeCloseTo(WORKER.t1.elbow.y, 3);
    expect(nodeAt(at1, "bone.wrist").worldOrigin.x).toBeCloseTo(WORKER.t1.wrist.x, 3);
    expect(nodeAt(at1, "bone.wrist").worldOrigin.y).toBeCloseTo(WORKER.t1.wrist.y, 3);
    expect(nodeAt(at1, "part.prop").worldOpacity).toBeCloseTo(WORKER.t1.propOpacity, 3);

    await page.getByTestId("parity-time-1_5").click();
    const at15 = await readParity(page);
    expect(at15.time).toBe(1.5);
    const root = nodeAt(at15, "rig.root");
    expect(root.flipX).toBe(true);
    expect(root.worldMatrixA).toBeLessThan(0);
  });
});
