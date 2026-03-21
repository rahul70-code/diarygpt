import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are DairyGPT, a compassionate and insightful AI journal companion.
Your role is to:
- Help users reflect on their diary entries with empathy and thoughtfulness
- Identify emotional patterns, themes, and growth over time
- Ask meaningful follow-up questions to deepen self-reflection
- Provide gentle insights without being prescriptive
- Celebrate progress and offer perspective during difficult moments
Keep responses warm, concise, and encouraging.`;

/**
 * Analyze a single diary entry — returns mood, themes, and a brief reflection.
 */
export async function analyzeEntry(entryText) {
  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Please analyze this diary entry and return a JSON object with:
- mood: (one of: happy, sad, anxious, calm, excited, angry, reflective, mixed)
- themes: array of key themes (max 3)
- reflection: a brief empathetic response (2-3 sentences)
- followUpQuestion: one thoughtful question to deepen reflection

Diary entry:
"${entryText}"

Respond with valid JSON only.`,
      },
    ],
  });

  const text = response.content.find((b) => b.type === "text")?.text ?? "{}";
  return JSON.parse(text);
}

/**
 * Multi-turn chat about the user's diary entries.
 * @param {Array<{role: string, content: string}>} history - conversation history
 * @param {string} userMessage - latest user message
 * @param {string} [context] - optional diary context to inject
 */
export async function chat(history, userMessage, context = "") {
  const messages = [
    ...history,
    { role: "user", content: userMessage },
  ];

  const systemWithContext = context
    ? `${SYSTEM_PROMPT}\n\nUser's recent diary context:\n${context}`
    : SYSTEM_PROMPT;

  const stream = client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    system: systemWithContext,
    messages,
  });

  return stream;
}
