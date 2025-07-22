#!/bin/bash

# GOMFLOW Deployment Script
# Automates deployment of all microservices to their respective platforms

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-staging}
SERVICES=${2:-all}

echo -e "${GREEN}🚀 Starting GOMFLOW deployment to ${ENVIRONMENT}${NC}"

# Function to deploy individual service
deploy_service() {
    local service=$1
    local platform=$2
    
    echo -e "${YELLOW}📦 Deploying ${service} to ${platform}...${NC}"
    
    case $platform in
        "vercel")
            cd "gomflow-${service}"
            if [ "$ENVIRONMENT" = "production" ]; then
                vercel --prod --confirm
            else
                vercel --confirm
            fi
            cd ..
            ;;
        "railway")
            cd "gomflow-${service}"
            railway up --environment $ENVIRONMENT
            cd ..
            ;;
        *)
            echo -e "${RED}❌ Unknown platform: ${platform}${NC}"
            exit 1
            ;;
    esac
    
    echo -e "${GREEN}✅ ${service} deployed successfully${NC}"
}

# Function to wait for service health
wait_for_health() {
    local service_url=$1
    local max_attempts=30
    local attempt=1
    
    echo -e "${YELLOW}🔍 Waiting for ${service_url} to be healthy...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -sf "${service_url}/api/health" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Service is healthy${NC}"
            return 0
        fi
        
        echo "Attempt ${attempt}/${max_attempts} - Service not ready yet..."
        sleep 10
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}❌ Service failed to become healthy${NC}"
    return 1
}

# Deploy services based on selection
if [ "$SERVICES" = "all" ] || [[ "$SERVICES" == *"core"* ]]; then
    deploy_service "core" "vercel"
fi

if [ "$SERVICES" = "all" ] || [[ "$SERVICES" == *"smart-agent"* ]]; then
    deploy_service "smart-agent" "railway"
fi

if [ "$SERVICES" = "all" ] || [[ "$SERVICES" == *"payments"* ]]; then
    deploy_service "payments" "railway"
fi

if [ "$SERVICES" = "all" ] || [[ "$SERVICES" == *"telegram"* ]]; then
    deploy_service "telegram" "railway"
fi

if [ "$SERVICES" = "all" ] || [[ "$SERVICES" == *"discord"* ]]; then
    deploy_service "discord" "railway"
fi

if [ "$SERVICES" = "all" ] || [[ "$SERVICES" == *"whatsapp"* ]]; then
    deploy_service "whatsapp" "railway"
fi

echo -e "${GREEN}🎉 All deployments completed!${NC}"

# Health checks
echo -e "${YELLOW}🔍 Running health checks...${NC}"

if [ "$ENVIRONMENT" = "production" ]; then
    BASE_URL="https://gomflow.com"
    SMART_AGENT_URL="https://gomflow-smart-agent.railway.app"
    PAYMENTS_URL="https://gomflow-payments.railway.app"
    TELEGRAM_URL="https://gomflow-telegram.railway.app"
    DISCORD_URL="https://gomflow-discord.railway.app"
    WHATSAPP_URL="https://gomflow-whatsapp.railway.app"
else
    BASE_URL="https://gomflow-staging.vercel.app"
    SMART_AGENT_URL="https://gomflow-smart-agent-staging.railway.app"
    PAYMENTS_URL="https://gomflow-payments-staging.railway.app"
    TELEGRAM_URL="https://gomflow-telegram-staging.railway.app"
    DISCORD_URL="https://gomflow-discord-staging.railway.app"
    WHATSAPP_URL="https://gomflow-whatsapp-staging.railway.app"
fi

# Wait for services to be healthy
wait_for_health "$BASE_URL"
wait_for_health "$SMART_AGENT_URL"
wait_for_health "$PAYMENTS_URL"
wait_for_health "$TELEGRAM_URL"
wait_for_health "$DISCORD_URL"
wait_for_health "$WHATSAPP_URL"

echo -e "${GREEN}✅ All services are healthy and ready!${NC}"

# Configure webhooks after deployment
echo -e "${YELLOW}🔧 Configuring webhooks...${NC}"
./scripts/configure-webhooks.sh $ENVIRONMENT

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"