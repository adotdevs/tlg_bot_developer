import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client.js";
import { adminAuth } from "../../middleware/adminAuth.js";
import {
  importLeadsFromRows,
  parseCsvBuffer,
  parseJsonBuffer,
  parseXlsxBuffer,
} from "../../services/LeadImportService.js";
import { enqueueOutreachJob } from "../../services/QueueService.js";
import { getRedisConnection } from "../../queues/connection.js";
import {
  ConsentStatus,
  OutreachStatus,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";

export async function adminLeadRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", adminAuth);

  app.post("/leads/upload", async (req, reply) => {
    const mp = await req.file();
    if (!mp) {
      await reply.code(400).send({ error: "file required" });
      return;
    }
    const buf = await mp.toBuffer();
    const name = mp.filename.toLowerCase();
    let rows: Record<string, unknown>[];
    try {
      if (name.endsWith(".csv")) rows = await parseCsvBuffer(buf);
      else if (name.endsWith(".xlsx")) rows = await parseXlsxBuffer(buf);
      else if (name.endsWith(".json")) rows = await parseJsonBuffer(buf);
      else {
        await reply.code(400).send({ error: "use csv, xlsx, or json" });
        return;
      }
    } catch (e) {
      await reply
        .code(400)
        .send({ error: e instanceof Error ? e.message : "parse failed" });
      return;
    }
    const summary = await importLeadsFromRows(rows);
    return summary;
  });

  app.get("/leads", async (req) => {
    const q = req.query as {
      outreachStatus?: OutreachStatus;
      consentStatus?: ConsentStatus;
      page?: string;
      pageSize?: string;
    };
    const page = Math.max(1, Number(q.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(q.pageSize ?? 20)));
    const where: Prisma.LeadWhereInput = {};
    if (q.outreachStatus) where.outreachStatus = q.outreachStatus;
    if (q.consentStatus) where.consentStatus = q.consentStatus;
    const [items, total] = await prisma.$transaction([
      prisma.lead.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.lead.count({ where }),
    ]);
    return { items, total, page, pageSize };
  });

  app.get("/leads/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      await reply.code(404).send({ error: "not found" });
      return;
    }
    return lead;
  });

  app.patch("/leads/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Partial<{
      outreachStatus: OutreachStatus;
      optedOut: boolean;
      telegramId: string | null;
      consentStatus: ConsentStatus;
      notes: string;
    }>;

    const data: {
      outreachStatus?: OutreachStatus;
      optedOut?: boolean;
      telegramId?: string | null;
      consentStatus?: ConsentStatus;
      notes?: string;
    } = {};

    if (body.outreachStatus !== undefined)
      data.outreachStatus = body.outreachStatus;
    if (body.optedOut !== undefined) data.optedOut = body.optedOut;
    if ("telegramId" in body) data.telegramId = body.telegramId;
    if (body.consentStatus !== undefined)
      data.consentStatus = body.consentStatus;
    if (body.notes !== undefined) data.notes = body.notes;

    if (Object.keys(data).length === 0) {
      await reply.code(400).send({ error: "no updatable fields" });
      return;
    }

    try {
      const lead = await prisma.lead.update({
        where: { id },
        data,
      });
      return lead;
    } catch {
      await reply.code(404).send({ error: "not found" });
    }
  });

  app.post("/leads/:id/enqueue", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { kind?: "initial" | "followup" };
    const kind = body.kind ?? "initial";
    const redis = getRedisConnection();
    const r = await enqueueOutreachJob(redis, id, kind);
    if (!r.ok) {
      const code = r.reason === "system_paused" ? 503 : 400;
      await reply.code(code).send({ error: r.reason });
      return;
    }
    return { jobId: r.jobId };
  });
}
