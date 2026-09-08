"use client";

import { useEffect, useState } from "react";
import { ColorField } from "../controls/ColorField";
import { ActionButton, InspectorSection, inspectorInputClass } from "../controls/InspectorSection";
import { InspectorSelect } from "../controls/InspectorSelect";
import { NumberField, RangeField } from "../controls/NumberField";
import { ToggleField } from "../controls/ToggleField";
import type { useFontCatalog } from "../hooks/use-font-catalog";
import type { InspectorCommands } from "../hooks/use-inspector-commands";
import type { InspectorModel } from "../hooks/use-inspector-model";
import type { V2TextLayout, V2TextSource, V2TextSpan } from "@motionvideo/motion-protocol/v2";

const TEXT_SIZING_OPTIONS = [
  { value: "auto-width-height", label: "Auto width / height" },
  { value: "fixed-width-auto-height", label: "Fixed width / auto height" },
  { value: "fixed", label: "Fixed" },
] as const;
const TEXT_DIRECTION_OPTIONS = [{ value: "ltr", label: "Left to right" }, { value: "rtl", label: "Right to left" }] as const;
const TEXT_WRITING_MODE_OPTIONS = [{ value: "horizontal-tb", label: "Horizontal" }, { value: "vertical-rl", label: "Vertical right to left" }, { value: "vertical-lr", label: "Vertical left to right" }] as const;
const TEXT_ALIGN_OPTIONS = ["left", "center", "right", "start", "end", "justify", "justify-all"].map((value) => ({ value, label: value.replace("-", " ").replace(/^./, (letter) => letter.toUpperCase()) }));
const TEXT_WRAP_OPTIONS = [{ value: "none", label: "None" }, { value: "word", label: "Word" }, { value: "character", label: "Character" }] as const;
const TEXT_WHITE_SPACE_OPTIONS = ["normal", "nowrap", "pre", "pre-wrap", "pre-line", "break-spaces"].map((value) => ({ value, label: value.replaceAll("-", " ") }));
const TEXT_OVERFLOW_OPTIONS = [{ value: "clip", label: "Clip" }, { value: "ellipsis", label: "Ellipsis" }] as const;
const TEXT_RENDERING_OPTIONS = [{ value: "auto", label: "Auto" }, { value: "optimizeSpeed", label: "Optimize speed" }, { value: "geometricPrecision", label: "Geometric precision" }] as const;
const TEXT_BASELINE_OPTIONS = ["auto", "use-script", "no-change", "reset-size", "ideographic", "alphabetic", "hanging", "mathematical", "central", "middle", "text-after-edge", "text-before-edge"].map((value) => ({ value, label: value.replaceAll("-", " ") }));
const TEXT_ALIGNMENT_BASELINE_OPTIONS = ["auto", "baseline", "before-edge", "text-before-edge", "middle", "central", "after-edge", "text-after-edge", "ideographic", "alphabetic", "hanging", "mathematical"].map((value) => ({ value, label: value.replaceAll("-", " ") }));
const TEXT_LENGTH_ADJUST_OPTIONS = [{ value: "spacing", label: "Spacing" }, { value: "spacingAndGlyphs", label: "Spacing and glyphs" }] as const;
const TEXT_PATH_METHOD_OPTIONS = [{ value: "align", label: "Align" }, { value: "stretch", label: "Stretch" }] as const;
const TEXT_PATH_SPACING_OPTIONS = [{ value: "auto", label: "Auto" }, { value: "exact", label: "Exact" }] as const;

function numericSvgLength(value: unknown, fallback: number): number {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "value" in value && typeof value.value === "number") return value.value;
  return fallback;
}

function variableAxesLabel(variations: Record<string, number> | undefined): string {
  if (!variations || Object.keys(variations).length === 0) return "None";
  return Object.entries(variations).map(([axis, value]) => `${axis}=${value}`).join(", ");
}

function parseVariableAxes(value: string): Record<string, number> | undefined {
  const axes: Record<string, number> = {};
  for (const item of value.split(",")) {
    const [rawTag, rawValue] = item.split("=").map((part) => part?.trim());
    if (!rawTag && !rawValue) continue;
    if (!rawTag || rawTag.length !== 4 || rawValue === undefined || !Number.isFinite(Number(rawValue))) return undefined;
    axes[rawTag] = Number(rawValue);
  }
  return Object.keys(axes).length > 0 ? axes : undefined;
}

