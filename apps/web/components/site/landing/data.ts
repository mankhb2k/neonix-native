/** Content data for the landing page (EN). */

export const USE_CASES = [
  {
    title: "Neon music visualizers",
    desc: "Pulse rings, bars, and glows locked to the beat.",
  },
  {
    title: "Cyberpunk YouTube stories",
    desc: "Cinematic HUD scenes for narrative videos.",
  },
  {
    title: "Glowing lyric & title videos",
    desc: "Word-timed captions with neon type treatment.",
  },
  {
    title: "AI-generated motion templates",
    desc: "Reusable components AI can remix per brief.",
  },
  {
    title: "Podcast & reel visuals",
    desc: "Audio-reactive loops for vertical feeds.",
  },
  {
    title: "Brand intros & outros",
    desc: "On-brand glow stings for every channel.",
  },
] as const;

export const FEATURES = [
  {
    title: "AI-first JSON protocol",
    desc: "Strict, editable motion document.",
  },
  {
    title: "Neon & cyber effects",
    desc: "Glow, inner-glow, noise, and blur.",
  },
  {
    title: "Reusable components",
    desc: "Templates with safe, swappable props.",
  },
  {
    title: "Beat-synced motion",
    desc: "Keyframes generated from audio analysis.",
  },
  {
    title: "Timeline keyframes",
    desc: "Frame-accurate property animation.",
  },
  {
    title: "R2 managed assets",
    desc: "Deterministic, project-scoped storage.",
  },
  {
    title: "Production renderer",
    desc: "Pixel-identical export to MP4.",
  },
  {
    title: "Template system",
    desc: "Character, HUD, and visualizer kits.",
  },
] as const;

export const EFFECTS = [
  { name: "Outer Glow", swatch: "rgba(34,211,238,0.55)" },
  { name: "Inner Glow", swatch: "rgba(103,232,249,0.45)" },
  { name: "Noise Grain", swatch: "rgba(148,163,184,0.35)" },
  { name: "Cyber Stroke", swatch: "rgba(192,132,252,0.6)" },
  { name: "Blend Modes", swatch: "rgba(59,130,246,0.5)" },
  { name: "Color Adjust", swatch: "rgba(232,121,249,0.5)" },
] as const;

export const TEMPLATES = [
  { name: "Character", props: "color · text · pose" },
  { name: "Visualizer", props: "audio · palette · shape" },
  { name: "Cyber HUD", props: "metrics · layout · glow" },
  { name: "Intro / Outro", props: "logo · brand · timing" },
] as const;

export const GALLERY = [
  "Neon DJ visualizer",
  "Cyber UI explainer",
  "Glowing quote video",
  "Futuristic product promo",
  "Storytelling character scene",
] as const;

export const PAINS = [
  "Complex timelines",
  "Manual keyframes",
  "Hard-to-customize templates",
  "AI can't export editor-ready files",
  "Music videos need beat-synced motion",
] as const;

export const FLOW_A = ["Prompt", "JSON", "Compile", "Render"] as const;
export const FLOW_B = [
  "Upload audio",
  "Analyze beat",
  "Generate keyframes",
  "Render neon video",
] as const;

export const WAVEFORM_SAMPLE: number[] = Array.from({ length: 64 }, (_, i) => {
  const t = i / 63;
  // Deterministic pseudo-waveform: low hum + a few beat spikes.
  const hum = 0.25 + 0.2 * Math.sin(t * Math.PI * 5);
  const spike = i % 8 === 0 ? 0.5 + 0.5 * Math.abs(Math.sin(i)) : 0;
  return Math.min(1, hum + spike);
});
