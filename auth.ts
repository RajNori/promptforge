import NextAuth, { type NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/server/db";

/** Providers are enabled only when their credentials exist, so the app runs before OAuth apps are created. */
export function enabledProviders() {
  const p: string[] = [];
  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) p.push("google");
  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) p.push("github");
  return p;
}

export const authEnabled = () => Boolean(db() && process.env.AUTH_SECRET && enabledProviders().length);

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const prisma = db();
  const providers: NextAuthConfig["providers"] = [];
  if (enabledProviders().includes("google")) providers.push(Google);
  if (enabledProviders().includes("github")) providers.push(GitHub);
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adapter: prisma ? PrismaAdapter(prisma as any) : undefined,
    providers,
    session: { strategy: prisma ? "database" : "jwt", maxAge: 60 * 60 * 24 * 30 },
    trustHost: true,
    pages: { signIn: "/signin" },
    callbacks: {
      session({ session, user }) {
        if (user && session.user) session.user.id = user.id;
        return session;
      },
    },
  };
});
