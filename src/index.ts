import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { buildServer } from "./api/server.js";

async function main() {
  const app = await buildServer();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  logger.info(`API listening on :${env.PORT}`);
}

main().catch((err) => {
  logger.error(err, "API failed to start");
  process.exit(1);
});
