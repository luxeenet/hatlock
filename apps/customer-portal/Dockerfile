# HatLock Customer Portal Dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/customer-portal/package.json ./apps/customer-portal/

RUN npm ci

COPY packages/shared ./packages/shared
COPY apps/customer-portal ./apps/customer-portal
COPY tsconfig.json ./

ENV NEXT_TELEMETRY_DISABLED=1
RUN cd apps/customer-portal && npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/customer-portal/package.json ./apps/customer-portal/

RUN npm ci --omit=dev

COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/customer-portal/public ./apps/customer-portal/public
COPY --from=builder /app/apps/customer-portal/.next ./apps/customer-portal/.next

EXPOSE 3001

CMD ["npm", "--prefix", "apps/customer-portal", "run", "start"]
