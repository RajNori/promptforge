// Personas: who the user is, what they want from AI, and the templates/defaults that fit them.

import { EMPTY_BRIEF, type Brief, type Target } from "./forge";
import { EXAMPLES } from "./examples";

export type PersonaId =
  | "marketer"
  | "ea"
  | "student"
  | "founder"
  | "sales"
  | "educator"
  | "writer"
  | "hr"
  | "analyst"
  | "developer"
  | "general";

export type Tool = "chatgpt" | "claude" | "gemini" | "copilot" | "agent" | "api";
export type Level = "new" | "comfortable" | "expert";
export type Mode = "simple" | "advanced";

export type Profile = {
  persona: PersonaId;
  goals: string[];
  tool: Tool;
  level: Level;
  mode: Mode;
};

type Goal = { id: string; label: string };

export type Persona = {
  id: PersonaId;
  label: string;
  blurb: string;
  goals: Goal[];
  /** Placeholder overrides so fields speak the user's language. */
  placeholders: Partial<Record<"objective" | "context" | "deliverable" | "successCriteria" | "audience" | "tone", string>>;
};

export const PERSONAS: Persona[] = [
  {
    id: "marketer",
    label: "Marketer",
    blurb: "Campaigns, ads, social, content",
    goals: [
      { id: "campaigns", label: "Campaigns & launches" },
      { id: "ads", label: "Ad copy" },
      { id: "social", label: "Social posts" },
      { id: "content", label: "Blogs & SEO" },
      { id: "email", label: "Email marketing" },
    ],
    placeholders: {
      objective: "Write 3 Facebook ad variations for our winter sale…",
      context: "Brand, product, offer, channel, what's worked before…",
      audience: "Busy parents in Melbourne, price-conscious",
      tone: "Warm, punchy, no hype",
      deliverable: "3 ad variants with headline, body, CTA",
    },
  },
  {
    id: "ea",
    label: "Executive / Personal Assistant",
    blurb: "Emails, memos, meetings, planning",
    goals: [
      { id: "email", label: "Draft & reply to emails" },
      { id: "meetings", label: "Agendas & minutes" },
      { id: "docs", label: "Memos & briefings" },
      { id: "planning", label: "Travel & event planning" },
      { id: "summaries", label: "Summarise long docs" },
    ],
    placeholders: {
      objective: "Draft a polite email declining a meeting on my CEO's behalf…",
      context: "Who it's from, who it's to, relationship, deadlines…",
      audience: "Senior stakeholders",
      tone: "Professional, warm, concise",
      deliverable: "Ready-to-send email with subject line",
    },
  },
  {
    id: "student",
    label: "Student",
    blurb: "Study, essays, research, careers",
    goals: [
      { id: "study", label: "Understand topics" },
      { id: "exam", label: "Exam prep & quizzes" },
      { id: "essays", label: "Essays & assignments" },
      { id: "research", label: "Research & sources" },
      { id: "career", label: "Resume & cover letters" },
    ],
    placeholders: {
      objective: "Explain photosynthesis so I can answer exam questions on it…",
      context: "Course, level, what you already know, assessment format…",
      audience: "Me — first-year uni student",
      tone: "Clear, encouraging",
      deliverable: "Study notes + 10 practice questions",
    },
  },
  {
    id: "founder",
    label: "Founder / Product",
    blurb: "Strategy, pitches, specs, customers",
    goals: [
      { id: "strategy", label: "Strategy & decisions" },
      { id: "pitch", label: "Pitch & investor updates" },
      { id: "product", label: "Product specs" },
      { id: "customers", label: "Customer research" },
      { id: "hiring", label: "Hiring" },
    ],
    placeholders: {
      objective: "Write our monthly investor update for September…",
      context: "Stage, metrics, wins, risks, what you need from readers…",
      audience: "Seed investors and advisors",
      tone: "Candid, confident, specific",
    },
  },
  {
    id: "sales",
    label: "Sales / BD",
    blurb: "Outreach, follow-ups, proposals",
    goals: [
      { id: "outreach", label: "Cold outreach" },
      { id: "followup", label: "Follow-ups" },
      { id: "calls", label: "Call prep" },
      { id: "proposals", label: "Proposals" },
      { id: "objections", label: "Objection handling" },
    ],
    placeholders: {
      objective: "Write a 3-email cold sequence for operations managers at logistics firms…",
      context: "Product, ICP, pain points, proof points, CTA…",
      audience: "Ops managers at 50–500 person companies",
      tone: "Direct, helpful, not salesy",
    },
  },
  {
    id: "educator",
    label: "Teacher / Educator",
    blurb: "Lesson plans, quizzes, feedback",
    goals: [
      { id: "lessons", label: "Lesson plans" },
      { id: "assess", label: "Quizzes & rubrics" },
      { id: "feedback", label: "Student feedback" },
      { id: "parents", label: "Parent communication" },
      { id: "differentiate", label: "Differentiation" },
    ],
    placeholders: {
      objective: "Create a 50-minute Year 8 lesson on fractions…",
      context: "Year level, curriculum outcome, class needs, resources…",
      audience: "Year 8 students, mixed ability",
      tone: "Engaging, clear",
    },
  },
  {
    id: "writer",
    label: "Writer / Creator",
    blurb: "Articles, scripts, newsletters, stories",
    goals: [
      { id: "articles", label: "Articles & blogs" },
      { id: "scripts", label: "Video scripts" },
      { id: "newsletter", label: "Newsletters" },
      { id: "fiction", label: "Stories & fiction" },
      { id: "editing", label: "Editing & rewriting" },
    ],
    placeholders: {
      objective: "Write a 60-second YouTube Short script about…",
      context: "Channel, format, past hits, key points to cover…",
      audience: "Followers aged 25–40 into personal finance",
      tone: "Conversational, witty",
    },
  },
  {
    id: "hr",
    label: "HR / Recruiter",
    blurb: "Job ads, interviews, policies",
    goals: [
      { id: "jobs", label: "Job descriptions" },
      { id: "interviews", label: "Interview kits" },
      { id: "policies", label: "Policies & docs" },
      { id: "onboarding", label: "Onboarding" },
      { id: "reviews", label: "Performance reviews" },
    ],
    placeholders: {
      objective: "Write a job ad for a senior customer success manager…",
      context: "Company, team, must-haves, salary band, location…",
      audience: "Experienced CSMs open to a move",
      tone: "Inclusive, honest, energetic",
    },
  },
  {
    id: "analyst",
    label: "Researcher / Analyst",
    blurb: "Research, data, reports",
    goals: [
      { id: "research", label: "Research synthesis" },
      { id: "data", label: "Data analysis" },
      { id: "reports", label: "Reports & briefs" },
      { id: "competitive", label: "Competitive analysis" },
      { id: "surveys", label: "Surveys" },
    ],
    placeholders: {
      objective: "Summarise these 12 interview transcripts into key themes…",
      context: "Data source, scope, decision it informs…",
      audience: "Leadership team",
      tone: "Neutral, evidence-led",
    },
  },
  {
    id: "developer",
    label: "Developer / Engineer",
    blurb: "Build, debug, review with AI agents",
    goals: [
      { id: "build", label: "Build features" },
      { id: "debug", label: "Fix bugs" },
      { id: "refactor", label: "Refactor & migrate" },
      { id: "review", label: "Code review & audits" },
      { id: "architecture", label: "Architecture" },
      { id: "api", label: "Prompts for my app (API)" },
    ],
    placeholders: {},
  },
  {
    id: "general",
    label: "Something else",
    blurb: "Everyday writing, learning, planning",
    goals: [
      { id: "writing", label: "Everyday writing" },
      { id: "learning", label: "Learning something" },
      { id: "planning", label: "Planning & organising" },
      { id: "decisions", label: "Making decisions" },
    ],
    placeholders: {
      objective: "Help me plan a 5-day family trip to Tasmania…",
    },
  },
];

