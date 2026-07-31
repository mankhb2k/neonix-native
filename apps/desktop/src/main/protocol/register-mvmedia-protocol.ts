import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { net, protocol } from "electron";
import { resolveContainedPath } from "../../shared/assets/resolve-asset-path";
import {
  MVMEDIA_PROTOCOL,
  getProjectDirForToken,
  mimeForExt,
  parseMvmediaUrl,
} from "./mvmedia-registry";

export function registerMvmediaProtocolHandler(): void {
  protocol.handle(MVMEDIA_PROTOCOL, async (request) => {
    const parsed = parseMvmediaUrl(request.url);
    if (!parsed) {
      return new Response("Bad Request", { status: 400 });
    }
    const projectDir = getProjectDirForToken(parsed.token);
    if (!projectDir) {
      return new Response("Not Found", { status: 404 });
    }

    let filePath: string;
    try {
      filePath = resolveContainedPath(projectDir, parsed.relativeUri);
    } catch {
      return new Response("Forbidden", { status: 403 });
    }

    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
    } catch {
      return new Response("Not Found", { status: 404 });
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = mimeForExt(ext);
    const response = await net.fetch(pathToFileURL(filePath).toString());
    const headers = new Headers(response.headers);
    headers.set("Content-Type", mime);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  });
}
