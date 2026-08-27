# LinkedIn Profile API

Accepts a LinkedIn profile URL and returns structured JSON, using a real
logged-in LinkedIn session's cookies against a plain HTTP request — no
browser automation at request time (see [Approach](#approach)). Currently
returns name, headline, location, and profile/banner images reliably;
about/experience/education/skills/certifications/languages are a documented
gap, not a silent one — see [Known limitations](#known-limitations).

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
                 -> plain HTTP GET of the profile page + HTML parse
                 -> normalize -> cache write
```

**No browser at runtime.** The only place a browser (Playwright) touches
this system is the one-time, interactive `npm run login` — LinkedIn's login
UI and checkpoint challenge genuinely need a real browser to solve, and
there's no way around that. Every actual profile *scrape* is a plain
`fetch()` reusing that login's session cookies; the deployed Docker image
doesn't even ship Chromium (see `docker/Dockerfile`).

- **Session**: one real login via Playwright (`npm run login`), persisted as
  a Playwright `storageState` (cookies) in Postgres. Not re-logged-in per
  request, and never touched again by the scraping path itself.
- **Fetch**: `GET https://www.linkedin.com/in/{id}/` with the session
  cookies as headers — a plain HTTP request, parsed with regex/string
  matching against known-stable anchors (the `<title>` tag, the contact-info
  overlay link's href) rather than CSS classes, which LinkedIn hashes
  per-build. See [Approach](#approach) for why those anchors specifically.
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
  "source": "http",
  "dataCompleteness": "partial-fields-only",
  "scrapedAt": "2026-08-27T12:00:00.000Z"
}
```

## Approach

Started by trying LinkedIn's internal "Voyager" REST endpoint
(`/voyager/api/identity/profiles/{id}/profileView`) — the classic
scraper target. It's dead: returns `410 Gone` now. Captured real network
traffic from a logged-in session to see what actually replaced it, and
found LinkedIn has moved to React Server Components — profile content is
now fetched through `flagship-web/rsc-action/actions/component` calls
returning RSC wire format, and a unified `/voyager/api/graphql` endpoint
keyed by internal member URNs rather than the public profile slug. Neither
is a simple REST-JSON call to replicate.

What *is* still simple: name, headline, location, and profile/banner images
are server-rendered directly into the initial page HTML — confirmed by
diffing a plain `fetch()` of the profile URL against what a real browser
renders, byte for byte the same content. So the actual approach is: fetch
that HTML with the session cookies, extract those fields from anchors
LinkedIn can't easily obfuscate without breaking the page itself — the
`<title>Name | LinkedIn</title>` tag for the name, its immediate DOM
neighbor for the headline, and the fixed `/overlay/contact-info/` link's
preceding siblings for location. Verified against two independent real
profiles (the account owner's own, and a public third party), plus
negative-tested against a nonexistent profile identifier to confirm the
not-found detection doesn't false-positive on real ones.

About/experience/education/skills/certifications/languages load through
those RSC endpoints and aren't cracked — see limitations below rather than
a silent guess dressed up as a real value.

## Known limitations

- **ToS/legal risk** — see the warning above; not a technical limitation,
  a real one.
- **Account ban risk** — the scraping account will eventually get
  checkpointed or banned; there's no guaranteed way around this short of
  not scraping.
- **About/experience/education/skills/certifications/languages aren't
  fetched at all** — the single biggest gap. These load client-side
  through LinkedIn's React Server Component endpoints, which weren't
  cracked (tried both GET and a naive POST against the likely About card's
  endpoint; both returned `500` — getting further needs the exact request
  payload shape a real browser sends, which needs another dedicated
  capture pass). `dataCompleteness: "partial-fields-only"` says this
  plainly in every response rather than returning an empty array that
  looks like "this person has none."
- **Out-of-network truncation** — separately from the above, LinkedIn also
  restricts what even a fully-working scrape could see for profiles
  outside the account's 1st/2nd/3rd-degree network. Not measured/reflected
  yet since the fields it would affect aren't fetched at all currently.
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
