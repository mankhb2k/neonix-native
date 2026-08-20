export const V2_CERTIFIED_ATOMS = [
  "shape.rectangle.fill",
  "shape.rectangle.stroke",
  "shape.rectangle.transform",
  "shape.rectangle.timing",
  "shape.rectangle.opacity",
  "shape.rectangle.zIndex",
  "shape.ellipse.fill",
  "shape.ellipse.transform",
  "shape.ellipse.timing",
  "shape.ellipse.opacity",
  "shape.ellipse.zIndex",
] as const;

export type V2CertifiedAtom = (typeof V2_CERTIFIED_ATOMS)[number];

export function isV2AtomCertified(value: string): value is V2CertifiedAtom {
  return (V2_CERTIFIED_ATOMS as readonly string[]).includes(value);
}
