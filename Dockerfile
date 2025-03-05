FROM hub.lumigame.com/base/node:18.1-alpine-24h1.1 AS builder
WORKDIR /app
COPY package.json yarn.lock .modprunerrc ./
RUN npm run reg \
    && yarn install --production \
    && npx mod-pruner prune --force
COPY ./src/ .

FROM hub.lumigame.com/base/node:18.1-alpine-24h1.1
ARG NODE_ENV=production
ENV NODE_ENV $NODE_ENV
RUN mkdir /app && chown node:node /app
WORKDIR /app

USER node
ENV PATH /app/node_modules/.bin:$PATH
COPY --from=builder /app .

HEALTHCHECK --interval=10s CMD node --es-module-specifier-resolution=node healthcheck.js

EXPOSE 5000
CMD [ "node", "--es-module-specifier-resolution=node", "./app.js" ]