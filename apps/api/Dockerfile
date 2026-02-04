FROM node:20-slim

WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable

COPY . .

RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @ntp/api build

EXPOSE 4000

CMD ["node", "apps/api/dist/main.js"]
