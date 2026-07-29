export const FRAME_LIBRARY_MIME = "application/x-motionvideo-frame";
export const DEFAULT_FRAME_DURATION = 5;

export type FrameDraft = {
  id: string;
  name: string;
  role?: string;
  duration: number;
  text: string;
};

function storageKey(projectId: string): string {
  return `motionvideo.frameLibrary.${projectId}`;
}

function read(projectId: string): FrameDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(storageKey(projectId)) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter((item): item is FrameDraft => {
      if (!item || typeof item !== "object") return false;
      const draft = item as FrameDraft;
      return typeof draft.id === "string" && typeof draft.name === "string" && typeof draft.duration === "number";
    });
  } catch {
    return [];
  }
}

function write(projectId: string, frames: FrameDraft[]): void {
  window.localStorage.setItem(storageKey(projectId), JSON.stringify(frames));
}

export function listFrames(projectId: string): FrameDraft[] {
  return read(projectId);
}

export function saveFrames(projectId: string, frames: FrameDraft[]): void {
  write(projectId, frames);
}

export function addFrame(
  projectId: string,
  patch?: Partial<Pick<FrameDraft, "name" | "role" | "duration" | "text">>,
): FrameDraft {
  const frames = read(projectId);
  const index = frames.length + 1;
  const draft: FrameDraft = {
    id: `frame_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: patch?.name ?? `Khung ${index}`,
    role: patch?.role,
    duration: patch?.duration ?? DEFAULT_FRAME_DURATION,
    text: patch?.text ?? "Nội dung khung",
  };
  write(projectId, [...frames, draft]);
  return draft;
}

export function getFrame(projectId: string, frameId: string): FrameDraft | null {
  return read(projectId).find((frame) => frame.id === frameId) ?? null;
}

export function removeFrame(projectId: string, frameId: string): void {
  write(
    projectId,
    read(projectId).filter((frame) => frame.id !== frameId),
  );
}
