"use server";

import { signIn, signOut, enabledProviders } from "@/auth";

export async function signInWith(provider: string) {
  if (!enabledProviders().includes(provider)) return;
  await signIn(provider, { redirectTo: "/" });
}

export async function doSignOut() {
  await signOut({ redirectTo: "/" });
}
