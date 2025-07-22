# GOMFLOW WhatsApp Service Dockerfile

FROM node:18-slim

# Install curl for health checks
RUN apt-get update && apt-get install -y curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Create temporary directory for media files
RUN mkdir -p /app/temp && chmod 755 /app/temp

# Build TypeScript
RUN npm run build

# Create non-root user for security
RUN groupadd -r gomflow && useradd -r -g gomflow gomflow
RUN chown -R gomflow:gomflow /app
USER gomflow

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3000}/api/health || exit 1

# Expose port
EXPOSE 3000

# Start the service
CMD ["npm", "run", "start:prod"]