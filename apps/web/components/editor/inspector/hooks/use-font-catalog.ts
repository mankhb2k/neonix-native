"use client";

import { useEffect, useMemo, useState } from "react";
import { listFonts, type FontOption } from "@/lib/api/fonts";
import type { InspectorModel } from "./use-inspector-model";

const SHIPPED_TEXT_LANGUAGES = [
  { value: "vi", label: "Vietnamese" },
  { value: "en", label: "English" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "zh-CN", label: "Simplified Chinese" },
] as const;

export function useFontCatalog(model: InspectorModel) {
  const [fontCatalog, setFontCatalog] = useState<FontOption[]>([]);

  useEffect(() => {
    const load = () => {
      listFonts().then(setFontCatalog).catch(() => setFontCatalog([]));
    };
    load();
    window.addEventListener("neonix:dev-demo-authenticated", load);
    return () => window.removeEventListener("neonix:dev-demo-authenticated", load);
  }, []);

  const selectedText = model.selected?.type === "text" ? model.selected : undefined;
  const selectedFontOption = useMemo(() => {
    const firstSpan = selectedText?.payload.chunks[0]?.spans[0];
    const resolved = firstSpan?.resolvedFontAssetIds?.[0];
    return fontCatalog.find((font) => font.fontAssetId === resolved)
      ?? fontCatalog.find((font) => font.familyName === firstSpan?.font.families[0]);
  }, [fontCatalog, selectedText]);
  const selectedFontFamilyKey = selectedFontOption
    ? `${selectedFontOption.source}:${selectedFontOption.familyName}`
    : "";
  const selectedFontFaces = useMemo(
    () => fontCatalog.filter((font) => `${font.source}:${font.familyName}` === selectedFontFamilyKey),
    [fontCatalog, selectedFontFamilyKey],
  );
  const activeFontFace = useMemo(() => {
    const span = selectedText?.payload.chunks[0]?.spans[0];
    const resolved = fontCatalog.find((font) => font.fontAssetId === span?.resolvedFontAssetIds?.[0]);
    const weight = span?.font.weight ?? resolved?.weight ?? 400;
    const style = span?.font.style ?? resolved?.style ?? "normal";
    return selectedFontFaces.find((font) => font.weight === weight && font.style === style)
      ?? selectedFontFaces.find((font) => font.style === style)
      ?? selectedFontFaces[0];
  }, [fontCatalog, selectedFontFaces, selectedText]);
  const fontFamilyOptions = useMemo(() => {
    const seen = new Set<string>();
    return fontCatalog
      .filter((font) => {
        const key = `${font.source}:${font.familyName}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((left, right) => (left.source === right.source ? 0 : left.source === "system" ? -1 : 1) || left.familyName.localeCompare(right.familyName))
      .map((font) => ({
        value: `${font.source}:${font.familyName}`,
        label: font.familyName,
        group: font.source === "system" ? "System" : "Custom",
      }));
  }, [fontCatalog]);
  const fontStyleOptions = useMemo(
    () => [...new Map(selectedFontFaces.map((font) => [font.style, font])).values()]
      .sort((left, right) => {
        const order = { normal: 0, italic: 1, oblique: 2 } as const;
        return order[left.style] - order[right.style];
      })
      .map((font) => ({ value: font.style, label: font.style[0].toUpperCase() + font.style.slice(1) })),
    [selectedFontFaces],
  );
  const fontWeightOptions = useMemo(() => {
    const faces = selectedFontFaces.filter((font) => !activeFontFace || font.style === activeFontFace.style);
    return [...new Map((faces.length > 0 ? faces : selectedFontFaces).map((font) => [String(font.weight), font])).values()]
      .sort((left, right) => left.weight - right.weight)
      .map((font) => ({ value: String(font.weight), label: String(font.weight) }));
  }, [activeFontFace, selectedFontFaces]);
  const languageOptions = useMemo(() => {
    const language = selectedText?.payload.source?.language ?? "und";
    if (!selectedText || SHIPPED_TEXT_LANGUAGES.some((option) => option.value === language)) {
      return SHIPPED_TEXT_LANGUAGES;
    }
    return [{ value: language, label: `${language} (custom)` }, ...SHIPPED_TEXT_LANGUAGES];
  }, [selectedText]);

  return {
    fontCatalog,
    selectedFontOption,
    selectedFontFamilyKey,
    selectedFontFaces,
    activeFontFace,
    fontFamilyOptions,
    fontStyleOptions,
    fontWeightOptions,
    languageOptions,
  };
}
