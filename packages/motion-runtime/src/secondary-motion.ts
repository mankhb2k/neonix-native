export type SecondaryMotionParams = {
  chainLength: number;
  stiffness: number;
  damping: number;
  lag: number;
  amplitude: number;
};

export const SECONDARY_DT = 1 / 60;

export function solveSecondaryMotionChain(
  time: number,
  params: SecondaryMotionParams,
  driverRotationAt: (time: number) => number,
): number[] {
  const angles = Array.from({ length: params.chainLength }, () => 0);
  const velocities = Array.from({ length: params.chainLength }, () => 0);
  const steps = Math.max(0, Math.floor(time / SECONDARY_DT));

  const integrate = (sampleTime: number, dt: number): void => {
    let parentRotation = driverRotationAt(Math.max(0, sampleTime - params.lag)) * params.amplitude;
    for (let index = 0; index < params.chainLength; index += 1) {
      const force = (parentRotation - angles[index]!) * params.stiffness - velocities[index]! * params.damping;
      velocities[index] = velocities[index]! + force * dt;
      angles[index] = angles[index]! + velocities[index]! * dt;
      parentRotation = angles[index]!;
    }
  };

  for (let step = 1; step <= steps; step += 1) integrate(step * SECONDARY_DT, SECONDARY_DT);
  const remainder = time - steps * SECONDARY_DT;
  if (remainder > 0) integrate(time, remainder);
  return angles;
}
