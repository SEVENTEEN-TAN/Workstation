FROM node:24-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY . .
# The build never reads the persistent database or production secrets.
RUN DATABASE_URL=file:/tmp/workstation-build.db npx prisma generate \
    && DATABASE_URL=file:/tmp/workstation-build.db npx prisma migrate deploy \
    && DATABASE_URL=file:/tmp/workstation-build.db npm run build \
    && rm -f /tmp/workstation-build.db /tmp/workstation-build.db-wal /tmp/workstation-build.db-shm

FROM node:24-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Keep CLI dependencies for explicit migrations, backup and restore jobs.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./tsconfig.json
EXPOSE 3000
CMD ["node", "server.js"]
