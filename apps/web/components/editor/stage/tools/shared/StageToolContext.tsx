"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type StageToolId = "select" | "pan" | "text" | "shape";

type StageToolContextValue = {
  activeTool: StageToolId;
  setActiveTool: (tool: StageToolId) => void;
};

const StageToolContext = createContext<StageToolContextValue | null>(null);

export function StageToolProvider({ children }: { children: ReactNode }) {
  const [activeTool, setActiveTool] = useState<StageToolId>("select");
  const value = useMemo(() => ({ activeTool, setActiveTool }), [activeTool]);
  return <StageToolContext.Provider value={value}>{children}</StageToolContext.Provider>;
}

export function useStageToolContext(): StageToolContextValue {
  const value = useContext(StageToolContext);
  if (!value) throw new Error("useStageToolContext must be used within StageToolProvider");
  return value;
}
