import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { healthRoutes } from "./routes/health.js";
import { profileRoutes } from "./routes/profile.js";

export async function buildServer() {
  const app = Fastify({ logger });

  await app.register(rateLimit, {
    max: env.RATE_LIMIT_PER_MINUTE,
    timeWindow: "1 minute",
    keyGenerator: (request) => (request.headers["x-api-key"] as string) ?? request.ip,
  });

  await app.register(healthRoutes);
  await app.register(profileRoutes);

  return app;
}
