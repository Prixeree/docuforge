# Ultra-lightweight Dockerfile for DocuForge
FROM node:22-alpine

# Install git and curl for automatic asset syncing and health checks
RUN apk add --no-cache git curl

# Set working directory
WORKDIR /app

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV ROOT_DIR=/app

# Copy application files
COPY . /app/docuforge

# Expose server port
EXPOSE 3000

# Healthcheck to verify streaming server responsiveness
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/docuforge/ || exit 1

# Start DocuForge streaming server (auto-syncs assets on start)
CMD ["node", "/app/docuforge/tools/dev-server.js"]
