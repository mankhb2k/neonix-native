import { exampleFixturePage } from "./example-fixture";
import { DEPTH_DEMO, SINGLE_ROOT } from "@/lib/docs/projects";

export function textIntroPage() {
  return exampleFixturePage("Text intro", SINGLE_ROOT);
}

export function imageParallaxPage() {
  return exampleFixturePage("Image parallax", DEPTH_DEMO);
}
