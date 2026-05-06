import { loadEnv } from "../config/env.js";
import OpenAI from "openai";

let clientSingleton: OpenAI | null = null;

function getClient(): OpenAI | null {
  const env = loadEnv();
  if (!env.OPENAI_API_KEY) return null;
  if (!clientSingleton) {
    clientSingleton = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return clientSingleton;
}

export type PersonalizeVars = {
  name: string;
  sender_name: string;
  company: string;
  baseText: string;
};

export async function personalizeTemplate(
  vars: PersonalizeVars
): Promise<string> {
  const env = loadEnv();
  if (!env.USE_OPENAI_PERSONALIZATION) return vars.baseText;
  const client = getClient();
  if (!client) return vars.baseText;

  const completion = await client.chat.completions.create({
    model: env.OPENAI_MODEL,
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: `Rewrite the user's outreach message in a friendly, human tone. Rules:
- Maximum 2-3 short lines total.
- Do not add urgency, discounts, or spam phrases.
- Do not change the core ask (short call check-in only).
- Keep the same languages as provided.
- Return ONLY the final message text, no quotes.`,
      },
      {
        role: "user",
        content: `Recipient name: ${vars.name}\nSender: ${vars.sender_name}\nCompany: ${vars.company}\nDraft:\n${vars.baseText}`,
      },
    ],
  });
  const text = completion.choices[0]?.message?.content?.trim();
  return text && text.length > 0 ? text : vars.baseText;
}

export type ClassifyResult = {
  label:
    | "INTERESTED"
    | "NOT_INTERESTED"
    | "NEEDS_INFO"
    | "LATER"
    | "STOP"
    | "UNKNOWN";
  confidence: number;
};

export async function classifyReply(
  inboundText: string,
  context: { recentOutbound?: string }
): Promise<ClassifyResult> {
  const env = loadEnv();
  if (!env.USE_OPENAI_CLASSIFICATION) {
    return { label: "UNKNOWN", confidence: 0 };
  }
  const client = getClient();
  if (!client) return { label: "UNKNOWN", confidence: 0 };

  const completion = await client.chat.completions.create({
    model: env.OPENAI_MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Classify the lead's reply to a polite outreach message about scheduling a short call.
STOP: opt-out requests (stop, unsubscribe, remove me).
INTERESTED: yes, willing to talk, shares availability.
NOT_INTERESTED: clear no.
NEEDS_INFO: questions about offering, pricing, what it's about.
LATER: not now, busy, circle back.
UNKNOWN: ambiguous or off-topic.
Respond with JSON only: {"label":"<one of INTERESTED,NOT_INTERESTED,NEEDS_INFO,LATER,STOP,UNKNOWN>","confidence":0.0-1.0}`,
      },
      {
        role: "user",
        content: JSON.stringify({
          recentOutbound: context.recentOutbound ?? null,
          inboundText,
        }),
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return { label: "UNKNOWN", confidence: 0 };
  try {
    const parsed = JSON.parse(raw) as ClassifyResult;
    if (parsed.confidence < 0 || parsed.confidence > 1) {
      parsed.confidence = Math.min(1, Math.max(0, parsed.confidence));
    }
    const labels: ClassifyResult["label"][] = [
      "INTERESTED",
      "NOT_INTERESTED",
      "NEEDS_INFO",
      "LATER",
      "STOP",
      "UNKNOWN",
    ];
    if (!parsed.label || !labels.includes(parsed.label)) {
      parsed.label = "UNKNOWN";
    }
    return parsed;
  } catch {
    return { label: "UNKNOWN", confidence: 0 };
  }
}

export async function summarizeConversation(
  lines: { direction: "INBOUND" | "OUTBOUND"; content: string }[]
): Promise<string> {
  const env = loadEnv();
  const client = getClient();
  if (!client) {
    return lines
      .slice(-5)
      .map((l) => `${l.direction}: ${l.content}`)
      .join("\n");
  }

  const completion = await client.chat.completions.create({
    model: env.OPENAI_MODEL,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "Summarize this short Telegram thread in 2-3 bullet sentences for a human sales rep. No PII expansion.",
      },
      {
        role: "user",
        content: JSON.stringify(lines),
      },
    ],
  });
  return completion.choices[0]?.message?.content?.trim() ?? "";
}

export async function suggestFollowUp(context: {
  leadName: string;
  inboundQuestion: string;
}): Promise<string> {
  const env = loadEnv();
  const client = getClient();
  const fallback = `Hi ${context.leadName}, happy to clarify — what specific detail would help you decide?`;
  if (!client) return fallback;

  const completion = await client.chat.completions.create({
    model: env.OPENAI_MODEL,
    temperature: 0.4,
    messages: [
      {
        role: "system",
        content: `Write ONE short reply (max 2 lines) answering the lead's question in a helpful, low-pressure way. No scheduling pressure.`,
      },
      {
        role: "user",
        content: JSON.stringify(context),
      },
    ],
  });
  const text = completion.choices[0]?.message?.content?.trim();
  return text && text.length > 0 ? text : fallback;
}
