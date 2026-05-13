FROM node:20-alpine AS builder

WORKDIR /app
COPY apps/marketplace/package.json apps/marketplace/pnpm-lock.yaml* ./
RUN npm install
COPY apps/marketplace/ .

ARG NEXT_PUBLIC_TG_BOT_USERNAME=BookMasterProBot
ENV NEXT_PUBLIC_TG_BOT_USERNAME=$NEXT_PUBLIC_TG_BOT_USERNAME

RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
