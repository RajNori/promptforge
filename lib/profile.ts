import { z } from "zod";
import { PERSONA_IDS, TOOL_IDS, type Profile } from "./personas";
import { cleanText } from "./sanitize";

/** Shared (client + server) profile validator. Unknown keys dropped; bad values rejected. */
export const ProfileSchema = z.object({
  persona: z.enum(PERSONA_IDS),
  goals: z.array(z.preprocess((v) => cleanText(v, 40), z.string().min(1).max(40))).max(8),
  tool: z.enum(TOOL_IDS),
  level: z.enum(["new", "comfortable", "expert"]),
  mode: z.enum(["simple", "advanced"]),
});

export function parseProfile(v: unknown): Profile | null {
  const r = ProfileSchema.safeParse(v);
  return r.success ? (r.data as Profile) : null;
}
