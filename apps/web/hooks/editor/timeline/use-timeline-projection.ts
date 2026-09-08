"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listAssets, type Asset } from "@/lib/api/assets";
import {
  projectLayersToTimeline,
  resolveFitAnchorSeconds,
  type TimelineAssetPreview,
} from "@motionvideo/editor-core/timeline";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

type UseTimelineProjectionArgs = {
  document: MotionProtocolV2;
};

export function previewKeysForAsset(assetId: string): string[] {
  return assetId.startsWith("asset-")
    ? [assetId]
    : [assetId, `asset-${assetId}`];
}

function buildAssetPreviews(assets: Asset[]): Map<string, TimelineAssetPreview> {
  const entries = assets.flatMap((asset) => {
    const isImage = asset.mime_type.startsWith("image/");
    const preview: TimelineAssetPreview = {
      // Raster images can use their signed source directly. Videos use a
      // generated poster derivative when one is available.
      url: asset.preview_url ?? (isImage ? asset.download_url : null),
      status:
        asset.preview_url || (isImage && asset.download_url)
          ? "ready"
          : asset.preview_status,
    };

    // MCP/seed documents may use the stable asset-{uuid} identifier while
    // persistence still uses the raw database UUID.
    return previewKeysForAsset(asset.id).map((key) => [key, preview] as const);
  });

  return new Map(entries);
}

/** Owns the document -> timeline projection and its ephemeral asset metadata. */
export function useTimelineProjection({
  document,
}: UseTimelineProjectionArgs) {
  const [assetPreviews, setAssetPreviews] = useState<
    ReadonlyMap<string, TimelineAssetPreview>
  >(() => new Map());

  useEffect(() => {
    let cancelled = false;

    void listAssets()
      .then((assets: Asset[]) => {
        if (!cancelled) setAssetPreviews(buildAssetPreviews(assets));
      })
      .catch(() => {
        // Demo documents and unauthenticated preview sessions have no asset
        // API. The projection still provides URI fallbacks.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const projection = useMemo(
    () => projectLayersToTimeline(document, { assetPreviews }),
    [assetPreviews, document],
  );

  // Fit is a session decision, not a side effect of projecting each layer.
  const [fitAnchorSeconds, setFitAnchorSeconds] = useState<number | null>(
    () => resolveFitAnchorSeconds(projection.clips),
  );
  const [fitRevision, setFitRevision] = useState(0);
  const documentIdRef = useRef(document.id);

  // A project switch in the same editor session must establish a new fit
  // anchor. Otherwise the next document inherits the previous project's
  // timeline scale and horizontal scroll reset key.
  useEffect(() => {
    if (documentIdRef.current === document.id) return;
    documentIdRef.current = document.id;
    setFitAnchorSeconds(resolveFitAnchorSeconds(projection.clips));
    setFitRevision((revision) => revision + 1);
  }, [document.id, projection.clips]);

  const fitTimeline = useCallback(() => {
    setFitAnchorSeconds(resolveFitAnchorSeconds(projection.clips));
    setFitRevision((revision) => revision + 1);
  }, [projection.clips]);

  return {
    projection,
    fitAnchorSeconds,
    fitRevision,
    fitTimeline,
  };
}
