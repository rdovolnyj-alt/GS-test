FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --fetch-retries=5 --fetch-retry-maxtimeout=120000
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Шаблон: ${DOMAIN} подставляется при старте контейнера (envsubst)
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 80 443
