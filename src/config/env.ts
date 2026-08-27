import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  LINKEDIN_EMAIL: z.string().email(),
  LINKEDIN_PASSWORD: z.string().min(1),
  LOGIN_HEADLESS: z
    .string()
    .default("false")
    .transform((v) => v === "true"),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  PORT: z.coerce.number().default(3000),
  API_KEY: z.string().min(8),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().default(20),

  SCRAPE_MIN_DELAY_MS: z.coerce.number().default(4000),
  SCRAPE_MAX_DELAY_MS: z.coerce.number().default(9000),
  CACHE_TTL_HOURS: z.coerce.number().default(72),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
