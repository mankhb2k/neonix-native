import { SkiaRuntimeLab } from "@/components/docs/SkiaRuntimeLab";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Native preview lab",
  description: "Browser SVG and native preview comparison, including projective 3D surfaces.",
  robots: { index: false, follow: false },
};

export default function NativePreviewPage() {
  return <SkiaRuntimeLab />;
}
