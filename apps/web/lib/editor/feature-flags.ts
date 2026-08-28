/**
 * Rollout switch for the linked video-audio authoring contract. Keep the
 * default enabled for new V2 projects; setting the public flag to `0` gives
 * operators a safe way to hide linked-audio controls while legacy projects
 * are migrated and verified.
 */
export const LINKED_VIDEO_AUDIO_V2_ENABLED =
  process.env.NEXT_PUBLIC_LINKED_VIDEO_AUDIO_V2 !== "0";
