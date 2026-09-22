export function cssColorToRgba(value: string | undefined): [number, number, number, number] {
  const fallback: [number, number, number, number] = [1, 1, 1, 1];
  if (!value) return fallback;
  const input = value.trim();
  const hex = input.startsWith("#") ? input.slice(1) : input;
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return [
      Number.parseInt(hex.slice(0, 2), 16) / 255,
      Number.parseInt(hex.slice(2, 4), 16) / 255,
      Number.parseInt(hex.slice(4, 6), 16) / 255,
      1,
    ];
  }
  if (/^[0-9a-f]{8}$/i.test(hex)) {
    return [
      Number.parseInt(hex.slice(0, 2), 16) / 255,
      Number.parseInt(hex.slice(2, 4), 16) / 255,
      Number.parseInt(hex.slice(4, 6), 16) / 255,
      Number.parseInt(hex.slice(6, 8), 16) / 255,
    ];
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(input);
  if (!rgb) return fallback;
  return [
    Math.min(Number(rgb[1]) / 255, 1),
    Math.min(Number(rgb[2]) / 255, 1),
    Math.min(Number(rgb[3]) / 255, 1),
    rgb[4] === undefined ? 1 : Math.min(Number(rgb[4]), 1),
  ];
}
