import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
    tracesSampleRate: 0.1,
    // Never send user info, cookies or bodies: briefs are user content.
    dataCollection: { userInfo: false, cookies: false, httpBodies: [] },
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
