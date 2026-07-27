"use client";

import { useState } from "react";
import { TransportBar } from "./TransportBar/TransportBar";
import { Tracks } from "./Tracks/Tracks";
import { TIMELINE_ZOOM_DEFAULT } from "./timeline-scale";

export function Timeline() {
  const [zoom, setZoom] = useState(TIMELINE_ZOOM_DEFAULT);

  return (
    <div className="col-span-full flex flex-col h-full min-h-0 overflow-hidden [grid-area:timeline]">
      <TransportBar zoom={zoom} onZoomChange={setZoom} />
      <Tracks zoom={zoom} />
    </div>
  );
}
