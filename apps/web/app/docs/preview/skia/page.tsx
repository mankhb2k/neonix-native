import type { Metadata } from "next";
import { SkiaRuntimeLab } from "@/components/docs/SkiaRuntimeLab";

export const metadata: Metadata = {
  title: "Skia preview lab",
  description: "Browser SVG and Skia/CanvasKit preview comparison, including projective 3D surfaces.",
  robots: { index: false, follow: false },
};

export default function SkiaPreviewPage() {
  return <SkiaRuntimeLab />;
}
