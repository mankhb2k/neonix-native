import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function solidLayerPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Solid",
    toc: [
      { id: "what", title: "Color plate" },
      { id: "payload", title: "Payload" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Solid"
          human="A filled rectangle of one color. Background, card, or block."
          jsonPath='layers[] type: "solid"'
        />
        <H2 id="what">Color plate</H2>
        <P>
          Size is <code>frame</code>. Color is <code>payload.color</code> (
          <code>#rrggbb</code>, default <code>#000000</code>). This is not a
          shape rectangle: no <code>style.fill</code>, no corner radius. Need
          rounded corners or stroke →{" "}
          <a className="underline" href="/docs/layers/shape">
            shape
          </a>
          .
        </P>
        <H2 id="payload">Payload</H2>
        <JsonBlock
          code={JSON.stringify(
            {
              id: "bg-plate",
              type: "solid",
              frame: { width: 1920, height: 1080 },
              payload: { color: "#e8eef5" },
            },
            null,
            2,
          )}
        />
        <AiWritingGuide
          items={[
            "Use solid for a full-bleed plate or card fill.",
            "Put color on payload.color, not style.fill.",
            "Rounded plate = type shape rectangle + cornerRadius + style.fill.",
          ]}
        />
      </article>
    ),
  });
}
