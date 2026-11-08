# HatLock Business Admin Web Dashboard Dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

# Copy all package manifests for monorepo workspace resolution
COPY package.json package-lock.json* ./
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
COPY packages/hatpesa/package.json ./packages/hatpesa/
COPY packages/sonicpesa/package.json ./packages/sonicpesa/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/customer-portal/package.json ./apps/customer-portal/

RUN npm ci

COPY packages/ ./packages/
COPY apps/web ./apps/web
COPY tsconfig.json ./

ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL=https://api.luxeenet.com
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN cd packages/database && npx prisma generate
RUN cd apps/web && npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3002
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL=https://api.luxeenet.com
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY package.json package-lock.json* ./
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
COPY packages/hatpesa/package.json ./packages/hatpesa/
COPY packages/sonicpesa/package.json ./packages/sonicpesa/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/customer-portal/package.json ./apps/customer-portal/

RUN npm ci --omit=dev

COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/.next ./apps/web/.next

EXPOSE 3002

CMD ["npm", "--prefix", "apps/web", "run", "start"]
