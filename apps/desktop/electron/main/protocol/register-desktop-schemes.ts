import { protocol, type CustomScheme } from "electron";
import { MVMEDIA_PROTOCOL } from "./mvmedia-registry";
import { APP_SCHEME_PRIVILEGES } from "./register-app-protocol";

const MVMEDIA_SCHEME_PRIVILEGES: CustomScheme = {
  scheme: MVMEDIA_PROTOCOL,
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true,
    stream: true,
  },
};

/**
 * Register app:// and mvmedia:// as privileged — must run before app.ready.
 * Single call so schemes are not overwritten.
 */
export function registerDesktopSchemesPrivileged(): void {
  protocol.registerSchemesAsPrivileged([
    APP_SCHEME_PRIVILEGES,
    MVMEDIA_SCHEME_PRIVILEGES,
  ]);
}
