import * as Sentry from "@sentry/nextjs";

// Error monitoring. Inert until SENTRY_DSN is set, so local dev and previews without it are unaffected.
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? "development",
    tracesSampleRate: 0.1,
    // Never send user info, cookies or bodies: briefs are user content.
    dataCollection: { userInfo: false, cookies: false, httpBodies: [] },
  });
}

export const onRequestError = Sentry.captureRequestError;
