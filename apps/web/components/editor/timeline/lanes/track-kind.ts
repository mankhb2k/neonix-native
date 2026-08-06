export type TimelineTrackKind = "main" | "overlay" | "audio";

export type DesignLaneRole = "base" | "overlay" | "audio";

export function trackKindForRole(role: DesignLaneRole): TimelineTrackKind {
  if (role === "audio") return "audio";
  if (role === "base") return "main";
  return "overlay";
}