function TextInputField({ label, value, placeholder, onCommit }: { label: string; value: string; placeholder?: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="shrink-0 text-[11px] text-[var(--fg-muted)]">{label}</span>
      <input className={`${inspectorInputClass} max-w-[11rem]`} value={draft} placeholder={placeholder} onChange={(event) => setDraft(event.target.value)} onBlur={() => onCommit(draft)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { setDraft(value); event.currentTarget.blur(); } }} aria-label={label} />
    </label>
  );
}

function TextAreaField({ label, value, onCommit }: { label: string; value: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-[var(--fg-muted)]">{label}</span>
      <textarea
        className={`${inspectorInputClass} min-h-16 resize-y py-1.5`}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onCommit(draft.normalize("NFC"))}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setDraft(value);
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

export function TextProperties({ model, commands, fonts, openSections, toggle }: { model: InspectorModel; commands: InspectorCommands; fonts: ReturnType<typeof useFontCatalog>; openSections: Record<string, boolean>; toggle: (id: string) => void }) {
  const selected = model.selected?.type === "text" ? model.selected : undefined;
  if (!selected) return null;
  const span = selected.payload.chunks[0]?.spans[0];
  const layout = selected.payload.layout;
  const textPath = selected.payload.chunks[0]?.textPath;
  const fontSize = numericSvgLength(span?.font.size, 16);
  const textPathOptions = [
    { value: "none", label: "None" },
    ...model.document.layers
      .filter((layer): layer is Extract<typeof layer, { type: "path" }> => layer.type === "path")
      .map((layer) => ({ value: layer.id, label: layer.id })),
  ];

  const selectFontFamily = (value: string) => {
    const faces = fonts.fontCatalog.filter((font) => `${font.source}:${font.familyName}` === value);
    const face = faces.find((font) => font.style === fonts.activeFontFace?.style && font.weight === fonts.activeFontFace?.weight) ?? faces.find((font) => font.style === "normal" && font.weight === 400) ?? faces[0];
    commands.applyFontFace(face);
  };
  const selectFontStyle = (value: string) => commands.applyFontFace(fonts.selectedFontFaces.find((font) => font.style === value && font.weight === fonts.activeFontFace?.weight) ?? fonts.selectedFontFaces.find((font) => font.style === value));
  const selectFontWeight = (value: string) => {
    const weight = Number(value);
    commands.applyFontFace(fonts.selectedFontFaces.find((font) => font.weight === weight && font.style === fonts.activeFontFace?.style) ?? fonts.selectedFontFaces.find((font) => font.weight === weight));
  };

  return (
    <div className="order-6">
      <InspectorSection label="Content" open={openSections.text ?? false} onToggle={() => toggle("text")}>
        <TextAreaField label="Text" value={selected.payload.source.text} onCommit={(value) => commands.patchTextSource({ text: value })} />
        <InspectorSelect label="Language" value={selected.payload.source.language ?? "und"} options={fonts.languageOptions} onChange={(value) => commands.patchTextSource({ language: value })} />
        <InspectorSelect label="Direction" value={selected.payload.source.direction ?? "ltr"} options={TEXT_DIRECTION_OPTIONS} onChange={(value) => commands.patchTextSource({ direction: value as V2TextSource["direction"] })} />
        <InspectorSelect label="Writing mode" value={selected.payload.source.writingMode ?? "horizontal-tb"} options={TEXT_WRITING_MODE_OPTIONS} onChange={(value) => commands.patchTextSource({ writingMode: value as V2TextSource["writingMode"] })} />
      </InspectorSection>
      <InspectorSection label="Layout" open={openSections.textLayout ?? false} onToggle={() => toggle("textLayout")}>
        <InspectorSelect label="Sizing" value={layout?.sizing ?? "auto-width-height"} options={TEXT_SIZING_OPTIONS} onChange={(value) => commands.patchTextLayout({ sizing: value as V2TextLayout["sizing"] })} />
        <NumberField label="Line height" step={0.1} suffix="px" value={layout?.lineHeight ?? fontSize * 1.2} onChange={(value) => commands.patchTextLayout({ lineHeight: Math.max(0.001, value) })} />
        <InspectorSelect label="Alignment" value={layout?.textAlign ?? "left"} options={TEXT_ALIGN_OPTIONS} onChange={(value) => commands.patchTextLayout({ textAlign: value as V2TextLayout["textAlign"] })} />
        <InspectorSelect label="Wrap" value={layout?.wrap ?? "word"} options={TEXT_WRAP_OPTIONS} onChange={(value) => commands.patchTextLayout({ wrap: value as V2TextLayout["wrap"] })} />
        <InspectorSelect label="White space" value={layout?.whiteSpace ?? "normal"} options={TEXT_WHITE_SPACE_OPTIONS} onChange={(value) => commands.patchTextLayout({ whiteSpace: value as V2TextLayout["whiteSpace"] })} />
        <InspectorSelect label="Overflow" value={layout?.textOverflow ?? "clip"} options={TEXT_OVERFLOW_OPTIONS} onChange={(value) => commands.patchTextLayout({ textOverflow: value as V2TextLayout["textOverflow"] })} />
        <NumberField label="Max lines" step={1} integer value={layout?.maxLines ?? 0} onChange={(value) => commands.patchTextLayout({ maxLines: value > 0 ? Math.round(value) : undefined })} />
      </InspectorSection>
      <InspectorSection label="Typography" open={openSections.typography ?? false} onToggle={() => toggle("typography")}>
        <InspectorSelect label="Font family" value={fonts.selectedFontFamilyKey} options={fonts.fontFamilyOptions} className="max-w-[10rem]" onChange={selectFontFamily} />
        <InspectorSelect label="Style" value={fonts.activeFontFace?.style ?? span?.font.style ?? "normal"} options={fonts.fontStyleOptions} onChange={selectFontStyle} />
        <InspectorSelect label="Weight" value={String(fonts.activeFontFace?.weight ?? span?.font.weight ?? 400)} options={fonts.fontWeightOptions} onChange={selectFontWeight} />
        <NumberField label="Font size" step={1} integer suffix="px" value={fontSize} onChange={(value) => commands.patchTextSpans((item) => ({ ...item, font: { ...item.font, size: Math.max(0.001, value) } }))} />
        <NumberField label="Letter spacing" step={0.1} suffix="px" value={numericSvgLength(span?.letterSpacing, 0)} onChange={(value) => commands.patchTextSpans((item) => ({ ...item, letterSpacing: value === 0 ? "normal" : value }))} />
        <NumberField label="Word spacing" step={0.1} suffix="px" value={numericSvgLength(span?.wordSpacing, 0)} onChange={(value) => commands.patchTextSpans((item) => ({ ...item, wordSpacing: value === 0 ? "normal" : value }))} />
      </InspectorSection>
      <InspectorSection label="Appearance" open={openSections.appearance ?? false} onToggle={() => toggle("appearance")}>
        <ColorField label="Fill" value={typeof span?.fill === "string" ? span.fill : "#ffffff"} onChange={(value) => commands.patchTextSpans((item) => ({ ...item, fill: value }))} />
        <RangeField label="Fill opacity" value={span?.fillOpacity ?? 1} onChange={(value) => commands.patchTextSpans((item) => ({ ...item, fillOpacity: value }))} />
        {typeof span?.stroke === "string" ? <><ColorField label="Stroke" value={span.stroke} onChange={(value) => commands.patchTextSpans((item) => ({ ...item, stroke: value }))} /><NumberField label="Stroke width" step={0.5} suffix="px" value={numericSvgLength(span.strokeWidth, 1)} onChange={(value) => commands.patchTextSpans((item) => ({ ...item, strokeWidth: Math.max(0.001, value) }))} /><RangeField label="Stroke opacity" value={span.strokeOpacity ?? 1} onChange={(value) => commands.patchTextSpans((item) => ({ ...item, strokeOpacity: value }))} /><ActionButton label="Remove stroke" onClick={() => commands.patchTextSpans((item) => ({ ...item, stroke: undefined, strokeWidth: undefined, strokeOpacity: undefined }))} /></> : <ActionButton label="Add stroke" onClick={() => commands.patchTextSpans((item) => ({ ...item, stroke: "#ffffff", strokeWidth: 1, strokeOpacity: 1 }))} />}
      </InspectorSection>
      <InspectorSection label="Decoration" open={openSections.decoration ?? false} onToggle={() => toggle("decoration")}>
        <ToggleDecoration label="Underline" keyName="underline" span={span} onChange={commands.patchTextDecoration} />
        <ToggleDecoration label="Overline" keyName="overline" span={span} onChange={commands.patchTextDecoration} />
        <ToggleDecoration label="Line-through" keyName="lineThrough" span={span} onChange={commands.patchTextDecoration} />
      </InspectorSection>
      <InspectorSection label="Advanced" open={openSections.advanced ?? false} onToggle={() => toggle("advanced")}>
        <InspectorSelect label="Dominant baseline" value={span?.dominantBaseline ?? "auto"} options={TEXT_BASELINE_OPTIONS} onChange={(value) => commands.patchTextSpans((item) => ({ ...item, dominantBaseline: value as V2TextSpan["dominantBaseline"] }))} />
        <InspectorSelect label="Alignment baseline" value={span?.alignmentBaseline ?? "auto"} options={TEXT_ALIGNMENT_BASELINE_OPTIONS} onChange={(value) => commands.patchTextSpans((item) => ({ ...item, alignmentBaseline: value as V2TextSpan["alignmentBaseline"] }))} />
        <NumberField label="Baseline shift" step={0.5} suffix="px" value={numericSvgLength(span?.baselineShift, 0)} onChange={(value) => commands.patchTextSpans((item) => ({ ...item, baselineShift: value === 0 ? "baseline" : value }))} />
        <TextInputField label="Variable axes" value={variableAxesLabel(span?.font.variations)} placeholder="wght=400, wdth=100" onCommit={(value) => { const variations = parseVariableAxes(value); if (value.trim() === "" || variations) commands.patchTextSpans((item) => ({ ...item, font: { ...item.font, variations } })); }} />
        <ToggleField label="Text length" checked={Boolean(span?.textLength)} onChange={(checked) => commands.patchTextSpans((item) => ({ ...item, textLength: checked ? Math.max(1, numericSvgLength(item.textLength, selected.frame.width)) : undefined, lengthAdjust: checked ? (item.lengthAdjust ?? "spacing") : undefined }))} />
        {span?.textLength !== undefined ? <>
          <NumberField label="Length" step={1} suffix="px" value={numericSvgLength(span.textLength, selected.frame.width)} onChange={(value) => commands.patchTextSpans((item) => ({ ...item, textLength: Math.max(0.001, value) }))} />
          <InspectorSelect label="Length adjust" value={span.lengthAdjust ?? "spacing"} options={TEXT_LENGTH_ADJUST_OPTIONS} onChange={(value) => commands.patchTextSpans((item) => ({ ...item, lengthAdjust: value as V2TextSpan["lengthAdjust"] }))} />
        </> : null}
        <InspectorSelect label="Text path" value={textPath?.pathId ?? "none"} options={textPathOptions} onChange={commands.patchTextPath} />
        {textPath ? <><NumberField label="Start offset" step={1} suffix="px" value={numericSvgLength(textPath.startOffset, 0)} onChange={(value) => commands.patchLayer({ payload: { chunks: selected.payload.chunks.map((chunk) => ({ ...chunk, textPath: chunk.textPath ? { ...chunk.textPath, startOffset: value } : undefined })) } })} /><InspectorSelect label="Path method" value={textPath.method ?? "align"} options={TEXT_PATH_METHOD_OPTIONS} onChange={(value) => commands.patchLayer({ payload: { chunks: selected.payload.chunks.map((chunk) => ({ ...chunk, textPath: chunk.textPath ? { ...chunk.textPath, method: value as "align" | "stretch" } : undefined })) } })} /><InspectorSelect label="Path spacing" value={textPath.spacing ?? "auto"} options={TEXT_PATH_SPACING_OPTIONS} onChange={(value) => commands.patchLayer({ payload: { chunks: selected.payload.chunks.map((chunk) => ({ ...chunk, textPath: chunk.textPath ? { ...chunk.textPath, spacing: value as "auto" | "exact" } : undefined })) } })} /></> : null}
        <InspectorSelect label="Text rendering" value={selected.payload.source.textRendering ?? "auto"} options={TEXT_RENDERING_OPTIONS} onChange={(value) => commands.patchTextSource({ textRendering: value as V2TextSource["textRendering"] })} />
      </InspectorSection>
    </div>
  );
}

function ToggleDecoration({ label, keyName, span, onChange }: { label: string; keyName: "underline" | "overline" | "lineThrough"; span: V2TextSpan | undefined; onChange: (key: "underline" | "overline" | "lineThrough", enabled: boolean) => void }) {
  return <label className="flex h-7 items-center justify-between gap-2 text-[11px] text-[var(--fg-muted)]"><span>{label}</span><input type="checkbox" checked={Boolean(span?.textDecoration?.[keyName])} onChange={(event) => onChange(keyName, event.target.checked)} className="h-4 w-4 accent-[var(--accent)]" /></label>;
}
