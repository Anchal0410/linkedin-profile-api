# Playwright's own image ships matching Chromium + OS deps, which is the
# fiddly part of running a headless browser in a container. Tag must match
# the "playwright" npm version resolved below, or Playwright refuses to
# launch (browser binary version mismatch) — check with
# `node -e "console.log(require('./node_modules/playwright/package.json').version)"`
# after any `npm install`/`npm update` and bump this tag to match.
FROM mcr.microsoft.com/playwright:v1.62.1-jammy

WORKDIR /app

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
