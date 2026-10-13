import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy", alternates: { canonical: "/privacy" } };

export default function Privacy() {
  return (
    <main className="page narrow prose">
      <a href="/" className="back">
        ← Prompt Forge
      </a>
      <h1>Privacy Policy</h1>
      <p className="note">Last updated 13 October 2026</p>
      <h2>What we collect</h2>
      <ul>
        <li>Account details from your sign-in provider: name, email and avatar.</li>
        <li>Prompts you save: briefs and generated versions (signed-in users only).</li>
        <li>Usage records: timestamps and counts of AI calls, used for limits and billing. Guests are identified by a one-way hash of their IP address; raw IPs are not stored.</li>
      </ul>
      <h2>How it&apos;s used</h2>
      <p>Only to provide the service, enforce fair-use limits, and prevent abuse. We don&apos;t sell personal information or use your content for advertising.</p>
      <h2>AI processing</h2>
      <p>Briefs are sent to an AI model provider to generate prompts. Don&apos;t include secrets, credentials or sensitive personal information in briefs.</p>
      <h2>Storage and retention</h2>
      <p>Data is stored with our hosting and database providers. Guest history stays in your browser. Deleting a saved prompt deletes its versions; you can request account deletion at any time.</p>
      <h2>Your rights</h2>
      <p>Under the Australian Privacy Principles you can access or correct your information, or ask us to delete it, by contacting the operator.</p>
    </main>
  );
}