export const TOOLS: { id: Tool; label: string; hint: string; target: Target }[] = [
  { id: "chatgpt", label: "ChatGPT", hint: "OpenAI", target: "chat-llm" },
  { id: "claude", label: "Claude", hint: "Anthropic", target: "chat-llm" },
  { id: "gemini", label: "Gemini", hint: "Google", target: "chat-llm" },
  { id: "copilot", label: "Copilot", hint: "Microsoft", target: "chat-llm" },
  { id: "agent", label: "Coding agents", hint: "Claude Code, Cursor, Codex", target: "claude-code" },
  { id: "api", label: "My own app", hint: "System prompts via API", target: "api-system" },
];

export const LEVELS: { id: Level; label: string; hint: string }[] = [
  { id: "new", label: "New to this", hint: "Keep it simple" },
  { id: "comfortable", label: "Comfortable", hint: "I use AI weekly" },
  { id: "expert", label: "Expert", hint: "Show me every control" },
];

/** Default task type per persona — drives the framework auto-pick for a blank brief. */
export const PERSONA_TASK: Record<PersonaId, string> = {
  marketer: "Marketing & ads",
  ea: "Email / message",
  student: "Study & learning",
  founder: "Product / strategy",
  sales: "Email / message",
  educator: "Planning & admin",
  writer: "Writing / content",
  hr: "Writing / content",
  analyst: "Research & analysis",
  developer: "Build a feature",
  general: "Other",
};

export const persona = (id: PersonaId | undefined) => PERSONAS.find((p) => p.id === id) ?? PERSONAS[PERSONAS.length - 1];

export function defaultProfile(id: PersonaId = "general"): Profile {
  const dev = id === "developer";
  return { persona: id, goals: [], tool: dev ? "agent" : "chatgpt", level: dev ? "expert" : "comfortable", mode: dev ? "advanced" : "simple" };
}

