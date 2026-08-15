import {
  getAnimationPage,
  isAnimationSlug,
} from "@/lib/docs/content/animation";
import {
  getAppearancePage,
  isAppearanceSlug,
} from "@/lib/docs/content/appearance";
import {
  getComponentsPage,
  isComponentsSlug,
} from "@/lib/docs/content/components";
import {
  getEffectsPage,
  isEffectsSlug,
} from "@/lib/docs/content/effects";
import {
  getExamplesPage,
  isExamplesSlug,
} from "@/lib/docs/content/examples";
import {
  getGettingStartedPage,
  isGettingStartedSlug,
} from "@/lib/docs/content/getting-started";
import { getLayersPage, isLayersSlug } from "@/lib/docs/content/layers";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { getProjectPage, isProjectSlug } from "@/lib/docs/content/project";
import { stubPage } from "@/lib/docs/content/stub";
import {
  getTransformPage,
  isTransformSlug,
} from "@/lib/docs/content/transform";
import { navLabelForSlug } from "@/lib/docs/nav";

export type { DocsPageView };

export function getDocsPage(slug: string): DocsPageView {
  if (isGettingStartedSlug(slug)) return getGettingStartedPage(slug);
  if (isProjectSlug(slug)) return getProjectPage(slug);
  if (isLayersSlug(slug)) return getLayersPage(slug);
  if (isTransformSlug(slug)) return getTransformPage(slug);
  if (isAppearanceSlug(slug)) return getAppearancePage(slug);
  if (isEffectsSlug(slug)) return getEffectsPage(slug);
  if (isAnimationSlug(slug)) return getAnimationPage(slug);
  if (isComponentsSlug(slug)) return getComponentsPage(slug);
  if (isExamplesSlug(slug)) return getExamplesPage(slug);
  return stubPage(navLabelForSlug(slug) ?? slug);
}
