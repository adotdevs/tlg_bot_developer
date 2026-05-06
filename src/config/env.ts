import { z } from "zod";
import "dotenv/config";

const consentEnum = z.enum([
  "NONE",
  "UNKNOWN",
  "GRANTED",
  "EXPLICIT_OPT_IN",
  "REVOKED",
]);

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  ADMIN_API_KEY: z.string().min(8),
  TELEGRAM_BOT_TOKEN: z.string().optional().default(""),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(8),
  PUBLIC_WEBHOOK_BASE_URL: z
    .string()
    .optional()
    .default("")
    .refine((s) => s === "" || z.string().url().safeParse(s).success, {
      message: "PUBLIC_WEBHOOK_BASE_URL must be empty or valid URL",
    }),
  TELEGRAM_WEBHOOK_PATH: z.string().default("/telegram/webhook"),
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  MAX_MESSAGES_PER_MINUTE: z.coerce.number().positive().default(10),
  DAILY_SEND_CAP: z.coerce.number().positive().default(100),
  PER_LEAD_COOLDOWN_HOURS: z.coerce.number().positive().default(24),
  MAX_LEAD_ATTEMPTS: z.coerce.number().positive().default(2),
  FAILURE_RATE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.35),
  CIRCUIT_WINDOW_SECONDS: z.coerce.number().positive().default(300),
  TELEGRAM_ERROR_SPIKE_THRESHOLD: z.coerce.number().positive().default(20),
  ALLOWED_CONSENT_STATUSES: z
    .string()
    .default("GRANTED,EXPLICIT_OPT_IN")
    .transform((s) =>
      s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean) as z.infer<typeof consentEnum>[]
    )
    .pipe(z.array(consentEnum).min(1)),
  SENDER_NAME: z.string().default("Alex"),
  SENDER_COMPANY: z.string().default("Your Company"),
  OUTREACH_TEMPLATE: z
    .string()
    .default(
      "Hi {{name}}, this is {{sender_name}} from {{company}}. Just wanted to quickly check if you'd be open to a short call about something that might be relevant to you?"
    ),
  SALES_WEBHOOK_URL: z
    .string()
    .optional()
    .default("")
    .refine((s) => s === "" || z.string().url().safeParse(s).success, {
      message: "SALES_WEBHOOK_URL must be empty or valid URL",
    }),
  USE_OPENAI_PERSONALIZATION: z
    .preprocess(
      (v) => (v === "" || v === undefined ? "true" : v),
      z.enum(["true", "false"])
    )
    .transform((v) => v === "true"),
  USE_OPENAI_CLASSIFICATION: z
    .preprocess(
      (v) => (v === "" || v === undefined ? "true" : v),
      z.enum(["true", "false"])
    )
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment:", parsed.error.flatten());
    throw new Error("Invalid environment configuration");
  }
  cached = parsed.data;
  return cached;
}

export function resetEnvCache(): void {
  cached = null;
}
