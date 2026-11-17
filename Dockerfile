# Small, non-root image for Google Cloud Run. No npm install needed: zero dependencies.
FROM node:22-alpine
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY package.json server.js ./
COPY src ./src
COPY tools ./tools
COPY public ./public
USER node
EXPOSE 8080
CMD ["node", "server.js"]
