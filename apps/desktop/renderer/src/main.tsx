import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DesktopApp } from "./app/DesktopApp";
import { createDesktopApiClient } from "./infrastructure/desktop-api-client";
import "./ui/theme/tokens.css";
import "./ui/theme/utilities.css";
import "./styles/base.css";
import "./app/diagnostics/diagnostics.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Missing #root element");
}
const mountNode = rootElement;

const nodeLeak =
  typeof (globalThis as { require?: unknown }).require === "function" ||
  typeof (globalThis as { process?: { versions?: { node?: string } } }).process
    ?.versions?.node === "string";
if (nodeLeak) {
  // eslint-disable-next-line no-console -- boot-time sandbox leak probe
  console.warn("[renderer] unexpected Node globals present");
}

async function boot() {
  const fixturesOn = import.meta.env.VITE_ENABLE_UI_FIXTURES === "1";
  const wantsFixture =
    fixturesOn &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("fixture");

  let api;
  if (wantsFixture) {
    const { createFixtureDesktopApi } = await import(
      "./infrastructure/fixture-desktop-api"
    );
    api = createFixtureDesktopApi();
  } else {
    api = createDesktopApiClient(window.motionvideoDesktop);
  }

  createRoot(mountNode).render(
    <StrictMode>
      <DesktopApp api={api} />
    </StrictMode>,
  );
}

void boot();
