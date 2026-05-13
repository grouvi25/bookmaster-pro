FROM node:20-alpine AS build

WORKDIR /app

COPY apps/mini-app/package.json apps/mini-app/package-lock.json ./
RUN npm ci

COPY apps/mini-app/ .

ARG VITE_API_URL
ARG VITE_TG_BOT_USERNAME
ARG VITE_APP_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_TG_BOT_USERNAME=$VITE_TG_BOT_USERNAME
ENV VITE_APP_URL=$VITE_APP_URL

RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY apps/mini-app/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 5173
