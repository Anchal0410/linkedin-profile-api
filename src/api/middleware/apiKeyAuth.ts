import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../../config/env.js";

export async function apiKeyAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const key = request.headers["x-api-key"];
  if (key !== env.API_KEY) {
    reply.code(401).send({ error: "Missing or invalid x-api-key header" });
  }
}
