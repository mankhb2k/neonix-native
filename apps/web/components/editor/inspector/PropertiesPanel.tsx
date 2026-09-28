"use client";

import { AudioClipProperties } from "./audio/AudioClipProperties";
import { useFontCatalog } from "./hooks/use-font-catalog";
import { InspectorModel } from "./hooks/use-inspector-model";
import { GroupProperties } from "./layers/GroupProperties";
import { ImageProperties } from "./layers/ImageProperties";
import { ShapeProperties } from "./layers/ShapeProperties";
import { TextProperties } from "./layers/TextProperties";
import { VideoProperties } from "./layers/VideoProperties";
import { Appearance } from "./properties/Appearance";
import { Compositing } from "./properties/Compositing";
import { Effects } from "./properties/Effects";
import { LayerOrder } from "./properties/LayerOrder";
import { Timing } from "./properties/Timing";
import { Transform } from "./properties/Transform";
import type { InspectorCommands } from "./hooks/use-inspector-commands";

export function PropertiesPanel({ model, commands, openSections, toggle }: { model: InspectorModel; commands: InspectorCommands; openSections: Record<string, boolean>; toggle: (id: string) => void }) {
  const fonts = useFontCatalog(model);
  if (model.selectedAudio && !model.selected) {
    return <AudioClipProperties model={model} commands={commands} open={openSections.media ?? false} onToggle={() => toggle("media")} />;
  }
  if (!model.selected) return null;
  return (
    <div className="flex min-h-full w-full flex-col" data-testid="inspector-properties">
      {model.diagnostics.length > 0 ? <div role="alert" className="order-[-2] border-b border-[var(--danger)]/40 bg-[var(--danger)]/10 py-2 text-[11px] text-[var(--danger)]">{model.diagnostics[0]?.message}</div> : null}
      <Timing model={model} commands={commands} open={openSections.timing ?? false} onToggle={() => toggle("timing")} />
      <Transform model={model} commands={commands} open={openSections.transform ?? false} onToggle={() => toggle("transform")} anchorOpen={openSections.anchor ?? false} onToggleAnchor={() => toggle("anchor")} />
      <LayerOrder model={model} commands={commands} open={openSections.alignment ?? false} onToggle={() => toggle("alignment")} />
      <Appearance model={model} commands={commands} open={openSections.appearance ?? false} onToggle={() => toggle("appearance")} />
      <Compositing model={model} commands={commands} open={openSections.compositing ?? false} onToggle={() => toggle("compositing")} />
      <Effects model={model} commands={commands} open={openSections.effects ?? false} onToggle={() => toggle("effects")} />
      <TextProperties model={model} commands={commands} fonts={fonts} openSections={openSections} toggle={toggle} />
      <ShapeProperties model={model} commands={commands} open={openSections.style ?? false} onToggle={() => toggle("style")} />
      <ImageProperties model={model} commands={commands} open={openSections.media ?? false} onToggle={() => toggle("media")} />
      <VideoProperties model={model} commands={commands} open={openSections.media ?? false} onToggle={() => toggle("media")} />
      <GroupProperties model={model} open={openSections.group ?? false} onToggle={() => toggle("group")} />
    </div>
  );
}
