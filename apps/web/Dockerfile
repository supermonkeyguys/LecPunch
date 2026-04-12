FROM node:20-bookworm-slim AS build

ARG NPM_REGISTRY=https://registry.npmjs.org/

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NPM_CONFIG_REGISTRY=$NPM_REGISTRY

WORKDIR /app

RUN corepack enable
RUN printf "registry=%s\n" "${NPM_REGISTRY}" > /app/.npmrc
RUN npm config set registry ${NPM_REGISTRY} --location=user

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --frozen-lockfile --registry=${NPM_REGISTRY}
RUN pnpm --filter @lecpunch/web build

FROM nginx:1.27-alpine AS runtime

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
