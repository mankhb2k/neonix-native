import Image from "next/image";

export default function PreviewCanvasReferencePage() {
  return (
    <main style={{ minHeight: "100vh", background: "#080c11", color: "#d7e2ec", padding: 32 }}>
      <h1 style={{ fontFamily: "sans-serif", fontSize: 20, marginBottom: 16 }}>
        SVG Path Stroke Reference
      </h1>
      <p style={{ fontFamily: "sans-serif", marginBottom: 20 }}>
        Browser-native SVG reference for comparing joins, dashes and rectangle strokes with the runtime canvas.
      </p>
      <Image
        src="/preview/svg/path-stroke-semantics.svg"
        alt="SVG reference showing miter join, dashed closed path, and rectangle stroke"
        width={1920}
        height={1080}
        unoptimized
        style={{ display: "block", width: "100%", maxWidth: 1200, height: "auto", border: "1px solid #263340" }}
      />
    </main>
  );
}
