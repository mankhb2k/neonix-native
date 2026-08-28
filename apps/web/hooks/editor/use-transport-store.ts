"use client";

import { createContext, useContext } from "react";
import { useStore } from "zustand";
import type { TransportStoreApi, TransportUIState } from "@/lib/editor/playback/transport-store";

export const TransportStoreContext = createContext<TransportStoreApi | null>(null);

export function useTransportStore<T>(selector: (state: TransportUIState) => T): T {
  const store = useContext(TransportStoreContext);
  if (!store) throw new Error("useTransportStore must be used inside EditorProviders");
  return useStore(store, selector);
}
