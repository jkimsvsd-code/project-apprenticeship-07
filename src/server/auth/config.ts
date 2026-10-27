import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import { user, session, account, verification } from "../../../db/auth-schema";
export const SESSION_SECONDS = 60 * 60 * 24 * 7;
export function createAuth(db: D1Database, secret: string, baseURL: string) {
  if (!secret || secret.length < 32)
    throw new Error(
      "BETTER_AUTH_SECRET must be configured with at least 32 characters.",
    );
  return betterAuth({
    appName: "틈 다이어리",
    baseURL,
    secret,
    database: drizzleAdapter(drizzle(db), {
      provider: "sqlite",
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: true,
    },
    session: {
      expiresIn: SESSION_SECONDS,
      disableSessionRefresh: true,
      cookieCache: { enabled: false },
    },
    advanced: {
      cookiePrefix: "pds07",
      useSecureCookies: baseURL.startsWith("https://"),
    },
    trustedOrigins: [baseURL],
    rateLimit: { enabled: true, window: 60, max: 30, storage: "memory" },
    logger: { disabled: true },
  });
}
