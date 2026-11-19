FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/src ./src
COPY --from=build /app/dist ./dist
RUN mkdir data && chown node:node data
USER node
ENV HOST=0.0.0.0 PORT=3000 DB_PATH=/app/data/platform.db
EXPOSE 3000
CMD ["node","src/platform.js"]
