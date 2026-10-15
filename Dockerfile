# Multi-stage Dockerfile for WURFEL (Technical Dossier Review)
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/index.html ./index.html

# Expose port 3000 for web traffic
EXPOSE 3000

# Start production server
CMD ["node", "server.js"]
