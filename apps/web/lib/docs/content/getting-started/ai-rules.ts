export const AI_GLOBAL = [
  "Write MotionProjectV1 — format motion-project, formatVersion 1.",
  "Use project.layers as timeline lanes. Do not emit scenes or visualTracks.",
  "Every layer needs zIndex and timing. Nested zIndex is always >= 0. Sibling zIndex is unique.",
  "Child timing.start is local to the parent. Keep the child inside the parent duration.",
  "frame is the local size box before transform. Required on every visual layer including group. Never on audio or camera. Do not derive group.frame from children.",
  "group is a visual container and must have children and frame. group.frame does not clip. Use a mask to cut.",
  "Use appearance.opacity for opacity (integer 0..100).",
  "Layout lives on group.layout (mode row|column|grid). Children use layoutItem (fixed|hug|fill). Not a modifier. Do not emit wrap, grow, shrink, or grid span.",
  "Use transform.depth for parallax. Never invent transform.z.",
  "Use zIndex for stacking, not depth.",
  "Do not emit locked. semantic is optional tagging and does not change paint.",
  "Write the project file. Do not write JSON for a preview surface.",
];
