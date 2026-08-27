import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { buildServer } from "./api/server.js";
import { startWorker } from "./queue/runWorker.js";

// Single-process combined entrypoint: API server + scrape worker in one
// service, for deploys limited to one start command (e.g. a single Render
// service). For a two-service deploy, run this and queue/worker.ts
// separately instead — same startWorker() either way, see runWorker.ts.
async function main() {
  const app = await buildServer();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  logger.info(`API listening on :${env.PORT}`);

  const worker = startWorker();

  const shutdown = async () => {
    await app.close();
    await worker.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.error(err, "API failed to start");
  process.exit(1);
});
