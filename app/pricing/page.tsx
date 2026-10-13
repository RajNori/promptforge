import type { Metadata } from "next";
import { PLANS, type PlanId } from "@/lib/plans";

export const metadata: Metadata = { title: "Pricing · Prompt Forge", description: "Free to start. Pro for people who ship prompts daily." };

const ORDER: PlanId[] = ["ANON", "FREE", "PRO"];

export default function Pricing() {
  return (
    <main className="page">
      <a href="/" className="back">
        ← Prompt Forge
      </a>
      <h1>Pricing</h1>
      <p className="lede">Instant templates are free and unlimited for everyone. AI generations are metered so the service stays fast and sustainable.</p>
      <div className="plans">
        {ORDER.map((id) => {
          const p = PLANS[id];
          return (
            <section key={id} className={`plan ${id === "PRO" ? "featured" : ""}`}>
              <h2>{p.name}</h2>
              <p className="price">
                {p.price}
                {id === "PRO" && <small>/month</small>}
              </p>
              <p className="note">{p.blurb}</p>
              <ul>
                {p.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              {id === "ANON" && (
                <a className="btn" href="/">
                  Start now
                </a>
              )}
              {id === "FREE" && (
                <a className="btn primary" href="/signin">
                  Sign up free
                </a>
              )}
              {id === "PRO" && (
                <button className="btn" disabled title="Payments launch shortly">
                  Coming soon
                </button>
              )}
            </section>
          );
        })}
      </div>
      <p className="note">Prices in AUD, GST inclusive. An AI generation is one generate or refine call; chain mode counts as two. Field autofill and brief analysis don&apos;t count.</p>
    </main>
  );
}
