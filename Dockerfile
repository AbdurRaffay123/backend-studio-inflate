# syntax=docker/dockerfile:1
FROM node:22-alpine

# Non-root user for security
RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

# Install dependencies first (cached layer)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY --chown=app:app . .

# Logs directory owned by the non-root user
RUN mkdir -p logs && chown app:app logs

USER app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "index.js"]
