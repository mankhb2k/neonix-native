"use client";

import { useEffect, useState } from "react";

/** True when running inside the Electron shell (`window.motionvideoDesktop`). */
export function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    setDesktop(Boolean(window.motionvideoDesktop?.isDesktop));
  }, []);

  return desktop;
}
