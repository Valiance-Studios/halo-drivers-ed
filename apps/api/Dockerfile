# The API image, built from the repository root: `docker build -f apps/api/Dockerfile .`
# It runs the service (dist/server.js) and, as the hde-migrate Cloud Run job, the migrations and catalog
# seed (dist/release.js).

FROM node:26-slim AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace @hde/api
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build --workspace @hde/api

FROM node:26-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace @hde/api --omit=dev && npm cache clean --force
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY apps/api/drizzle apps/api/drizzle
WORKDIR /app/apps/api
USER node
CMD ["node", "--enable-source-maps", "dist/server.js"]
