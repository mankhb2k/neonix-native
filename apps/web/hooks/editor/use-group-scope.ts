"use client";

import { useMemo } from "react";

import { useEditorStore } from "@/lib/editor/editor-store";
import {
  selectGroupScope,
  type GroupScope,
} from "@/lib/editor/store/selectors/group-scope";

export type { GroupScope };

export function useGroupScope(): GroupScope {
  const layers = useEditorStore((s) => s.project?.layers);
  const groupPath = useEditorStore((s) => s.groupPath);

  return useMemo(
    () => selectGroupScope(layers, groupPath),
    [layers, groupPath],
  );
}
