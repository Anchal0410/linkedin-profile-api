#!/bin/sh
# Single entrypoint so platform "start command" fields (Render etc.) never
# need to parse shell operators like && — some don't (see README).
set -e
npx prisma migrate deploy
exec node dist/index.js
