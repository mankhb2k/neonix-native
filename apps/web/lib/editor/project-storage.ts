/**
 * Compatibility re-export — nguồn sự thật nằm ở persistence/.
 * Giữ path cũ để consumer không phải đổi import hàng loạt trong một commit.
 */
export {
  CURRENT_STORAGE_VERSION,
  deleteProject,
  listProjects,
  loadEditorProjectSnapshot,
  loadOverlayScenes,
  loadProject,
  loadTimelineClips,
  loadTimelineLanes,
  loadTimelineState,
  migrateStoredProject,
  overlaysFromClips,
  saveProject,
  trySaveProject,
  SaveProjectError,
  isQuotaExceededError,
  type EditorProjectSnapshot,
  type StoredProject,
} from "@/lib/editor/persistence/project-storage";
