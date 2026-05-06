import { z } from "zod";
import { ConsentStatus, OutreachStatus } from "@prisma/client";

const consentField = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toUpperCase() : v),
  z.nativeEnum(ConsentStatus)
);

const outreachField = z.preprocess(
  (v) =>
    v === "" || v === undefined
      ? undefined
      : typeof v === "string"
        ? v.trim().toUpperCase()
        : v,
  z.nativeEnum(OutreachStatus).optional()
);

export const leadRowSchema = z.object({
  full_name: z.coerce.string().min(1),
  phone_number: z.coerce.string().optional(),
  email: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().email().optional()
  ),
  company_name: z.string().optional(),
  notes: z.string().optional(),
  source: z.coerce.string().min(1),
  consent_status: consentField,
  telegram_id: z.string().optional(),
  outreach_status: outreachField,
});

export type LeadRowInput = z.infer<typeof leadRowSchema>;

export function normalizeRow(
  raw: Record<string, unknown>,
  rowIndex: number
): { ok: true; data: LeadRowInput } | { ok: false; row: number; errors: string[] } {
  const lowered: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = k.trim().toLowerCase().replace(/\s+/g, "_");
    lowered[key] = typeof v === "string" ? v.trim() : v;
  }
  const alias = (a: string, b: string) => {
    if (lowered[a] === undefined && lowered[b] !== undefined)
      lowered[a] = lowered[b];
  };
  alias("full_name", "name");
  alias("phone_number", "phone");
  alias("company_name", "company");

  const parsed = leadRowSchema.safeParse({
    full_name: lowered.full_name,
    phone_number: lowered.phone_number ?? lowered.phone,
    email: lowered.email,
    company_name: lowered.company_name ?? lowered.company,
    notes: lowered.notes,
    source: lowered.source,
    consent_status: lowered.consent_status,
    telegram_id: lowered.telegram_id,
    outreach_status: lowered.outreach_status,
  });

  if (!parsed.success) {
    return {
      ok: false,
      row: rowIndex,
      errors: parsed.error.errors.map((e) => e.path.join(".") + ": " + e.message),
    };
  }
  const d = parsed.data;
  if (d.email === "") d.email = undefined;
  return { ok: true, data: d };
}
