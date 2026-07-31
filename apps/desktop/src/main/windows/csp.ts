import { session } from "electron";
import {
  APP_PROTOCOL,
  DEFAULT_VITE_DEV_URL,
  getRendererMode,
  PROD_RENDERER_CSP,
  useViteProductionBundle,
} from "../../shared/renderer-mode";

function viteOrigin(): string {
  try {
    return new URL(process.env.MOTIONVIDEO_VITE_URL ?? DEFAULT_VITE_DEV_URL)
      .origin;
  } catch {
    return "http://127.0.0.1:5173";
  }
}

/** Apply CSP via session headers for Vite renderer loads. */
export function applyRendererCsp(isPackaged: boolean): void {
  if (getRendererMode() !== "vite") return;

  const isProdBundle = isPackaged || useViteProductionBundle();
  const origin = viteOrigin();
  let viteHost = "127.0.0.1:5173";
  try {
    viteHost = new URL(origin).host;
  } catch {
    /* keep default */
  }

  const csp = isProdBundle
    ? PROD_RENDERER_CSP
    : [
        // Vite client needs unsafe-eval in unpackaged/dev; never in prod bundle.
        `default-src 'self' ${origin}`,
        `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${origin}`,
        `style-src 'self' 'unsafe-inline' ${origin}`,
        `img-src 'self' data: blob: ${origin} mvmedia:`,
        `media-src 'self' blob: mvmedia:`,
        `font-src 'self' data: ${origin}`,
        `connect-src 'self' ${origin} ws://${viteHost} wss://${viteHost}`,
        `worker-src 'self' blob: ${origin}`,
        `object-src 'none'`,
        `base-uri 'self'`,
      ].join("; ");

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const url = details.url;
    const applies =
      url.startsWith(`${APP_PROTOCOL}://`) || url.startsWith(origin);
    if (!applies) {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }
    const headers = { ...details.responseHeaders };
    headers["Content-Security-Policy"] = [csp];
    callback({ responseHeaders: headers });
  });
}
