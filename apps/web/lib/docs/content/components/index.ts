import type { DocsPageView } from "@/lib/docs/content/page-view";
import { bindingsPage } from "./bindings";
import { nestedPage } from "./nested";
import { propsPage } from "./props";
import { variantsPage } from "./variants";
import { whatIsAComponentPage } from "./what-is-a-component";

export type ComponentsSlug =
  | "components"
  | "components/props"
  | "components/variants"
  | "components/bindings"
  | "components/nested";

const SLUGS = new Set<string>([
  "components",
  "components/props",
  "components/variants",
  "components/bindings",
  "components/nested",
]);

export function isComponentsSlug(slug: string): slug is ComponentsSlug {
  return SLUGS.has(slug);
}

export function getComponentsPage(slug: ComponentsSlug): DocsPageView {
  switch (slug) {
    case "components":
      return whatIsAComponentPage();
    case "components/props":
      return propsPage();
    case "components/variants":
      return variantsPage();
    case "components/bindings":
      return bindingsPage();
    case "components/nested":
      return nestedPage();
  }
}
