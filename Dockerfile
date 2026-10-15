FROM node:22-alpine AS build
# Mirror the repo layout: the type-check includes Site/tests, which import ../../tools/holidays-crawler.
WORKDIR /repo/Site
COPY Site/package.json Site/package-lock.json ./
RUN npm ci
COPY Site/ ./
COPY tools/ /repo/tools/
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /repo/Site/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/health || exit 1
