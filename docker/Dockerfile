# Playwright's own image ships matching Chromium + OS deps, which is the
# fiddly part of running a headless browser in a container.
FROM mcr.microsoft.com/playwright:v1.47.0-jammy

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev=false

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/index.js"]
