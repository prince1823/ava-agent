import OpenAI from "openai";

const PROMPT = `You suggest the next things a user might tap after an assistant's reply, inside a personal-assistant app (Ava) that can read/create calendar events, set reminders, track expenses, look up contacts and text them, remember facts and answer questions.

Return ONLY JSON: {"suggestions": ["...", "...", "..."]}
Rules:
- 2 or 3 suggestions, each written from the USER's point of view as something they would say to the assistant (e.g. "Remind me 30 minutes before", "Show this week's spending").
- Max 6 words each, no trailing punctuation, no emojis, no duplicates.
- They must be genuinely useful follow-ups to THIS exchange and something the assistant can actually do.
- If the exchange is a greeting, an error, or has no sensible follow-up, return {"suggestions": []}.`;

export async function followUps(
  userText: string,
  assistantText: string,
  config: { apiKey: string; model: string }
): Promise<string[]> {
  if (!assistantText.trim() || assistantText.length < 8) return [];

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: { "HTTP-Referer": "https://ava-agent.app", "X-Title": "Ava Suggestions" },
  });

  const completion = await client.chat.completions.create({
    model: config.model,
    temperature: 0.4,
    max_tokens: 120,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: PROMPT },
      { role: "user", content: `USER: ${userText.slice(0, 500)}\n\nASSISTANT: ${assistantText.slice(0, 1200)}` },
    ],
  });
  try {
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    const items: unknown = parsed.suggestions;
    if (!Array.isArray(items)) return [];
    return items
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0 && s.length <= 60)
      .map((s) => s.trim())
      .slice(0, 3);
  } catch {
    return [];
  }
}
