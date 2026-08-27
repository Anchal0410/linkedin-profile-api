# LinkedIn Profile API

Accepts a LinkedIn profile URL and returns structured JSON (name, headline,
location, about, experience, education, skills, certifications, languages,
profile/banner images) by driving a real logged-in LinkedIn session.

## ⚠️ Before you use this

This works by logging into LinkedIn with a real account and pulling data
from pages/endpoints that account can see — which is exactly what
[LinkedIn's User Agreement §8.2](https://www.linkedin.com/legal/user-agreement)
prohibits ("no scraping, no automated data collection"). This isn't a gray
area courts haven't looked at:

- **hiQ Labs v. LinkedIn** ended with LinkedIn winning on breach-of-contract
  grounds — scraping *public* data isn't a CFAA violation, but it's still a
  ToS breach LinkedIn can sue over.
- **LinkedIn v. Nubela (2026)** — LinkedIn is actively suing scraper-API
  vendors this year for exactly this category of product.

Practical consequence: the account used here **will eventually get rate
limited, checkpointed, or banned**, and running this as a public,
always-on, resellable service is the part that draws legal action, not
personal/portfolio use. This repo was built for **testing/demo purposes
with the author's own LinkedIn account**, not deployed as a public data
product. Use accordingly.

## Architecture

```
Client -> Fastify API (API-key auth, rate limit)
            -> cache check (Postgres)
            -> BullMQ job queue (Redis)
                 -> account pool (checks out a session, paces requests)
                 -> Voyager internal API (fast path)
                    -> falls back to Playwright DOM scrape on block/challenge
                 -> normalize -> cache write
```

- **Session**: one real login via Playwright (`npm run login`), persisted as
  a Playwright `storageState` (cookies) in Postgres. Not re-logged-in per
  request.
- **Fetch — primary**: calls LinkedIn's internal "Voyager" API
  (`/voyager/api/identity/profiles/{id}/profileView`) directly with the
  session cookies. Fast, structured JSON, but brittle — LinkedIn changes
  this response shape across releases without notice.
- **Fetch — fallback**: renders the real profile page in a headless browser
  and reads it via accessible-role/section-id locators (more resilient to
  LinkedIn's rotating CSS class names than a class-selector scraper, but
  slower).
- **Account pool**: built to hold N accounts (`Account` table, `status`:
  `active`/`quarantined`/`dead`), each with its own paced sub-queue and a
  sticky proxy slot. Only one account is actually configured/used in this
  testing setup — see [Known limitations](#known-limitations).
- **Cache**: profile responses cached in Postgres for `CACHE_TTL_HOURS`
  (default 72h) so repeat lookups don't re-hit LinkedIn.
- **Queue**: BullMQ with `concurrency: 1` — one LinkedIn session in flight
  at a time, deliberately, to avoid looking like a bot hammering the site.

## Setup

Requirements: Node 20+, Docker (for Postgres/Redis), a LinkedIn account.

```bash
npm install
npx playwright install chromium
cp .env.example .env   # fill in LINKEDIN_EMAIL / LINKEDIN_PASSWORD / API_KEY

docker compose -f docker/docker-compose.yml up -d postgres redis
npx prisma migrate dev --name init

# LOGIN_HEADLESS=false in .env for this first run — LinkedIn will very
# likely show a checkpoint/verification-code prompt for a new device/IP,
# and only you can clear that.
npm run login

npm run dev   # API server + worker run together in one process
```

`npm run dev` (→ `src/index.ts`) starts the API server and the scrape
worker together in one process — one command, matching a deploy that only
allows a single start command (e.g. one Render service). `queue/worker.ts`
is a separate standalone worker-only entrypoint sharing the same
`startWorker()`, kept for a two-service deploy — don't run both at once
against the same `REDIS_URL`, or you get two concurrent LinkedIn sessions
fighting over one account instead of one paced session.

## API

All endpoints require `x-api-key: <API_KEY from .env>`.

### `POST /v1/profile`
```json
{ "url": "https://www.linkedin.com/in/some-person/" }
```
- `200` — cache hit, returns the profile immediately.
- `202` — cache miss, queued: `{ "jobId": "...", "publicIdentifier": "...", "status": "queued" }`.

### `GET /v1/jobs/:jobId`
Poll until `status` is `completed` (body includes `profile`) or `failed`.

### `GET /v1/profile/:publicIdentifier`
Cache-only read; `404` if nothing cached yet for that identifier.

### Response schema
```jsonc
{
  "publicIdentifier": "jane-doe-123abc",
  "name": "Jane Doe",
  "headline": "...",
  "location": "...",
  "about": "...",
  "profileImageUrl": "...",
  "bannerImageUrl": "...",
  "experience": [{ "title": "", "company": "", "employmentType": "", "location": "", "dateRange": "", "description": "" }],
  "education": [{ "school": "", "degree": "", "field": "", "dateRange": "", "description": "" }],
  "skills": ["..."],
  "certifications": [{ "name": "", "issuer": "", "date": "" }],
  "languages": [{ "name": "", "proficiency": "" }],
  "source": "voyager | dom",
  "dataCompleteness": "full | limited-out-of-network",
  "scrapedAt": "2026-08-27T12:00:00.000Z"
}
```

## Approach

Built the Voyager path first because it returns clean structured JSON when
it works — but LinkedIn's profile page as of this build is a **server-driven
UI**: section containers get dynamically-generated URN-based ids
(`com.linkedin.sdui.profile.card.ref<urn>About`, etc.), not stable
classes/ids, and cards hydrate asynchronously after initial page load. That
combination is what makes both the internal API shape and any
CSS-selector-based scraper fragile. Voyager falls back to DOM-rendering when
blocked; the DOM path itself is heading-anchored (find the section by its
*visible text*, e.g. "About", "Experience" — the one thing LinkedIn hasn't
obfuscated) plus positional text parsing, rather than id/class selectors,
since those don't exist to select against anymore.

This was verified against a real logged-in session during development, not
left as an untested guess — see limitations below for exactly what that
verification did and didn't cover.

## Known limitations

- **ToS/legal risk** — see the warning above; not a technical limitation,
  a real one.
- **Account ban risk** — the scraping account will eventually get
  checkpointed or banned; there's no guaranteed way around this short of
  not scraping.
- **Out-of-network truncation** — LinkedIn returns partial data (no
  experience/education detail) for profiles outside the scraping account's
  1st/2nd/3rd-degree network, regardless of technique. Reflected in
  `dataCompleteness`, not fixable by scraping harder.
- **Experience/Education/Certifications/Languages list-splitting is
  unverified** — the topcard (name/headline/location), About, and both
  profile/banner images were verified end-to-end against a real profile.
  The list sections use the same heading-anchored approach but were built
  against a profile that doesn't have them populated, so the
  blob-into-entries splitting (`domScraper.ts`'s `extractListSection`) is
  a best-effort guess at how multiple entries are text-delimited, not a
  confirmed one. Test against a profile with a filled-in Experience section
  and expect to adjust the split logic.
- **SDUI card hydration timing** — sections mount asynchronously; the
  scraper waits for each heading to appear (bounded, ~4s) rather than
  trusting a fixed page-load delay, but a slow connection could still race
  this on a section that takes longer than that to hydrate.
- **No CAPTCHA/2FA solving** — `npm run login` needs a human present the
  first time (and again after any checkpoint, wherever in the flow it
  appears); it doesn't attempt to automate past that.
- **Single-account throughput ceiling** — one session, serialized
  (`concurrency: 1`), paced with jittered delays. The `Account`/pool
  plumbing supports more, but no second account or proxy is wired up in
  this build.
- **Plaintext session storage** — `Account.cookieJson` is stored
  unencrypted in the local Postgres instance. Fine for a local/testing
  deployment with your own account; not something to carry into a
  multi-tenant or public deployment as-is.
