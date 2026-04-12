FROM node:20-bookworm-slim AS build

ARG NPM_REGISTRY=https://registry.npmjs.org/

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable
RUN npm config set registry ${NPM_REGISTRY} && pnpm config set registry ${NPM_REGISTRY}

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json nest-cli.json ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @lecpunch/shared build
RUN pnpm --filter @lecpunch/api build

FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app/apps/api

COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/pnpm-workspace.yaml /app/pnpm-workspace.yaml
COPY --from=build /app/apps/api/package.json /app/apps/api/package.json
COPY --from=build /app/apps/api/dist /app/apps/api/dist
COPY --from=build /app/packages/shared/package.json /app/packages/shared/package.json
COPY --from=build /app/packages/shared/dist /app/packages/shared/dist

EXPOSE 4000

CMD ["node", "dist/main.js"]
