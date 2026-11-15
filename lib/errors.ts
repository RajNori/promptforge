/**
 * Turns every failure of a prompt request (bad input, limits, the AI service, the network) into one
 * message that says what happened and what to do next, plus the actions that fix it. The server tags each
 * error with a `code`; anything untagged or unreadable falls back on the HTTP status, never on raw text
 * like "Request failed (500)" or a JSON parse error.
 */

export type ErrorAction = "retry" | "lean" | "instant" | "signin" | "pro" | "edit-objective" | "edit-feedback";

/** Where the problem is: a field gets the message under it; anything else shows beside the action that failed. */
export type ErrorField = "objective" | "feedback";

export type FriendlyError = {
  code: string;
  /** What happened, in one sentence. */
  msg: string;
  /** How to fix it, when that isn't obvious from the message. */
  hint?: string;
  field?: ErrorField;
  actions: ErrorAction[];
};

export type Mode = "analyze" | "generate" | "refine" | "suggest" | "hints";

const BUSY_AI: FriendlyError = {
  code: "busy",
  msg: "The AI service is busy right now.",
  hint: "Wait a few seconds and try again, or make a quick draft without AI.",
  actions: ["retry", "instant"],
};

const UNAVAILABLE: FriendlyError = {
  code: "unavailable",
  msg: "AI generation isn't available right now.",
  hint: "Your brief is kept. Make a quick draft without AI, or try again later.",
  actions: ["instant", "retry"],
};

const OFFLINE: FriendlyError = {
  code: "offline",
  msg: "You're offline, so the request wasn't sent.",
  hint: "Your brief is kept. Reconnect and try again.",
  actions: ["retry"],
};

const NETWORK: FriendlyError = {
  code: "network",
  msg: "Couldn't reach the server.",
  hint: "Check your connection and try again. Your brief is kept.",
  actions: ["retry"],
};

/** Server message for a code, when the server's own wording is already specific (quota numbers, limits). */
function fromCode(code: string, serverMsg: string, mode: Mode): FriendlyError | null {
  switch (code) {
    case "objective_required":
      return { code, msg: "Add an objective first.", hint: "Say what the prompt should get done, in one sentence.", field: "objective", actions: ["edit-objective"] };
    case "objective_short":
      return { code, msg: "That objective is too short to work with.", hint: "Add a few words about the task, who it's for or what the result is.", field: "objective", actions: ["edit-objective"] };
    case "no_signal":
      return { code, msg: "There's nothing to fill from yet.", hint: "Write an objective or some context, then try ✦ again.", field: "objective", actions: ["edit-objective"] };
    case "nothing_to_fill":
      return { code, msg: "Every field already has a value, so there's nothing to fill.", actions: [] };
    case "refine_empty":
      return { code, msg: "Say what to change before refining.", hint: "For example: “make it shorter” or “add a rollback plan”.", field: "feedback", actions: ["edit-feedback"] };
    case "too_large":
      return {
        code,
        msg: "Your brief is too long to send.",
        hint: "Shorten the longest fields (usually Context or Examples) and try again.",
        actions: ["edit-objective"],
      };
    case "blocked":
      return {
        code,
        msg: mode === "refine" ? "That change couldn't be applied." : "That brief couldn't be turned into a prompt.",
        hint: "Remove any instructions aimed at the AI itself (like “ignore previous instructions”) and describe what you want plainly.",
        field: mode === "refine" ? "feedback" : "objective",
        actions: [mode === "refine" ? "edit-feedback" : "edit-objective"],
      };
    case "access_code":
      return { code, msg: "The access code is wrong.", hint: "Check the code in the Access code field and try again.", actions: [] };
    case "forbidden":
      return { code, msg: "This page is out of date, so the request was refused.", hint: "Reload the page. Your brief is saved in this browser.", actions: [] };
    case "quota":
      return {
        code,
        msg: serverMsg || "You've used all your AI generations for now.",
        hint: "Quick drafts without AI still work.",
        actions: /sign in/i.test(serverMsg) ? ["signin", "instant"] : /upgrade/i.test(serverMsg) ? ["pro", "instant"] : ["instant"],
      };
    case "burst":
      return { code, msg: "That's a lot of requests in a short time.", hint: "Wait a minute, then try again.", actions: ["retry"] };
    case "auto":
      return { code, msg: serverMsg || "Auto-fix limit reached.", hint: "Describe the fix yourself in the refine box.", field: "feedback", actions: ["edit-feedback"] };
    case "budget":
      return { code, msg: "AI generation is paused for today.", hint: "Quick drafts without AI still work, and AI is back tomorrow.", actions: ["instant"] };
    case "busy":
      return BUSY_AI;
    case "not_configured":
    case "unavailable":
      return UNAVAILABLE;
    case "empty_output":
      return { code, msg: "The AI returned nothing for that request.", hint: "Try again. If it keeps happening, add a sentence of context to the brief.", actions: ["retry"] };
    case "upstream":
      return { code, msg: "The AI service failed to answer.", hint: "Try again. Your brief is kept.", actions: ["retry", "instant"] };
    case "bad_request":
      return { code, msg: "Part of the brief couldn't be read.", hint: "Reload the page and try again. Your brief is saved in this browser.", actions: ["retry"] };
  }
  return null;
}

