import type { FastifyReply, FastifyRequest } from "fastify";
import { loadEnv } from "../config/env.js";

export async function adminAuth(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const env = loadEnv();
  const header =
    (req.headers["x-api-key"] as string | undefined) ??
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : undefined);
  if (!header || header !== env.ADMIN_API_KEY) {
    await reply.code(401).send({ error: "unauthorized" });
    return;
  }
}
