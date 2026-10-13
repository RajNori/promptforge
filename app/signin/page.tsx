import type { Metadata } from "next";
import { authEnabled, enabledProviders } from "@/auth";
import { signInWith } from "../actions";
import { PLANS } from "@/lib/plans";

export const metadata: Metadata = { title: "Sign in · Prompt Forge" };
export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = { google: "Continue with Google", github: "Continue with GitHub" };

export default function SignIn() {
  const providers = enabledProviders();
  return (
    <main className="page narrow">
      <a href="/" className="back">
        ← Prompt Forge
      </a>
      <h1>Sign in</h1>
      <p className="lede">Save your prompts, keep version history across devices, and get {PLANS.FREE.aiActions} AI generations a month — free.</p>
      {authEnabled() ? (
        <div className="signin-list">
          {providers.map((p) => (
            <form key={p} action={signInWith.bind(null, p)}>
              <button className="btn signin" type="submit">
                {LABEL[p] ?? p}
              </button>
            </form>
          ))}
        </div>
      ) : (
        <p className="note">Sign-in isn&apos;t configured yet.</p>
      )}
      <p className="note">
        By continuing you agree to the <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
      </p>
    </main>
  );
}
