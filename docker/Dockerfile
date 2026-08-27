# No browser in the deployed image on purpose — the runtime scrape path is
# plain HTTP (see src/scraper/http/), not Playwright. The browser only ever
# runs locally, interactively, for `npm run login`.
FROM node:20-slim

WORKDIR /app

# Prisma's query engine needs OpenSSL present; skip Playwright's own
# postinstall browser download since "playwright" stays a runtime
# dependency only for login.ts's types/imports, never launched here.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

COPY docker/start.sh ./start.sh
RUN chmod +x ./start.sh

ENV NODE_ENV=production
EXPOSE 3000

# Runs migrate deploy then the combined server+worker — see start.sh. Leave
# any platform's "start command" override field blank/default so it uses
# this instead of re-typing shell syntax that field may not parse correctly.
CMD ["./start.sh"]
