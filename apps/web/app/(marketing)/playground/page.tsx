import { HtmlFramePlayground } from "./_components/HtmlFramePlayground";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HTML Frame-by-Frame Preview",
  description:
    "Preview HTML and CSS animation frame by frame in your browser: paste or upload HTML, then scrub the timeline or step through individual frames.",
  alternates: { canonical: "/playground" },
};

export default function PlaygroundPage() {
  return <HtmlFramePlayground />;
}
