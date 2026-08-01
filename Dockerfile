FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npx prisma generate && npx vite build && npx esbuild src/server/server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/index.html ./index.html
COPY --from=builder /app/metadata.json ./metadata.json

# Data dir for SQLite
RUN mkdir -p /app/data /app/backups

# Generate Prisma client and migrate in production
CMD npx prisma generate && npx prisma db push --skip-generate && node dist/server.cjs

EXPOSE 3000