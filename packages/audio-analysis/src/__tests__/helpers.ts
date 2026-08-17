/** Synthetic audio generators for unit tests (no Web Audio needed). */

export function silence(sampleRate: number, durationSeconds: number): Float32Array {
  return new Float32Array(Math.floor(sampleRate * durationSeconds));
}

export function sine(
  sampleRate: number,
  durationSeconds: number,
  freqHz: number,
  amplitude = 0.5,
): Float32Array {
  const n = Math.floor(sampleRate * durationSeconds);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = amplitude * Math.sin((2 * Math.PI * freqHz * i) / sampleRate);
  }
  return out;
}

export function noise(
  sampleRate: number,
  durationSeconds: number,
  amplitude = 0.5,
): Float32Array {
  const n = Math.floor(sampleRate * durationSeconds);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = (Math.random() * 2 - 1) * amplitude;
  }
  return out;
}

/** Short bass bursts (with exponential decay) at regular beat intervals. */
export function pulseTrain(
  sampleRate: number,
  durationSeconds: number,
  beatSeconds: number,
  freqHz = 60,
): Float32Array {
  const n = Math.floor(sampleRate * durationSeconds);
  const out = new Float32Array(n);
  const burstSamples = Math.floor(0.12 * sampleRate);
  for (let t = 0; t < durationSeconds; t += beatSeconds) {
    const start = Math.floor(t * sampleRate);
    for (let i = 0; i < burstSamples && start + i < n; i++) {
      const env = Math.exp(-i / (0.03 * sampleRate));
      out[start + i] += env * Math.sin((2 * Math.PI * freqHz * i) / sampleRate);
    }
  }
  return out;
}

export function concat(parts: Float32Array[]): Float32Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function max(values: number[]): number {
  return values.reduce((m, v) => Math.max(m, v), 0);
}
