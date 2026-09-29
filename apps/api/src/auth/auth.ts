import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, schema } from "../db/client";
import { env } from "../env";
import { provisionNewUser } from "./provision";

export const auth = betterAuth({
  secret: env.betterAuthSecret,
  baseURL: env.betterAuthUrl,
  trustedOrigins: [env.webAppUrl, ...env.additionalTrustedOrigins],
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: env.googleClientId,
      clientSecret: env.googleClientSecret,
    },
  },
  // api.neonix.video and app.neonix.video are sibling subdomains - without
  // this, Better Auth's session cookie is scoped to api.neonix.video only
  // and apps/web can never see it. No-op in local dev (cookieDomain unset,
  // both sides are on localhost anyway).
  advanced: env.cookieDomain
    ? { crossSubDomainCookies: { enabled: true, domain: env.cookieDomain } }
    : undefined,
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await provisionNewUser(user);
        },
      },
    },
  },
});
