import type { ClassificationLabel } from "@prisma/client";
import { classifyReply, type ClassifyResult } from "./OpenAIService.js";

export function mapLabelToPrisma(l: ClassifyResult["label"]): ClassificationLabel {
  switch (l) {
    case "INTERESTED":
      return "INTERESTED";
    case "NOT_INTERESTED":
      return "NOT_INTERESTED";
    case "NEEDS_INFO":
      return "NEEDS_INFO";
    case "LATER":
      return "LATER";
    case "STOP":
      return "STOP";
    default:
      return "UNKNOWN";
  }
}

export async function classifyInbound(
  text: string,
  recentOutbound?: string
): Promise<{ label: ClassificationLabel; confidence: number; raw: ClassifyResult }> {
  const raw = await classifyReply(text, { recentOutbound });
  return {
    label: mapLabelToPrisma(raw.label),
    confidence: raw.confidence,
    raw,
  };
}
