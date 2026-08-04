export type ProceduralDriver =
  | {
      id: string;
      type: "oscillator";
      frequency: number;
      amplitude: number;
      phase: number;
      waveform: "sine" | "triangle" | "square" | "sawtooth";
    }
  | {
      id: string;
      type: "noise";
      frequency: number;
      amplitude: number;
      seed: number;
    }
  | {
      id: string;
      type: "link";
      sourceNodeId: string;
      sourceProperty: string;
      multiplier: number;
      offset: number;
    }
  | {
      id: string;
      type: "remap";
      sourceNodeId: string;
      sourceProperty: string;
      inMin: number;
      inMax: number;
      outMin: number;
      outMax: number;
    };

export function evaluateOscillator(driver: Extract<ProceduralDriver, { type: "oscillator" }>, time: number): number {
  const phase = (time * driver.frequency + driver.phase / 360) % 1;
  const normalized = phase < 0 ? phase + 1 : phase;
  switch (driver.waveform) {
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