export const modeFor = (level: Level, p: PersonaId): Mode => (level === "expert" || p === "developer" ? "advanced" : "simple");
export const targetFor = (tool: Tool): Target => TOOLS.find((t) => t.id === tool)?.target ?? "chat-llm";

// ── Templates ────────────────────────────────────────────────────────────

export type Template = {
  id: string;
  persona: PersonaId;
  goal: string;
  name: string;
  brief: Partial<Brief> & Pick<Brief, "taskType" | "objective">;
};

const r = (rule: string, why: string) => ({ rule, why });
const T = (persona: PersonaId, goal: string, id: string, name: string, brief: Template["brief"]): Template => ({ id, persona, goal, name, brief });

export const TEMPLATES: Template[] = [
  // ── Marketer
  T("marketer", "campaigns", "mk-launch", "Product launch campaign plan", {
    taskType: "Marketing & ads",
    objective: "Plan a 4-week launch campaign for our new budgeting app feature, 'Bill Splitter'.",
    context: "B2C fintech app, 80k active users in Australia. Channels: Instagram, TikTok, email, in-app. Budget A$15k. Last launch got most installs from creator partnerships.",
    audience: "Share-house renters and couples aged 22–35",
    tone: "Friendly, clever, practical",
    deliverable: "Week-by-week plan with channels, key messages, assets list and KPIs",
    successCriteria: "Each week has one clear goal and KPI\nBudget split adds up to A$15k\nIncludes 3 creator brief ideas",
    rules: [r("No claims about saving specific dollar amounts", "we can't substantiate them (ACL risk)")],
  }),
  T("marketer", "ads", "mk-meta-ads", "Facebook / Instagram ad variants", {
    taskType: "Marketing & ads",
    objective: "Write 5 Meta ad variations for our end-of-season sale on outdoor furniture.",
    context: "Online furniture retailer, 30% off selected outdoor ranges for 10 days. Best-performing past ads used lifestyle hooks, not discounts.",
    audience: "Homeowners 30–55 who entertain at home",
    tone: "Warm, aspirational, concise",
    deliverable: "5 variants each with primary text (≤125 chars), headline (≤40 chars) and CTA",
    successCriteria: "Each variant tests a different hook\nCharacter limits respected\nOffer and end date stated clearly",
    rules: [r("No ALL CAPS or more than one emoji per ad", "lowers trust and ad quality scores")],
  }),
  T("marketer", "ads", "mk-google-ads", "Google search ads", {
    taskType: "Marketing & ads",
    objective: "Write responsive search ad assets for a local physiotherapy clinic.",
    context: "Clinic in Fitzroy, Melbourne. Services: sports injuries, back pain, pilates. Bulk-billing not available; online booking same-day.",
    audience: "People searching for physio near them with pain right now",
    tone: "Reassuring, clear",
    deliverable: "15 headlines (≤30 chars) and 4 descriptions (≤90 chars)",
    successCriteria: "Headlines include location and service keywords\nAt least 3 headlines mention same-day booking\nAll within character limits",
    rules: [r("No outcome guarantees", "health advertising rules prohibit them")],
  }),
  T("marketer", "social", "mk-social-week", "A week of social posts", {
    taskType: "Marketing & ads",
    objective: "Create a week of LinkedIn posts for our B2B cybersecurity company.",
    context: "We help mid-sized companies pass ISO 27001 faster. Key themes: audit prep, common mistakes, customer wins. Founder posts perform better than company page.",
    audience: "IT managers and CTOs at 100–1000 person companies",
    tone: "Expert, plain-English, a little dry",
    deliverable: "5 posts (one per weekday), each 120–200 words with a hook first line",
    successCriteria: "Each post has a different format (story, list, myth-bust, question, win)\nNo jargon without explanation\nEnds with a conversation prompt",
    rules: [r("No fear-mongering about breaches", "our brand is calm competence")],
  }),
  T("marketer", "content", "mk-seo-blog", "SEO blog post", {
    taskType: "Writing / content",
    objective: "Write an SEO blog post targeting 'how to choose a wedding photographer Melbourne'.",
    context: "We're a wedding photography studio. Want to rank and convert readers to enquiries. Competitors' posts are generic listicles.",
    audience: "Couples 6–18 months from their wedding",
    tone: "Warm, expert, honest",
    deliverable: "1,200-word post with H2s, a checklist section, meta title and meta description",
    successCriteria: "Primary keyword in title, first 100 words and one H2\nIncludes 8+ specific questions to ask a photographer\nSoft CTA to book a call",
    rules: [r("Don't disparage other photographers", "reputation in a small local market")],
  }),
  T("marketer", "email", "mk-email-sequence", "Welcome email sequence", {
    taskType: "Email / message",
    objective: "Write a 4-email welcome sequence for new newsletter subscribers of our coffee subscription brand.",
    context: "Specialty coffee roaster, subscriptions from A$22/fortnight. Goal: convert subscribers to a first order within 14 days. Offer: free AeroPress with first subscription.",
    audience: "Home coffee enthusiasts who just signed up",
    tone: "Friendly, knowledgeable, not pushy",
    deliverable: "4 emails with subject line, preview text, body and CTA, plus send timing",
    successCriteria: "Offer introduced by email 2\nEach email teaches something genuinely useful\nSubject lines under 45 characters",
  }),

  // ── EA
  T("ea", "email", "ea-decline", "Decline a meeting politely", {
    taskType: "Email / message",
    objective: "Draft an email declining a meeting request on behalf of my CEO and offering an alternative.",
    context: "Request came from a vendor we're not prioritising this quarter but want to keep warm. CEO is available for a 20-min call in 6 weeks.",
    audience: "Vendor account executive",
    tone: "Gracious, brief, firm",
    deliverable: "Ready-to-send email with subject line, under 120 words",
    successCriteria: "Clear no for now\nOffers a specific alternative\nKeeps the relationship positive",
  }),
  T("ea", "email", "ea-inbox-triage", "Reply to a tricky email thread", {
    taskType: "Email / message",
    objective: "Draft a reply to a client who is unhappy that a deliverable slipped by a week.",
    context: "Paste the thread below. Delay caused by their late approvals but we don't want to blame. New date is confirmed. Account is worth A$200k/yr.",
    audience: "Client's Head of Marketing",
    tone: "Accountable, calm, solution-focused",
    deliverable: "Reply email under 180 words",
    successCriteria: "Acknowledges the frustration\nGives the confirmed new date\nProposes one concrete step to prevent repeats",
    rules: [r("Don't assign blame to the client", "it escalates and risks the account")],
  }),
  T("ea", "meetings", "ea-agenda", "Meeting agenda", {
    taskType: "Planning & admin",
    objective: "Create an agenda for a 90-minute quarterly leadership offsite session.",
    context: "6 attendees. Topics: Q3 results, hiring plan, pricing change decision, team morale. Pricing decision must be made in this meeting.",
    deliverable: "Timed agenda with owners, pre-reads and the decision to be made per item",
    successCriteria: "Fits in 90 minutes with a 10-minute buffer\nPricing decision gets the most time\nEach item has an owner and outcome",
  }),
  T("ea", "meetings", "ea-minutes", "Turn notes into minutes", {
    taskType: "Planning & admin",
    objective: "Turn my rough meeting notes into clean minutes with actions.",
    context: "Paste rough notes below. Board-style formatting. Actions must have owner and due date.",
    deliverable: "Minutes: attendees, decisions, discussion summary, action table",
    successCriteria: "Every action has owner and date\nDecisions listed separately from discussion\nUnder one page",
    rules: [r("Don't invent attendees, dates or decisions", "minutes are a formal record")],
  }),
  T("ea", "docs", "ea-memo", "Internal memo", {
    taskType: "Writing / content",
    objective: "Write an all-staff memo announcing a new hybrid work policy.",
    context: "From 1 Feb: 3 office days (Tue–Thu), Mon/Fri flexible. Reason: collaboration and onboarding. Exceptions via manager. Previous policy was fully flexible.",
    audience: "All staff, some will be unhappy",
    tone: "Clear, respectful, firm",
    deliverable: "Memo under 300 words with a short FAQ",
    successCriteria: "States what changes, when and why\nExplains how to request exceptions\nFAQ answers 4 likely concerns",
  }),
  T("ea", "planning", "ea-travel", "Business trip itinerary", {
    taskType: "Planning & admin",
    objective: "Build a 3-day Sydney itinerary for my executive's investor meetings.",
    context: "Flying from Melbourne Mon 7am, back Wed evening. 5 meetings in CBD and North Sydney (times below). Prefers hotels walking distance to Barangaroo. Needs 1 hour daily for calls.",
    deliverable: "Day-by-day itinerary with travel buffers, hotel suggestion criteria and a packing checklist",
    successCriteria: "30-minute buffers between meetings across locations\nDaily 1-hour call block protected\nAll meetings included",
  }),
  T("ea", "summaries", "ea-summary", "Summarise a long report", {
    taskType: "Research & analysis",
    objective: "Summarise a 40-page board paper into a one-page brief for my CEO.",
    context: "Paste the document below. CEO wants decisions needed, risks and numbers that changed since last quarter.",
    deliverable: "One-page brief: TL;DR, decisions needed, key numbers, risks, questions to ask",
    successCriteria: "Fits on one page\nEvery number cited with its page\nNo opinions added",
  }),

  // ── Student
  T("student", "study", "st-explain", "Explain a topic simply", {
    taskType: "Study & learning",
    objective: "Explain how the immune system fights a virus so I can answer exam questions on it.",
    context: "Year 12 Biology. I understand cells but get confused between innate and adaptive immunity.",
    audience: "Me — Year 12 student",
    tone: "Clear, step-by-step, encouraging",
    deliverable: "Explanation with an analogy, a labelled sequence of steps, and 5 check-your-understanding questions",
    successCriteria: "Clearly distinguishes innate vs adaptive\nUses one consistent analogy\nQuestions get progressively harder",
  }),
  T("student", "exam", "st-quiz", "Practice exam questions", {
    taskType: "Study & learning",
    objective: "Create a practice exam on supply and demand for my economics midterm.",
    context: "First-year uni microeconomics. Exam is 50% multiple choice, 50% short answer with diagrams described in words.",
    deliverable: "10 MCQs and 3 short-answer questions with model answers and marking guide",
    successCriteria: "Mix of easy, medium, hard\nEach MCQ has plausible distractors\nModel answers show working",
  }),
  T("student", "essays", "st-essay-plan", "Essay plan & feedback", {
    taskType: "Study & learning",
    objective: "Help me plan a 2,000-word essay on whether social media has harmed democracy.",
    context: "Politics course, needs a clear argument and academic sources. Due in 2 weeks. My draft thesis is below.",
    deliverable: "Thesis options, paragraph-by-paragraph outline, counter-arguments, and search terms for sources",
    successCriteria: "Argument is clear and arguable\nEach paragraph has a claim and evidence type\nIncludes the strongest counter-argument",
    rules: [r("Don't write the essay for me", "it must be my own work under academic integrity rules")],
  }),
  T("student", "research", "st-sources", "Find & evaluate sources", {
    taskType: "Research & analysis",
    objective: "Help me research the effects of remote work on productivity for a literature review.",
    context: "Psychology honours. Need peer-reviewed studies from the last 5 years.",
    deliverable: "Search strategy, key databases, search strings, and a checklist to evaluate each study",
    successCriteria: "Search strings use Boolean operators\nIncludes inclusion/exclusion criteria",
    rules: [r("Never invent citations", "fabricated references are academic misconduct")],
  }),
  T("student", "career", "st-cover-letter", "Cover letter", {
    taskType: "Writing / content",
    objective: "Write a cover letter for a graduate data analyst role at a bank.",
    context: "Graduating BCom (Finance) with Python and SQL projects; internship at a fintech startup. Job ad pasted below.",
    audience: "Graduate recruitment team",
    tone: "Confident, specific, humble",
    deliverable: "Cover letter under 350 words",
    successCriteria: "Mirrors 3 key requirements from the ad\nOne concrete achievement with a number\nNo clichés",
  }),

  // ── Founder
  T("founder", "pitch", "fd-investor-update", "Monthly investor update", {
    taskType: "Writing / content",
    objective: "Write our monthly investor update.",
    context: "Seed-stage SaaS. MRR $48k (+9% MoM), 2 enterprise pilots, churn up to 3.1%, runway 14 months. Need intros to heads of procurement.",
    audience: "Seed investors and angels",
    tone: "Candid, concise, confident",
    deliverable: "Update with TL;DR, metrics table, wins, lowlights, asks",
    successCriteria: "Bad news stated plainly\nAsks are specific and actionable\nUnder 400 words",
  }),
  T("founder", "strategy", "fd-decision", "Decision memo", {
    taskType: "Product / strategy",
    objective: "Help me decide whether to raise prices by 20% or launch a new premium tier.",
    context: "B2B SaaS, 600 customers at $49/mo. Top 15% of customers use 3x the features. Two competitors raised prices this year.",
    audience: "Co-founder and board",
    tone: "Analytical, decisive",
    deliverable: "Options compared on revenue, churn risk and effort, with a recommendation",
    successCriteria: "Assumptions stated explicitly\nIncludes a reversible first step\nClear recommendation",
  }),
  T("founder", "product", "fd-prd", "Product spec (PRD)", {
    taskType: "Product / strategy",
    objective: "Write a one-page PRD for a 'team invites' feature.",
    context: "Currently one user per account. Customers ask to add teammates. Billing per seat later; not in v1.",
    deliverable: "PRD: problem, goals, non-goals, user stories, requirements, success metrics, open questions",
    successCriteria: "Non-goals explicit\nEach requirement testable\nMetrics have targets",
  }),
  T("founder", "customers", "fd-interviews", "Customer interview guide", {
    taskType: "Research & analysis",
    objective: "Create a customer discovery interview guide for small accounting firms.",
    context: "Exploring an AI tool for month-end reconciliation. We want to learn their current process and pain, not pitch.",
    deliverable: "30-minute interview guide with warm-up, core questions, probes and wrap-up",
    successCriteria: "No leading questions\nFocus on past behaviour, not hypotheticals",
  }),
  T("founder", "hiring", "fd-first-hire", "First engineering hire job ad", {
    taskType: "Writing / content",
    objective: "Write a job ad for our first full-stack engineer.",
    context: "Pre-seed, 2 founders, React/Node, remote in Australia, salary $150–170k + 1% equity.",
    audience: "Senior engineers who want early-stage ownership",
    tone: "Honest, ambitious, human",
    deliverable: "Job ad with role, why now, what you'll do, must-haves, nice-to-haves, how to apply",
    successCriteria: "Salary shown\nHonest about risks of early-stage",
  }),

  // ── Sales
  T("sales", "outreach", "sl-cold-sequence", "Cold email sequence", {
    taskType: "Email / message",
    objective: "Write a 3-email cold outreach sequence for operations managers at logistics companies.",
    context: "We sell route optimisation software; customers cut fuel costs 12% on average. Case study: Swift Freight.",
    audience: "Ops managers at 50–500 person logistics firms",
    tone: "Direct, helpful, not salesy",
    deliverable: "3 emails with subject lines, each under 90 words, with timing",
    successCriteria: "Email 1 leads with their problem, not our product\nOne clear CTA per email\nNo fake personalisation tokens",
  }),
  T("sales", "followup", "sl-followup", "Post-demo follow-up", {
    taskType: "Email / message",
    objective: "Write a follow-up email after a product demo with a warm prospect.",
    context: "Demo went well; they asked about SSO and onboarding timelines. Decision-maker (CFO) wasn't on the call.",
    audience: "Champion who will forward it to their CFO",
    tone: "Crisp, helpful",
    deliverable: "Follow-up email with recap, answers to their questions and next step",
    successCriteria: "Forwardable to CFO without context\nProposes a specific next meeting",
  }),
  T("sales", "calls", "sl-call-prep", "Discovery call prep", {
    taskType: "Research & analysis",
    objective: "Prepare me for a discovery call with a mid-sized retailer's Head of Ecommerce.",
    context: "Company info and their LinkedIn below. We sell personalisation software.",
    deliverable: "Call plan: likely priorities, 8 discovery questions, risks, success criteria for the call",
    successCriteria: "Questions are open-ended\nIdentifies likely objections",
  }),
  T("sales", "objections", "sl-objections", "Objection handling", {
    taskType: "Other",
    objective: "Create responses to the 6 most common objections we hear.",
    context: "Objections: too expensive, no time to implement, using a competitor, need to check with boss, not a priority, send me info.",
    tone: "Empathetic, confident",
    deliverable: "For each objection: what it usually means, a response, and a question to keep the conversation going",
    successCriteria: "Responses under 50 words\nNo pressure tactics",
  }),

  // ── Educator
  T("educator", "lessons", "ed-lesson", "Lesson plan", {
    taskType: "Planning & admin",
    objective: "Create a 50-minute Year 8 maths lesson on adding fractions with unlike denominators.",
    context: "Mixed-ability class of 26; 4 students need extra support. Have mini whiteboards. Australian Curriculum.",
    audience: "Year 8 students",
    deliverable: "Lesson plan: objective, warm-up, explicit teaching, guided practice, independent task, exit ticket, differentiation",
    successCriteria: "Timings add to 50 minutes\nIncludes an extension and support task\nExit ticket checks the objective",
  }),
  T("educator", "assess", "ed-rubric", "Assessment rubric", {
    taskType: "Study & learning",
    objective: "Write a rubric for a Year 10 persuasive essay.",
    context: "Criteria: argument, evidence, structure, language. Graded A–E.",
    deliverable: "Rubric table with descriptors for each grade and criterion",
    successCriteria: "Descriptors are observable, not vague\nClear progression between grades",
  }),
  T("educator", "feedback", "ed-feedback", "Student feedback comments", {
    taskType: "Writing / content",
    objective: "Turn my rough notes into constructive feedback for 5 student essays.",
    context: "Notes per student below. Use 'glow and grow' format.",
    tone: "Warm, specific, actionable",
    deliverable: "Feedback per student: 2 strengths, 1–2 next steps",
    successCriteria: "Every comment is specific to the student's work\nNext steps are actionable",
  }),
  T("educator", "parents", "ed-parent-email", "Parent email", {
    taskType: "Email / message",
    objective: "Write an email to parents about an upcoming excursion.",
    context: "Year 5 excursion to Melbourne Museum, Fri 14 Nov, $18 cost, consent form due 7 Nov, packed lunch needed.",
    audience: "Parents and carers",
    tone: "Friendly, clear",
    deliverable: "Email under 200 words with key details as a list",
    successCriteria: "All dates, costs and deadlines included\nReadable on a phone",
  }),

  // ── Writer
  T("writer", "scripts", "wr-short", "Short-form video script", {
    taskType: "Writing / content",
    objective: "Write a 60-second YouTube Short script explaining compound interest.",
    context: "Personal finance channel, 40k subscribers. Best-performing Shorts open with a surprising number.",
    audience: "25–40 year olds starting to invest",
    tone: "Conversational, energetic, clear",
    deliverable: "Script with hook (first 3 seconds), on-screen text cues and a closing line",
    successCriteria: "Under 160 spoken words\nHook in the first sentence\nOne concrete example with numbers",
  }),
  T("writer", "newsletter", "wr-newsletter", "Newsletter issue", {
    taskType: "Writing / content",
    objective: "Write this week's issue of my newsletter on productivity for creatives.",
    context: "Topic: deep work for people with ADHD-friendly routines. Sections: story, idea, tool of the week, question.",
    audience: "Freelance designers and writers",
    tone: "Personal, warm, practical",
    deliverable: "Newsletter issue, 600–800 words, with subject line options",
    successCriteria: "Opens with a personal story\nOne actionable takeaway",
  }),
  T("writer", "articles", "wr-article", "Feature article", {
    taskType: "Writing / content",
    objective: "Write a 1,500-word feature on the rise of community gardens in Australian cities.",
    context: "For a lifestyle magazine. Include perspectives of organisers, councils and residents; I'll supply quotes.",
    audience: "General readers aged 30–60",
    tone: "Vivid, informed, hopeful",
    deliverable: "Feature with headline, standfirst, subheads and placeholders for quotes",
    successCriteria: "Scene-setting opening\nBalanced perspectives",
    rules: [r("Don't fabricate quotes or statistics", "journalistic integrity")],
  }),
  T("writer", "editing", "wr-edit", "Edit and tighten my draft", {
    taskType: "Writing / content",
    objective: "Edit my draft blog post to be tighter and clearer without losing my voice.",
    context: "Paste draft below. It's 1,400 words; target 1,000.",
    tone: "Keep my voice",
    deliverable: "Edited draft plus a short list of the main changes",
    successCriteria: "Within 10% of 1,000 words\nAll key points kept",
  }),

  // ── HR
  T("hr", "jobs", "hr-job-ad", "Job description", {
    taskType: "Writing / content",
    objective: "Write a job ad for a Senior Customer Success Manager.",
    context: "SaaS company, 120 staff, hybrid Melbourne. $125–140k + super. Manages 40 mid-market accounts.",
    audience: "Experienced CSMs",
    tone: "Inclusive, honest, energetic",
    deliverable: "Job ad with about us, role, responsibilities, must-haves, nice-to-haves, benefits",
    successCriteria: "Max 6 must-haves\nGender-neutral language\nSalary included",
  }),
  T("hr", "interviews", "hr-interview-kit", "Structured interview kit", {
    taskType: "Planning & admin",
    objective: "Create a structured interview kit for a Product Designer role.",
    context: "Competencies: craft, collaboration, user empathy, communication. 60-minute interview.",
    deliverable: "Questions per competency with what good/average/poor answers look like and a scoring sheet",
    successCriteria: "Behavioural questions (past behaviour)\nScoring anchors for each question",
  }),
  T("hr", "policies", "hr-policy", "Workplace policy", {
    taskType: "Writing / content",
    objective: "Draft a remote work policy for a 60-person company.",
    context: "Australia-based. Covers eligibility, equipment, WHS, security, expenses, working hours.",
    tone: "Clear, fair, plain English",
    deliverable: "Policy with purpose, scope, sections, and responsibilities",
    successCriteria: "Plain English\nCovers WHS obligations",
    rules: [r("Flag anything needing legal review", "employment law varies by state and award")],
  }),
  T("hr", "onboarding", "hr-onboarding", "30-60-90 onboarding plan", {
    taskType: "Planning & admin",
    objective: "Create a 30-60-90 day onboarding plan for a new Marketing Manager.",
    context: "Reports to Head of Growth. Owns brand and content. Team of 2.",
    deliverable: "Plan with goals, activities, people to meet and success measures per phase",
    successCriteria: "Each phase has measurable outcomes",
  }),

  // ── Analyst
  T("analyst", "research", "an-synthesis", "Interview synthesis", {
    taskType: "Research & analysis",
    objective: "Synthesise 12 customer interview transcripts into key themes and insights.",
    context: "Transcripts pasted below. Research question: why do trial users not convert to paid?",
    audience: "Product and leadership team",
    deliverable: "Themes ranked by frequency and impact, supporting quotes, and recommendations",
    successCriteria: "Every theme backed by 2+ quotes\nSeparates observations from interpretation",
    rules: [r("Quote verbatim only", "paraphrased quotes distort findings")],
  }),
  T("analyst", "data", "an-data", "Analyse a dataset", {
    taskType: "Data / reporting",
    objective: "Analyse our monthly sales CSV and explain what's driving the Q3 decline.",
    context: "Columns: month, region, product, units, revenue, discount. 24 months of data pasted below.",
    deliverable: "Findings with numbers, likely drivers, charts to make, and next analyses",
    successCriteria: "Every claim cites a number\nDistinguishes correlation from causation",
  }),
  T("analyst", "competitive", "an-competitive", "Competitive analysis", {
    taskType: "Research & analysis",
    objective: "Compare our product against 3 competitors for a board briefing.",
    context: "Competitors and our positioning notes below. Focus on pricing, features, target market and momentum.",
    deliverable: "Comparison table, where we win/lose, threats, and recommended moves",
    successCriteria: "Flags any information that may be outdated\nClear recommendations",
  }),
  T("analyst", "surveys", "an-survey", "Survey design", {
    taskType: "Research & analysis",
    objective: "Design a customer satisfaction survey for our mobile app.",
    context: "Want to understand satisfaction drivers and NPS. Max 5 minutes to complete.",
    deliverable: "Survey with question types, answer scales and logic",
    successCriteria: "Under 12 questions\nNo leading or double-barrelled questions",
  }),

  // ── General
  T("general", "planning", "gn-trip", "Plan a trip", {
    taskType: "Planning & admin",
    objective: "Plan a 5-day family trip to Tasmania in January.",
    context: "2 adults, kids aged 7 and 10. Love nature and food, not big on long drives. Budget around A$4,000 excluding flights.",
    deliverable: "Day-by-day itinerary with drive times, activities, food ideas and budget breakdown",
    successCriteria: "No more than 2.5 hours driving per day\nKid-friendly activities each day",
  }),
  T("general", "writing", "gn-complaint", "Write a complaint letter", {
    taskType: "Email / message",
    objective: "Write a complaint to my internet provider about repeated outages.",
    context: "7 outages in 3 weeks, each 2–6 hours. I work from home. Want a credit and a technician visit.",
    tone: "Firm, polite, factual",
    deliverable: "Email with clear timeline and requested resolution",
    successCriteria: "Includes dates and durations\nStates a specific resolution and deadline",
  }),
  T("general", "learning", "gn-learn", "Learn a new skill", {
    taskType: "Study & learning",
    objective: "Create a 4-week plan to learn the basics of investing in ETFs.",
    context: "Complete beginner in Australia, 30 minutes a day.",
    deliverable: "Week-by-week learning plan with daily topics, free resources and a practice exercise each week",
    successCriteria: "Builds from basics to practical steps",
    rules: [r("No personal financial advice or specific fund picks", "general information only")],
  }),
  T("general", "decisions", "gn-decision", "Make a decision", {
    taskType: "Product / strategy",
    objective: "Help me decide between two job offers.",
    context: "Offer A: higher salary, long commute, big company. Offer B: startup, equity, remote. Details below.",
    deliverable: "Weighted comparison, questions I should ask each employer, and a recommendation framework",
    successCriteria: "Asks me to weight what matters\nCovers risks of each",
  }),
];

