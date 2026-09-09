import { jsonApi } from "@/lib/server/api/v1";
import { HTML_TAG_PROFILE, SUPPORTED_PROPERTIES } from "@motionvideo/html-compiler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return jsonApi(request, {
    apiVersion: 1,
    document: {
      kind: "neonix-html-document",
      schemaVersion: 2,
      metadata: "meta[name=neonix-document]",
    },
    htmlTags: Object.fromEntries(
      Object.entries(HTML_TAG_PROFILE).map(([group, tags]) => [group, [...tags].sort()]),
    ),
    cssProperties: [...SUPPORTED_PROPERTIES].sort(),
    protocolVersion: 2,
  });
}
