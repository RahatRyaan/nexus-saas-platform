FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json

RUN npm ci

COPY server/tsconfig.json server/tsconfig.json
COPY server/src server/src

RUN npm run build --workspace=server


FROM node:20-alpine AS production

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json

RUN npm ci --omit=dev

COPY --from=builder /app/server/dist ./server/dist

EXPOSE 5000
USER node

CMD ["node", "server/dist/index.js"]
