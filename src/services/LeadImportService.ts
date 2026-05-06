import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { prisma } from "../db/client.js";
import { OutreachStatus } from "@prisma/client";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import {
  normalizeRow,
  type LeadRowInput,
} from "./LeadValidationService.js";
import { auditLog } from "./AuditLogService.js";

export type ImportSummary = {
  created: number;
  rejected: { row: number; errors: string[] }[];
};

function normalizePhone(raw?: string): string | undefined {
  if (!raw?.trim()) return undefined;
  const p = parsePhoneNumberFromString(raw.trim());
  if (p?.isValid()) return p.number;
  return raw.trim();
}

export async function importLeadsFromRows(
  rows: Record<string, unknown>[]
): Promise<ImportSummary> {
  const rejected: ImportSummary["rejected"] = [];
  const valid: LeadRowInput[] = [];
  let idx = 1;
  for (const row of rows) {
    const n = normalizeRow(row, idx);
    if (!n.ok) rejected.push({ row: n.row, errors: n.errors });
    else valid.push(n.data);
    idx += 1;
  }

  let created = 0;
  if (valid.length) {
    await prisma.$transaction(
      valid.map((r) => {
        const telegramRaw =
          r.telegram_id != null ? String(r.telegram_id).trim() : "";
        const outreach: OutreachStatus =
          r.outreach_status ?? (telegramRaw ? "PENDING" : "UNMATCHED");
        return prisma.lead.create({
          data: {
            fullName: r.full_name,
            phone: normalizePhone(
              r.phone_number != null ? String(r.phone_number) : undefined
            ),
            email: r.email,
            company: r.company_name,
            notes: r.notes,
            source: r.source,
            consentStatus: r.consent_status,
            telegramId: telegramRaw || null,
            outreachStatus: outreach,
          },
        });
      })
    );
    created = valid.length;
  }

  await auditLog("lead_import", `Imported ${created} leads`, {
    created,
    rejected: rejected.length,
  });

  return { created, rejected };
}

export async function parseCsvBuffer(buf: Buffer): Promise<Record<string, unknown>[]> {
  const text = buf.toString("utf8");
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, unknown>[];
  return records;
}

export async function parseXlsxBuffer(buf: Buffer): Promise<Record<string, unknown>[]> {
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });
  return rows;
}

export async function parseJsonBuffer(buf: Buffer): Promise<Record<string, unknown>[]> {
  const j = JSON.parse(buf.toString("utf8")) as unknown;
  if (Array.isArray(j)) return j as Record<string, unknown>[];
  if (j && typeof j === "object" && "leads" in j && Array.isArray((j as { leads: unknown }).leads)) {
    return (j as { leads: Record<string, unknown>[] }).leads;
  }
  throw new Error("JSON must be an array of lead objects or { leads: [...] }");
}
