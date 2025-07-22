# GOMFLOW Smart Agent Service Dockerfile
# Optimized for AI/ML workloads with OCR and image processing

FROM node:18-slim

# Install system dependencies for OCR, image processing, and AI/ML
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-fil \
    tesseract-ocr-msa \
    libtesseract-dev \
    libpoppler-cpp-dev \
    libmagickwand-dev \
    imagemagick \
    python3 \
    python3-pip \
    python3-dev \
    build-essential \
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

# Create necessary directories
RUN mkdir -p /app/uploads /app/processed /app/temp \
    && chmod 755 /app/uploads /app/processed /app/temp

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