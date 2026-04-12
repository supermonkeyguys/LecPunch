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

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm config get registry
RUN pnpm install --frozen-lockfile --registry=${NPM_REGISTRY}
RUN pnpm --filter @lecpunch/web build

FROM nginx:1.27-alpine AS runtime

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
