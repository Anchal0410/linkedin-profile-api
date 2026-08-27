import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parsePublicIdentifier } from "../../utils/parseLinkedInUrl.js";
import { getCachedProfile } from "../../cache/profileCache.js";
import { scrapeQueue } from "../../queue/queue.js";
import { apiKeyAuth } from "../middleware/apiKeyAuth.js";

const RequestBodySchema = z.object({ url: z.string().min(1) });

export async function profileRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", apiKeyAuth);

  // Kicks off (or reuses a cached) scrape. Returns the profile directly on
  // a cache hit, otherwise 202 + a jobId to poll — a real browser scrape
  // takes seconds, so this is never a synchronous 200 on a miss.
  app.post("/v1/profile", async (request, reply) => {
    const body = RequestBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "Body must be { url: string }" });
    }

    let publicIdentifier: string;
    try {
      publicIdentifier = parsePublicIdentifier(body.data.url);
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
    }

    const cached = await getCachedProfile(publicIdentifier);
    if (cached) return reply.code(200).send(cached);

    const job = await scrapeQueue.add("scrape", { publicIdentifier });
    return reply.code(202).send({ jobId: job.id, publicIdentifier, status: "queued" });
  });

  app.get("/v1/jobs/:jobId", async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const job = await scrapeQueue.getJob(jobId);
    if (!job) return reply.code(404).send({ error: "Unknown jobId" });

    const state = await job.getState();
    if (state === "completed") {
      const profile = await getCachedProfile(job.data.publicIdentifier);
      return reply.send({ status: "completed", profile });
    }
    if (state === "failed") {
      return reply.code(200).send({ status: "failed", reason: job.failedReason });
    }
    return reply.send({ status: state });
  });

  app.get("/v1/profile/:publicIdentifier", async (request, reply) => {
    const { publicIdentifier } = request.params as { publicIdentifier: string };
    const cached = await getCachedProfile(publicIdentifier);
    if (!cached) return reply.code(404).send({ error: "Not cached — POST /v1/profile first" });
    return reply.send(cached);
  });
}
