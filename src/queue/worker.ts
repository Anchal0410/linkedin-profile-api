// Standalone worker process — for a two-service deploy (separate API +
// worker). For a single-service deploy, index.ts starts this same worker
// in-process instead; see startWorker() in runWorker.ts.
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { startWorker } from "./runWorker.js";

async function main() {
  const { worker, browser } = await startWorker();

  const shutdown = async () => {
    await worker.close();
    await browser.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.error(err, "Worker crashed on startup");
  process.exit(1);
});

void env; // ensures env is validated at startup even though unused directly here
