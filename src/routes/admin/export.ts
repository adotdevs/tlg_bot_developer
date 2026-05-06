import type { FastifyInstance } from "fastify";
import { adminAuth } from "../../middleware/adminAuth.js";
import { prisma } from "../../db/client.js";
import type { Lead } from "@prisma/client";

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function adminExportRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", adminAuth);

  app.get("/export/leads.csv", async (_req, reply) => {
    const leads = await prisma.lead.findMany({ orderBy: { createdAt: "desc" } });
    const header = [
 "id",
 "full_name",
 "phone",
 "email",
 "company",
 "notes",
 "source",
 "consent_status",
 "telegram_id",
 "outreach_status",
 "opted_out",
 "last_contacted_at",
 "attempt_count",
 "followup_used",
 "assigned_to",
 "created_at",
    ];
    const lines = [
      header.join(","),
      ...leads.map((l: Lead) =>
        [
          l.id,
          l.fullName,
          l.phone ?? "",
          l.email ?? "",
          l.company ?? "",
          l.notes ?? "",
          l.source,
          l.consentStatus,
          l.telegramId ?? "",
          l.outreachStatus,
          String(l.optedOut),
          l.lastContactedAt?.toISOString() ?? "",
          String(l.attemptCount),
          String(l.followupUsed),
          l.assignedTo ?? "",
          l.createdAt.toISOString(),
        ]
          .map((x) => csvEscape(String(x)))
          .join(",")
      ),
    ];
    await reply
      .header("Content-Type", "text/csv")
      .send(lines.join("\n"));
  });
}
