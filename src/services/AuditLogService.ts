import type { Prisma } from "@prisma/client";
import { prisma } from "../db/client.js";

export async function auditLog(
  type: string,
  message: string,
  metadata?: Prisma.InputJsonValue
): Promise<void> {
  await prisma.auditLog.create({
    data: { type, message, metadata: metadata ?? undefined },
  });
}
