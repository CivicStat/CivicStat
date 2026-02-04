FROM node:20-slim

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm install --no-frozen-lockfile --prod=false
RUN pnpm --filter @ntp/db prisma:generate
RUN pnpm --filter @ntp/shared build
RUN pnpm --filter @ntp/db build
RUN pnpm --filter @ntp/api build

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "apps/api/dist/main.js"]
