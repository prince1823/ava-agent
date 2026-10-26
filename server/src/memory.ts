import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "https://ava-agent.app",
    "X-Title": "Ava Memory Agent",
  },
});

const MODEL = process.env.MEMORY_MODEL ?? process.env.AGENT_MODEL ?? "openai/gpt-4o-mini";
const MAX_CHARS = 40_000;
const MAX_MESSAGE_CHARS = 600;

export interface MemoryMessage {
  role: "user" | "assistant";
  text: string;
  at: string;
}

export interface UserProfile {
  about: {
    name: string | null;
    location: string | null;
    occupation: string | null;
    education: string | null;
    languages: string[];
  };
  preferences: string[];
  dietary_and_health: string[];
  routines: string[];
  people: Array<{ name: string; relationship: string | null; note: string | null }>;
  interests: string[];
  goals: string[];
  recurring_requests: string[];
  communication_style: string | null;
  behavior_patterns: string[];
  updated_at: string;
}

const SYSTEM_PROMPT = `You are the memory agent inside a personal assistant app called Ava. Your only job is to maintain an accurate, minimal profile of the USER from their chat history.

Rules:
- Record only what the USER said about themselves, or what their own requests clearly demonstrate. Assistant messages are context only — never treat an assistant statement as a fact about the user.
- Never invent or guess. If something is unknown, use null or an empty array.
- Do NOT infer sensitive traits (health conditions, religion, politics, sexuality, finances, immigration status) unless the user stated them explicitly. Diet and food preferences the user stated are fine.
- You are given the EXISTING profile (may be empty). Keep existing facts unless newer messages contradict or retract them; then update or remove them. Merge duplicates. Keep every entry short (under 12 words) and written as a natural plain-English phrase (e.g. "brother calls every Sunday evening"). Never copy snake_case keys or raw "key: value" text from the facts list; rewrite them as sentences, and put each fact in the section where it belongs (people, routines, interests...).
- "recurring_requests" = things the user repeatedly asks the assistant to do. "behavior_patterns" = observable habits (e.g. "usually schedules things in the evening"). Only include a pattern if the messages actually support it.
- "communication_style" = one short phrase on how the user writes (e.g. "short, casual, informal English").
- "people" = people the user mentioned by name, with their relationship if stated.

Return ONLY a JSON object with exactly this shape:
{
  "about": { "name": string|null, "location": string|null, "occupation": string|null, "education": string|null, "languages": string[] },
  "preferences": string[],
  "dietary_and_health": string[],
  "routines": string[],
  "people": [ { "name": string, "relationship": string|null, "note": string|null } ],
  "interests": string[],
  "goals": string[],
  "recurring_requests": string[],
  "communication_style": string|null,
  "behavior_patterns": string[]
}`;

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()) : [];
}
function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function normalize(raw: any): UserProfile {
  const about = raw?.about ?? {};
  return {
    about: {
      name: strOrNull(about.name),
      location: strOrNull(about.location),
      occupation: strOrNull(about.occupation),
      education: strOrNull(about.education),
      languages: strArr(about.languages),
    },
    preferences: strArr(raw?.preferences),
    dietary_and_health: strArr(raw?.dietary_and_health),
    routines: strArr(raw?.routines),
    people: Array.isArray(raw?.people)
      ? raw.people
          .filter((p: any) => p && typeof p.name === "string" && p.name.trim())
          .map((p: any) => ({ name: p.name.trim(), relationship: strOrNull(p.relationship), note: strOrNull(p.note) }))
      : [],
    interests: strArr(raw?.interests),
    goals: strArr(raw?.goals),
    recurring_requests: strArr(raw?.recurring_requests),
    communication_style: strOrNull(raw?.communication_style),
    behavior_patterns: strArr(raw?.behavior_patterns),
    updated_at: new Date().toISOString(),
  };
}

function parseJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new Error("Memory agent returned invalid JSON");
  }
}

export async function extractProfile(
  messages: MemoryMessage[],
  existing: unknown,
  facts: Array<{ key: string; value: string }>
): Promise<UserProfile> {
  // Keep the newest messages that fit in the budget.
  const kept: string[] = [];
  let used = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const line = `[${m.at}] ${m.role.toUpperCase()}: ${String(m.text).slice(0, MAX_MESSAGE_CHARS)}`;
    if (used + line.length > MAX_CHARS) break;
    kept.unshift(line);
    used += line.length;
  }

  const userPrompt = [
    "EXISTING PROFILE:",
    JSON.stringify(existing ?? {}),
    "",
    "FACTS THE USER EXPLICITLY ASKED AVA TO REMEMBER:",
    facts.length ? facts.map((f) => `- ${f.key}: ${f.value}`).join("\n") : "(none)",
    "",
    "CHAT MESSAGES (oldest first):",
    kept.join("\n") || "(none)",
    "",
    "Return the updated profile as JSON.",
  ].join("\n");

  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  const text = completion.choices[0]?.message?.content ?? "";
  return normalize(parseJson(text));
}
