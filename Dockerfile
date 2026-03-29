FROM node:20-alpine AS client-builder
WORKDIR /app/client

COPY client/package.json client/package-lock.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

FROM node:20-alpine AS server-builder
WORKDIR /app/server

COPY server/package.json server/package-lock.json ./
RUN npm ci

COPY server/ ./
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app/server

ENV NODE_ENV=production
ENV PORT=3001

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

COPY --from=server-builder /app/server/dist ./dist
COPY --from=client-builder /app/client/dist ./public

EXPOSE 3001

CMD ["node", "dist/index.js"]
