import type { ProceduralDriverV2 } from "@motionvideo/motion-protocol";

export type ProceduralDriver = ProceduralDriverV2;

export function evaluateOscillator(
  driver: Extract<ProceduralDriver, { type: "oscillator" }>,
  time: number,
): number {
  const phase = (time * driver.frequency + (driver.phase ?? 0) / 360) % 1;
  const normalized = phase < 0 ? phase + 1 : phase;
  const waveform = driver.waveform ?? "sine";
  switch (waveform) {
    case "sine":
      return Math.sin(normalized * Math.PI * 2) * driver.amplitude;
    case "triangle":
      return (Math.abs(normalized - 0.5) * 4 - 1) * driver.amplitude;
    case "square":
      return (normalized < 0.5 ? 1 : -1) * driver.amplitude;
    case "sawtooth":
      return (normalized * 2 - 1) * driver.amplitude;
  }
}

export function evaluateNoise(driver: Extract<ProceduralDriver, { type: "noise" }>, time: number): number {
  const t = time * driver.frequency + driver.seed;
  const sample = Math.sin(t * 12.9898 + driver.seed * 78.233) * 43758.5453123;
  const fract = sample - Math.floor(sample);
  return (fract * 2 - 1) * driver.amplitude;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function wrap(value: number, min: number, max: number): number {
  const span = max - min;
  if (span <= 0) return min;
  const shifted = value - min;
  return min + ((((shifted % span) + span) % span));
}

export type DriverSampleContext = {
  time: number;
  /** Base property values before drivers (from tracks/transform). */
  readBase: (nodeId: string, property: string, atTime?: number) => number;
  /** Already-computed driver outputs for DAG. */
  readDriven: (nodeId: string, property: string) => number | undefined;
};

/** Evaluate one driver to a numeric contribution/override for its target. */
export function evaluateDriverValue(driver: ProceduralDriver, ctx: DriverSampleContext): number {
  const read = (nodeId: string, property: string): number => {
    const driven = ctx.readDriven(nodeId, property);
    if (driven !== undefined) return driven;
    return ctx.readBase(nodeId, property);
  };

  switch (driver.type) {
    case "oscillator":
      return ctx.readBase(driver.targetNodeId, driver.targetProperty) + evaluateOscillator(driver, ctx.time);
    case "noise":
      return ctx.readBase(driver.targetNodeId, driver.targetProperty) + evaluateNoise(driver, ctx.time);
    case "link":
      return read(driver.sourceNodeId, driver.sourceProperty) * (driver.multiplier ?? 1) + (driver.offset ?? 0);
    case "remap": {
      const raw = read(driver.sourceNodeId, driver.sourceProperty);
      const t = (raw - driver.inMin) / Math.max(1e-9, driver.inMax - driver.inMin);
      return driver.outMin + clamp(t, 0, 1) * (driver.outMax - driver.outMin);
    }
    case "clamp":
      return clamp(read(driver.sourceNodeId, driver.sourceProperty), driver.min, driver.max);
    case "wrap":
      return wrap(read(driver.sourceNodeId, driver.sourceProperty), driver.min, driver.max);
    case "quantize": {
      const raw = read(driver.sourceNodeId, driver.sourceProperty);
      return Math.round(raw / driver.step) * driver.step;
    }
    case "delay-follow":
      return ctx.readBase(driver.sourceNodeId, driver.sourceProperty, Math.max(0, ctx.time - driver.delay));
    case "spring-follow": {
      const target = read(driver.sourceNodeId, driver.sourceProperty);
      const current = ctx.readBase(driver.targetNodeId, driver.targetProperty);
      const k = driver.stiffness;
      const d = driver.damping;
      const alpha = 1 - Math.exp(-Math.sqrt(k) * 0.016) * Math.exp(-d * 0.0005);
      return current + (target - current) * clamp(alpha, 0, 1);
    }
    case "time-remap": {
      const remapped = ctx.time * (driver.scale ?? 1) + (driver.offset ?? 0);
      return ctx.readBase(driver.targetNodeId, driver.targetProperty) + remapped * 0;
    }
    default: {
      const neverDriver: never = driver;
      throw new Error(`Unknown driver type: ${JSON.stringify(neverDriver)}`);
    }
  }
}

/**
 * Topological evaluation of scene drivers. Detects cycles.
 * Returns map key `${nodeId}::${property}` → driven value.
 */
export function evaluateDriverGraph(
  drivers: readonly ProceduralDriver[],
  ctx: Omit<DriverSampleContext, "readDriven"> & { readDriven?: DriverSampleContext["readDriven"] },
): Map<string, number> {
  const byId = new Map(drivers.map((driver) => [driver.id, driver]));
  if (byId.size !== drivers.length) throw new Error("Duplicate procedural driver id");

  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const driver of drivers) {
    indegree.set(driver.id, 0);
    dependents.set(driver.id, []);
  }

  const sourceKey = (driver: ProceduralDriver): string | undefined => {
    if ("sourceNodeId" in driver && "sourceProperty" in driver) {
      return `${driver.sourceNodeId}::${driver.sourceProperty}`;
    }
    return undefined;
  };

  const producers = new Map<string, string>();
  for (const driver of drivers) {
    producers.set(`${driver.targetNodeId}::${driver.targetProperty}`, driver.id);
  }

  for (const driver of drivers) {
    const src = sourceKey(driver);
    if (!src) continue;
    const producerId = producers.get(src);
    if (!producerId || producerId === driver.id) continue;
    dependents.get(producerId)!.push(driver.id);
    indegree.set(driver.id, (indegree.get(driver.id) ?? 0) + 1);
  }

  const queue = [...drivers].filter((driver) => (indegree.get(driver.id) ?? 0) === 0).map((driver) => driver.id);
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of dependents.get(id) ?? []) {
      indegree.set(next, (indegree.get(next) ?? 0) - 1);
      if (indegree.get(next) === 0) queue.push(next);
    }
  }
  if (order.length !== drivers.length) throw new Error("Procedural driver cycle detected");

  const outputs = new Map<string, number>();
  const readDriven = (nodeId: string, property: string) => outputs.get(`${nodeId}::${property}`);

  for (const id of order) {
    const driver = byId.get(id)!;
    const value = evaluateDriverValue(driver, {
      time: ctx.time,
      readBase: ctx.readBase,
      readDriven,
    });
    outputs.set(`${driver.targetNodeId}::${driver.targetProperty}`, value);
  }
  return outputs;
}
