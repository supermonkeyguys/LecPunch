FROM node:20-bookworm-slim AS build

ARG NPM_REGISTRY=https://registry.npmjs.org/

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NPM_CONFIG_REGISTRY=$NPM_REGISTRY
ENV npm_config_registry=$NPM_REGISTRY
ENV NPM_CONFIG_USERCONFIG=/app/.npmrc
ENV npm_config_userconfig=/app/.npmrc
ENV XDG_CONFIG_HOME=/tmp/xdg

WORKDIR /app

RUN rm -f /root/.npmrc /etc/npmrc /usr/local/etc/npmrc
RUN rm -rf /root/.config/pnpm /tmp/xdg && mkdir -p /tmp/xdg
RUN printf "registry=%s\nstrict-ssl=true\n" "${NPM_REGISTRY}" > /app/.npmrc
RUN corepack enable
RUN npm config get registry

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json nest-cli.json ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm config get registry
RUN pnpm install --frozen-lockfile --registry=${NPM_REGISTRY} --userconfig=/app/.npmrc
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
