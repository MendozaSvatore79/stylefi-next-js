# API de StyleFi (NestJS). Se construye desde la raíz del repo (necesita el package-lock y packages/shared):
#   docker build -f apps/api/Dockerfile -t stylefi-api .
FROM node:24-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace @stylefi/api --workspace @stylefi/shared --ignore-scripts
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @stylefi/shared && npx -w @stylefi/api nest build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --omit=dev --workspace @stylefi/api --workspace @stylefi/shared --ignore-scripts && npm cache clean --force
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/apps/api/dist apps/api/dist
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s CMD wget -qO- http://127.0.0.1:${PORT:-4000}/health >/dev/null || exit 1
CMD ["node", "apps/api/dist/main.js"]
