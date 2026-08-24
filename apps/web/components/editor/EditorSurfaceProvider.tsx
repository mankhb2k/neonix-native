"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import {
  applyV2EditorCommand,
  type V2EditorCommand,
  type V2EditorDiagnostic,
} from "@motionvideo/editor-core/v2";

export type EditorSurface = {
  document: MotionProtocolV2;
  selectedLayerIds: string[];
  setSelectedLayerIds: Dispatch<SetStateAction<string[]>>;
  currentTime: number;
  isPlaying: boolean;
  setCurrentTime: Dispatch<SetStateAction<number>>;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  applyCommand: (command: V2EditorCommand) => boolean;
  diagnostics: readonly V2EditorDiagnostic[];
};

const EditorSurfaceContext = createContext<EditorSurface | null>(null);

/** Session state for the existing editor chrome; document ownership is V2 only. */
export function EditorSurfaceProvider({
  initialDocument,
  children,
}: {
  initialDocument: MotionProtocolV2;
  children: ReactNode;
}) {
  const [document, setDocument] = useState(initialDocument);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
  const [diagnostics, setDiagnostics] = useState<readonly V2EditorDiagnostic[]>(
    [],
  );

  const value = useMemo<EditorSurface>(
    () => ({
      document,
      selectedLayerIds,
      setSelectedLayerIds,
      currentTime,
      isPlaying,
      setCurrentTime,
      setIsPlaying,
      diagnostics,
      applyCommand: (command) => {
        const result = applyV2EditorCommand(document, command);
        setDiagnostics(result.diagnostics);
        if (!result.ok) return false;
        setDocument(result.document);
        return true;
      },
    }),
    [currentTime, diagnostics, document, isPlaying, selectedLayerIds],
  );

  return (
    <EditorSurfaceContext.Provider value={value}>
      {children}
    </EditorSurfaceContext.Provider>
  );
}

export function useEditorSurface(): EditorSurface {
  const value = useContext(EditorSurfaceContext);
  if (!value) {
    throw new Error("useEditorSurface must be used inside EditorSurfaceProvider");
  }
  return value;
}