// Developer templates reuse the engineering examples.
const DEV_GOAL: Record<string, string> = {
  "Build a feature": "build",
  "Fix a bug": "debug",
  "Refactor / migrate": "refactor",
  "Code review / audit": "review",
  "Architecture / design": "architecture",
};
for (const ex of EXAMPLES) {
  const goal = ex.brief.target === "api-system" ? "api" : DEV_GOAL[ex.brief.taskType];
  if (goal) TEMPLATES.push({ id: `dev-${ex.id}`, persona: "developer", goal, name: ex.name, brief: ex.brief });
}

/** Templates for this profile, goal matches first. */
export function templatesFor(p: Profile | null): Template[] {
  if (!p) return TEMPLATES.filter((t) => t.persona === "general");
  const own = TEMPLATES.filter((t) => t.persona === p.persona);
  const goals = new Set(p.goals);
  return [...own.filter((t) => goals.has(t.goal)), ...own.filter((t) => !goals.has(t.goal))];
}

/** Turn a template into a full brief, applying the user's tool as the target (unless the template is target-specific). */
export function templateBrief(t: Template, p: Profile | null): Brief {
  const base: Brief = {
    ...EMPTY_BRIEF,
    ...t.brief,
    rules: t.brief.rules?.length ? t.brief.rules : [{ rule: "", why: "" }],
    extensions: { ...EMPTY_BRIEF.extensions, ...(t.brief.extensions ?? {}) },
  };
  if (t.persona === "developer") return base;
  const target = p ? targetFor(p.tool) : "chat-llm";
  return {
    ...base,
    target: target === "claude-code" ? "chat-llm" : target, // non-engineering templates never target a coding agent
    // Agentic-only extensions are noise for chat prompts.
    extensions: { ...base.extensions, authorityBoundaries: false, evidence: false, definitionOfDone: false },
  };
}

export const PERSONA_IDS = PERSONAS.map((p) => p.id) as [PersonaId, ...PersonaId[]];
export const TOOL_IDS = TOOLS.map((t) => t.id) as [Tool, ...Tool[]];
