const MAX_PYRAMID_LEVELS = 8;
const MAX_LEVEL_SIGMA = 4;

export type BlurPyramidPlan = {
  levels: number;
  levelSigma: number;
};

/**
 * Keeps the Gaussian kernel compact while preserving radius in output pixels.
 * Each 2x downsample divides the sigma seen by the blur shader by two.
 */
export function blurPyramidPlan(
  physicalSigma: number,
  width: number,
  height: number,
): BlurPyramidPlan {
  const sigma = Math.max(0, physicalSigma);
  let levels = 0;
  let levelWidth = Math.max(1, Math.round(width));
  let levelHeight = Math.max(1, Math.round(height));
  let levelSigma = sigma;

  while (
    levelSigma > MAX_LEVEL_SIGMA &&
    levels < MAX_PYRAMID_LEVELS &&
    (levelWidth > 1 || levelHeight > 1)
  ) {
    levels += 1;
    levelWidth = Math.max(1, Math.ceil(levelWidth / 2));
    levelHeight = Math.max(1, Math.ceil(levelHeight / 2));
    levelSigma = sigma / 2 ** levels;
  }

  return { levels, levelSigma };
}
