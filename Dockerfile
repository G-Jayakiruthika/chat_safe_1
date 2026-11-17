FROM node:26-slim AS deps
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev

FROM node:26-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY backend/src ./src
COPY backend/package.json ./
USER node
EXPOSE 8080
CMD ["node", "src/server.js"]
