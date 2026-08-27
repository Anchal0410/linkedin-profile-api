// Standalone worker process — for a two-service deploy (separate API +
// worker). For a single-service deploy, index.ts starts this same worker
// in-process instead; see startWorker() in runWorker.ts.
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { startWorker } from "./runWorker.js";

const worker = startWorker();

const shutdown = async () => {
  await worker.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

void env; // ensures env is validated at startup even though unused directly here
