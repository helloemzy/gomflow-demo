#!/bin/bash

# GOMFLOW Interactive Demo Deployment Script
# This script deploys the full interactive demo to Vercel

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Banner
echo -e "${GREEN}"
echo "============================================"
echo "🚀 GOMFLOW INTERACTIVE DEMO DEPLOYMENT"
echo "============================================"
echo "Deploying full interactive demo to Vercel"
echo "============================================"
echo -e "${NC}"

# Check prerequisites
log "Checking prerequisites..."
command -v node >/dev/null 2>&1 || { error "Node.js is required but not installed. Aborting."; exit 1; }
command -v npm >/dev/null 2>&1 || { error "npm is required but not installed. Aborting."; exit 1; }
command -v vercel >/dev/null 2>&1 || { error "Vercel CLI is required. Install with: npm i -g vercel"; exit 1; }

# Navigate to gomflow-core
cd gomflow-core

# Create a production demo environment file
log "Setting up demo environment..."
cp .env.production.demo .env.production.local

# Set demo mode environment variables
export NEXT_PUBLIC_DEMO_MODE=true
export NEXT_PUBLIC_ENABLE_MOCK_PAYMENTS=true
export NEXT_PUBLIC_ENABLE_DEMO_DATA=true

# Install dependencies with force flag to handle any issues
log "Installing dependencies..."
npm install --force || {
    info "Using cached dependencies..."
}

# Build the application
log "Building application..."
npm run build || {
    error "Build failed. Checking for issues..."
    exit 1
}

# Deploy to Vercel
log "Deploying to Vercel..."

# Use demo-specific Vercel configuration
cp vercel.demo.json vercel.json

# Deploy with specific project name
vercel deploy --prod --name gomflow-interactive-demo --force || {
    error "Deployment failed!"
    exit 1
}

log "Deployment completed successfully!"
echo -e "\n${GREEN}============================================"
echo "🎉 GOMFLOW INTERACTIVE DEMO DEPLOYED!"
echo "============================================${NC}"
echo ""
echo -e "${BLUE}📱 Interactive Demo URL:${NC}"
echo "   🌐 https://gomflow-interactive-demo.vercel.app"
echo ""
echo -e "${YELLOW}🎭 DEMO FEATURES:${NC}"
echo "   ✅ Complete dashboard with analytics"
echo "   ✅ Order management system" 
echo "   ✅ Mock payment processing"
echo "   ✅ AI-powered features"
echo "   ✅ Collaboration tools"
echo "   ✅ Real-time notifications"
echo ""
echo -e "${GREEN}🎮 TEST SCENARIOS:${NC}"
echo "   1. Browse existing demo orders"
echo "   2. Create a new group order"
echo "   3. Submit an order as a buyer"
echo "   4. Upload payment proof"
echo "   5. View analytics dashboard"
echo "   6. Test collaboration features"
echo ""
info "The interactive demo is now live and ready for testing!"