function fromStatus(status: number): FriendlyError {
  if (status === 401) return fromCode("access_code", "", "generate")!;
  if (status === 403) return fromCode("forbidden", "", "generate")!;
  if (status === 413) return fromCode("too_large", "", "generate")!;
  if (status === 429) return BUSY_AI;
  if (status === 402) return fromCode("quota", "", "generate")!;
  if (status === 503) return UNAVAILABLE;
  if (status === 504 || status === 408) return { code: "timeout", msg: "The request took too long and was stopped.", hint: "Try again, or pick Lean depth for a faster result.", actions: ["retry", "lean"] };
  if (status >= 500) return fromCode("upstream", "", "generate")!;
  return fromCode("bad_request", "", "generate")!;
}

/** Body of an error response, or {} when it isn't JSON (an HTML error page, a cut-off body). */
export async function readJson(r: Response): Promise<Record<string, unknown>> {
  try {
    const d = await r.json();
    return d && typeof d === "object" ? (d as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** A failed HTTP response from /api/generate. */
export function fromResponse(status: number, data: Record<string, unknown>, mode: Mode): FriendlyError {
  const code = typeof data.code === "string" ? data.code : "";
  const serverMsg = typeof data.error === "string" ? data.error : "";
  return (code && fromCode(code, serverMsg, mode)) || fromStatus(status);
}

/** A thrown fetch/stream error. Returns null for a deliberate Stop (AbortError), which isn't an error. */
export function fromException(e: unknown): FriendlyError | null {
  if (e && typeof e === "object" && "friendly" in e) return (e as { friendly: FriendlyError }).friendly;
  if ((e as Error)?.name === "AbortError") return null;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return OFFLINE;
  // fetch() rejects with a TypeError ("Failed to fetch", "Load failed", "NetworkError…") when the request never got an answer.
  if (e instanceof TypeError) return NETWORK;
  return { code: "unknown", msg: "Something stopped that request.", hint: "Try again. Your brief is kept.", actions: ["retry"] };
}

/** The end-of-stream status the generate route sends after the prompt text. */
export function fromStreamStatus(status: "cut" | "blocked" | "off" | "len" | "empty", depth: string, mode: Mode = "generate"): FriendlyError {
  const lean = depth === "lean" ? [] : (["lean"] as ErrorAction[]);
  switch (status) {
    case "cut":
      return { code: "cut", msg: "The prompt was cut off before it finished, so it wasn't saved.", hint: depth === "lean" ? "Try again." : "Try again, or pick Lean depth for a faster result.", actions: ["retry", ...lean] };
    case "blocked":
      return fromCode("blocked", "", mode)!;
    case "off":
      return { code: "off", msg: "The AI's answer didn't follow the prompt format, so it wasn't saved.", hint: "Try again. If it repeats, make the objective more specific.", actions: ["retry"] };
    case "len":
      return { code: "len", msg: "The prompt hit the length limit and may be missing its last part.", hint: depth === "lean" ? "Turn off chain mode, or refine with “make it shorter”." : "Pick Lean depth or turn off chain mode, then try again.", actions: lean.length ? ["lean"] : [] };
    case "empty":
      return fromCode("empty_output", "", "generate")!;
  }
}

/** Throwable wrapper so a mapped error survives a `throw` inside a try block. */
export class RequestError extends Error {
  constructor(public friendly: FriendlyError) {
    super(friendly.msg);
  }
}

export const ACTION_LABEL: Record<ErrorAction, string> = {
  retry: "Try again",
  lean: "Use Lean depth",
  instant: "Quick draft (no AI)",
  signin: "Sign in",
  pro: "See Pro",
  "edit-objective": "Edit objective",
  "edit-feedback": "Edit request",
};
