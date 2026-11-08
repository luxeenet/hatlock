# HatLock Backend API Dockerfile
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

# Install dependencies
RUN npm ci

# Copy source trees
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
COPY tsconfig.json ./

# Generate Prisma client and build packages
RUN cd packages/database && npx prisma generate
RUN cd packages/shared && npm run build --if-present
RUN cd packages/hatpesa && npm run build --if-present
RUN cd packages/sonicpesa && npm run build --if-present
RUN cd apps/api && npm run build

# Production runner stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install OpenSSL for Prisma query engine
RUN apk add --no-cache openssl

COPY package.json package-lock.json* ./
COPY packages/database/package.json ./packages/database/
COPY packages/database/prisma ./packages/database/prisma
COPY packages/shared/package.json ./packages/shared/
COPY packages/hatpesa/package.json ./packages/hatpesa/
COPY packages/sonicpesa/package.json ./packages/sonicpesa/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/customer-portal/package.json ./apps/customer-portal/

RUN npm ci --omit=dev

COPY --from=builder /app/packages/database ./packages/database
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/packages/hatpesa ./packages/hatpesa
COPY --from=builder /app/packages/sonicpesa ./packages/sonicpesa
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Generate Prisma client for production runner environment
RUN cd packages/database && npx prisma generate

EXPOSE 3000

CMD ["node", "apps/api/dist/server.js"]
