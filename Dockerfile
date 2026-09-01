FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# DATABASE_URL isn't needed at build time (no DB calls happen during `next build`
# for this app — every db/ import lives behind API routes), but Next.js still
# needs the var defined so build-time env validation doesn't fail on undefined.
ENV DATABASE_URL="postgres://placeholder:placeholder@localhost:5432/placeholder"
ENV JWT_SECRET="build-time-placeholder"
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
