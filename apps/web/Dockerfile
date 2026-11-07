# HatLock Business Admin Web Dashboard Dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

RUN npm ci

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
COPY tsconfig.json ./

ENV NEXT_TELEMETRY_DISABLED=1
RUN cd apps/web && npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

RUN npm ci --omit=dev

COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/.next ./apps/web/.next

EXPOSE 3000

CMD ["npm", "--prefix", "apps/web", "run", "start"]
