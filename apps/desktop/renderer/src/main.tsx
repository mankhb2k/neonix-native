import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DesktopApp } from "./app/DesktopApp";
import { createDesktopApiClient } from "./infrastructure/desktop-api-client";
import { createFixtureDesktopApi } from "./infrastructure/fixture-desktop-api";
import "./ui/theme/tokens.css";
import "./ui/theme/utilities.css";
import "./styles/base.css";
import "./app/diagnostics/diagnostics.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Missing #root element");
}

const nodeLeak =
  typeof (globalThis as { require?: unknown }).require === "function" ||
  typeof (globalThis as { process?: { versions?: { node?: string } } }).process
    ?.versions?.node === "string";
if (nodeLeak) {
  // eslint-disable-next-line no-console -- boot-time sandbox leak probe
  console.warn("[renderer] unexpected Node globals present");
}

const fixtureMode =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("fixture");
const api = fixtureMode
  ? createFixtureDesktopApi()
  : createDesktopApiClient(window.motionvideoDesktop);

createRoot(rootElement).render(
  <StrictMode>
    <DesktopApp api={api} />
  </StrictMode>,
);
