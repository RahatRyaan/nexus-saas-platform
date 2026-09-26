FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

FROM base AS builder
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
EXPOSE 5000
USER node
CMD ["node", "dist/index.js"]
