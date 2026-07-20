import { templates } from "./templates";
import type { Template } from "./types";

export type RetrieveQuery = {
  industry?: string;
  tags?: string[];
  aspectRatio?: Template["aspectRatio"];
  limit?: number;
};

/** Tag/filter retrieval — vector RAG can wrap this later */
export function retrieveTemplates(query: RetrieveQuery): Template[] {
  const limit = query.limit ?? 5;
  const tagSet = new Set((query.tags ?? []).map((t) => t.toLowerCase()));

  return templates
    .filter((t) => {
      if (query.industry && t.industry !== query.industry) return false;
      if (query.aspectRatio && t.aspectRatio !== query.aspectRatio) return false;
      if (tagSet.size === 0) return true;
      return t.tags.some((tag) => tagSet.has(tag.toLowerCase()));
    })
    .slice(0, limit);
}
