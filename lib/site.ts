/** Canonical public origin. Override with NEXT_PUBLIC_SITE_URL for previews/forks. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://betterpromptgenerator.online").replace(/\/+$/, "");
export const SITE_NAME = "Better Prompt Generator";
