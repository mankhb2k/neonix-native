import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { DesktopApp } from "./app/DesktopApp";
import { createDesktopApiClient } from "./infrastructure/desktop-api-client";
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
  console.warn("[renderer] unexpected Node globals present");
}

const api = createDesktopApiClient(window.motionvideoDesktop);

createRoot(rootElement).render(
  <StrictMode>
    <DesktopApp api={api} />
  </StrictMode>,
);
