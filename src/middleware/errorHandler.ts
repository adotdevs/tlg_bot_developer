import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

export function registerErrorHandler(app: {
  setErrorHandler: (
    fn: (
      err: FastifyError,
      req: FastifyRequest,
      reply: FastifyReply
    ) => void | Promise<void>
  ) => void;
}): void {
  app.setErrorHandler(async (err, _req, reply) => {
    const status = err.statusCode ?? 500;
    await reply.code(status).send({
      error: err.message,
      ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {}),
    });
  });
}
