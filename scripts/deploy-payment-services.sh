#!/bin/bash

# GOMFLOW Payment Services Railway Deployment Script
# Deploy gomflow-payments and gomflow-smart-agent services to Railway

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ENVIRONMENT=${1:-production}

echo -e "${GREEN}🚀 Deploying GOMFLOW Payment Services to Railway (${ENVIRONMENT})${NC}"

# Function to check if Railway CLI is installed
check_railway_cli() {
    if ! command -v railway &> /dev/null; then
        echo -e "${RED}❌ Railway CLI is not installed${NC}"
        echo -e "${YELLOW}Install with: npm install -g @railway/cli${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Railway CLI found${NC}"
}

# Function to check authentication
check_railway_auth() {
    if ! railway whoami &> /dev/null; then
        echo -e "${RED}❌ Not authenticated with Railway${NC}"
        echo -e "${YELLOW}Run: railway login${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Railway authentication verified${NC}"
}

# Function to validate environment variables
validate_env_vars() {
    local service=$1
    echo -e "${YELLOW}🔍 Validating environment variables for ${service}...${NC}"
    
    if [ "$service" = "payments" ]; then
        # Required for payments service
        required_vars=(
            "SERVICE_SECRET"
            "SUPABASE_URL" 
            "SUPABASE_SERVICE_ROLE_KEY"
            "PAYMONGO_SECRET_KEY"
            "PAYMONGO_WEBHOOK_SECRET"
            "BILLPLZ_API_KEY"
            "BILLPLZ_COLLECTION_ID"
            "BILLPLZ_WEBHOOK_SECRET"
        )
    elif [ "$service" = "smart-agent" ]; then
        # Required for smart agent service
        required_vars=(
            "SERVICE_SECRET"
            "SUPABASE_URL"
            "SUPABASE_SERVICE_ROLE_KEY" 
            "OPENAI_API_KEY"
        )
    fi
    
    missing_vars=()
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        echo -e "${RED}❌ Missing required environment variables:${NC}"
        printf '%s\n' "${missing_vars[@]}"
        echo -e "${YELLOW}Please set these variables before deployment${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ All required environment variables present${NC}"
    return 0
}

# Function to deploy service to Railway
deploy_service() {
    local service=$1
    local service_dir="gomflow-${service}"
    
    echo -e "${BLUE}📦 Deploying ${service} service...${NC}"
    
    if [ ! -d "$service_dir" ]; then
        echo -e "${RED}❌ Directory ${service_dir} not found${NC}"
        exit 1
    fi
    
    cd "$service_dir"
    
    # Initialize Railway project if not exists
    if [ ! -f ".railway" ]; then
        echo -e "${YELLOW}🔧 Initializing Railway project for ${service}...${NC}"
        railway init "gomflow-${service}" --template
    fi
    
    # Add Redis if needed
    if [ "$service" = "payments" ] || [ "$service" = "smart-agent" ]; then
        echo -e "${YELLOW}🔧 Adding Redis add-on...${NC}"
        railway add redis || echo -e "${YELLOW}⚠️ Redis may already be added${NC}"
    fi
    
    # Set environment variables
    echo -e "${YELLOW}🔧 Setting environment variables...${NC}"
    railway variables set NODE_ENV="$ENVIRONMENT"
    railway variables set PORT="3000"
    
    if [ "$service" = "payments" ]; then
        # Set payments-specific environment variables
        railway variables set SERVICE_SECRET="$SERVICE_SECRET"
        railway variables set SUPABASE_URL="$SUPABASE_URL"
        railway variables set SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
        railway variables set PAYMONGO_SECRET_KEY="$PAYMONGO_SECRET_KEY"
        railway variables set PAYMONGO_WEBHOOK_SECRET="$PAYMONGO_WEBHOOK_SECRET"
        railway variables set PAYMONGO_API_URL="https://api.paymongo.com/v1"
        railway variables set BILLPLZ_API_KEY="$BILLPLZ_API_KEY"
        railway variables set BILLPLZ_COLLECTION_ID="$BILLPLZ_COLLECTION_ID"
        railway variables set BILLPLZ_WEBHOOK_SECRET="$BILLPLZ_WEBHOOK_SECRET"
        railway variables set BILLPLZ_API_URL="https://www.billplz.com/api/v3"
        railway variables set CORS_ORIGIN="https://gomflow.com,https://www.gomflow.com"
        railway variables set RATE_LIMIT_WINDOW_MS="900000"
        railway variables set RATE_LIMIT_MAX="100"
        railway variables set LOG_LEVEL="info"
        
        # Set service URLs (will be updated after all services are deployed)
        railway variables set CORE_API_URL="${CORE_API_URL:-https://gomflow.com/api}"
        railway variables set WHATSAPP_SERVICE_URL="${WHATSAPP_SERVICE_URL:-https://gomflow-whatsapp.railway.app}"
        railway variables set TELEGRAM_SERVICE_URL="${TELEGRAM_SERVICE_URL:-https://gomflow-telegram.railway.app}"
        railway variables set DISCORD_SERVICE_URL="${DISCORD_SERVICE_URL:-https://gomflow-discord.railway.app}"
        
    elif [ "$service" = "smart-agent" ]; then
        # Set smart agent-specific environment variables
        railway variables set SERVICE_SECRET="$SERVICE_SECRET"
        railway variables set SUPABASE_URL="$SUPABASE_URL"
        railway variables set SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
        railway variables set OPENAI_API_KEY="$OPENAI_API_KEY"
        railway variables set OPENAI_MODEL="${OPENAI_MODEL:-gpt-4-vision-preview}"
        railway variables set OPENAI_MAX_TOKENS="${OPENAI_MAX_TOKENS:-1500}"
        railway variables set TESSERACT_LANG="${TESSERACT_LANG:-eng+fil+msa}"
        railway variables set OCR_CONFIDENCE_THRESHOLD="${OCR_CONFIDENCE_THRESHOLD:-60}"
        railway variables set MAX_IMAGE_SIZE="${MAX_IMAGE_SIZE:-10485760}"
        railway variables set ALLOWED_IMAGE_TYPES="${ALLOWED_IMAGE_TYPES:-image/jpeg,image/png,image/webp}"
        railway variables set IMAGE_QUALITY="${IMAGE_QUALITY:-85}"
        railway variables set MAX_IMAGE_WIDTH="${MAX_IMAGE_WIDTH:-2048}"
        railway variables set MAX_IMAGE_HEIGHT="${MAX_IMAGE_HEIGHT:-2048}"
        railway variables set MIN_CONFIDENCE_AUTO_MATCH="${MIN_CONFIDENCE_AUTO_MATCH:-0.85}"
        railway variables set MIN_CONFIDENCE_SUGGEST="${MIN_CONFIDENCE_SUGGEST:-0.60}"
        railway variables set MIN_AMOUNT_THRESHOLD="${MIN_AMOUNT_THRESHOLD:-1.00}"
        railway variables set MAX_AMOUNT_THRESHOLD="${MAX_AMOUNT_THRESHOLD:-100000.00}"
        railway variables set CORS_ORIGIN="https://gomflow.com,https://www.gomflow.com"
        railway variables set RATE_LIMIT_WINDOW_MS="900000"
        railway variables set RATE_LIMIT_MAX="50"
        railway variables set QUEUE_CONCURRENCY="${QUEUE_CONCURRENCY:-3}"
        railway variables set QUEUE_MAX_ATTEMPTS="${QUEUE_MAX_ATTEMPTS:-3}"
        railway variables set QUEUE_BACKOFF_DELAY="${QUEUE_BACKOFF_DELAY:-5000}"
        railway variables set UPLOAD_DIR="${UPLOAD_DIR:-uploads}"
        railway variables set PROCESSED_DIR="${PROCESSED_DIR:-processed}"
        railway variables set TEMP_DIR="${TEMP_DIR:-temp}"
        railway variables set LOG_LEVEL="info"
        railway variables set ENABLE_METRICS="${ENABLE_METRICS:-true}"
        railway variables set METRICS_PORT="${METRICS_PORT:-9090}"
        
        # Set service URLs
        railway variables set CORE_API_URL="${CORE_API_URL:-https://gomflow.com/api}"
        railway variables set PAYMENT_SERVICE_URL="${PAYMENT_SERVICE_URL:-https://gomflow-payments.railway.app}"
        railway variables set WHATSAPP_SERVICE_URL="${WHATSAPP_SERVICE_URL:-https://gomflow-whatsapp.railway.app}"
        railway variables set TELEGRAM_SERVICE_URL="${TELEGRAM_SERVICE_URL:-https://gomflow-telegram.railway.app}"
        railway variables set DISCORD_SERVICE_URL="${DISCORD_SERVICE_URL:-https://gomflow-discord.railway.app}"
    fi
    
    # Deploy the service
    echo -e "${YELLOW}🚀 Deploying ${service} to Railway...${NC}"
    railway up --detach
    
    # Get the deployment URL
    local service_url=$(railway status --json | jq -r '.deployments[0].url' 2>/dev/null || echo "")
    if [ -n "$service_url" ]; then
        echo -e "${GREEN}✅ ${service} deployed successfully${NC}"
        echo -e "${BLUE}🌐 Service URL: ${service_url}${NC}"
        
        # Export URL for other services
        if [ "$service" = "payments" ]; then
            export PAYMENT_SERVICE_URL="$service_url"
        elif [ "$service" = "smart-agent" ]; then
            export SMART_AGENT_SERVICE_URL="$service_url"
        fi
    else
        echo -e "${YELLOW}⚠️ Could not retrieve service URL${NC}"
    fi
    
    cd ..
}

# Function to wait for service health
wait_for_health() {
    local service_url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1
    
    echo -e "${YELLOW}🔍 Waiting for ${service_name} to be healthy...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -sf "${service_url}/api/health" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ ${service_name} is healthy${NC}"
            return 0
        fi
        
        echo "Attempt ${attempt}/${max_attempts} - ${service_name} not ready yet..."
        sleep 10
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}❌ ${service_name} failed to become healthy${NC}"
    return 1
}

# Function to update service URLs
update_service_urls() {
    echo -e "${YELLOW}🔧 Updating service URLs with actual deployment URLs...${NC}"
    
    # Update payments service with smart agent URL
    if [ -n "$SMART_AGENT_SERVICE_URL" ]; then
        cd gomflow-payments
        railway variables set SMART_AGENT_SERVICE_URL="$SMART_AGENT_SERVICE_URL"
        cd ..
    fi
    
    # Update smart agent service with payments URL  
    if [ -n "$PAYMENT_SERVICE_URL" ]; then
        cd gomflow-smart-agent
        railway variables set PAYMENT_SERVICE_URL="$PAYMENT_SERVICE_URL"
        cd ..
    fi
    
    echo -e "${GREEN}✅ Service URLs updated${NC}"
}

# Function to configure webhooks
configure_webhooks() {
    echo -e "${YELLOW}🔧 Configuring payment provider webhooks...${NC}"
    
    if [ -n "$PAYMENT_SERVICE_URL" ]; then
        # Configure PayMongo webhook
        if [ -n "$PAYMONGO_SECRET_KEY" ]; then
            echo -e "${YELLOW}📡 Configuring PayMongo webhook...${NC}"
            
            curl -X POST https://api.paymongo.com/v1/webhooks \
                -H "Content-Type: application/json" \
                -H "Authorization: Basic $(echo -n $PAYMONGO_SECRET_KEY: | base64)" \
                -d "{
                    \"data\": {
                        \"attributes\": {
                            \"url\": \"${PAYMENT_SERVICE_URL}/api/webhooks/paymongo\",
                            \"events\": [
                                \"payment.paid\",
                                \"payment.failed\",
                                \"payment_intent.succeeded\",
                                \"payment_intent.payment_failed\"
                            ]
                        }
                    }
                }" || echo -e "${YELLOW}⚠️ PayMongo webhook may already exist${NC}"
        fi
        
        # Configure Billplz webhook
        if [ -n "$BILLPLZ_API_KEY" ] && [ -n "$BILLPLZ_COLLECTION_ID" ]; then
            echo -e "${YELLOW}📡 Configuring Billplz webhook...${NC}"
            
            curl -X PATCH "https://www.billplz.com/api/v3/collections/${BILLPLZ_COLLECTION_ID}" \
                -u "${BILLPLZ_API_KEY}:" \
                -d "webhook_url=${PAYMENT_SERVICE_URL}/api/webhooks/billplz" || echo -e "${YELLOW}⚠️ Billplz webhook may already exist${NC}"
        fi
        
        echo -e "${GREEN}✅ Webhooks configured${NC}"
    else
        echo -e "${YELLOW}⚠️ Payment service URL not available, skipping webhook configuration${NC}"
    fi
}

# Function to run smoke tests
run_smoke_tests() {
    echo -e "${YELLOW}🧪 Running smoke tests...${NC}"
    
    # Test payments service
    if [ -n "$PAYMENT_SERVICE_URL" ]; then
        echo -e "${YELLOW}Testing payments service...${NC}"
        
        health_response=$(curl -s "${PAYMENT_SERVICE_URL}/api/health" || echo "")
        if echo "$health_response" | grep -q "healthy"; then
            echo -e "${GREEN}✅ Payments service health check passed${NC}"
        else
            echo -e "${RED}❌ Payments service health check failed${NC}"
            echo "$health_response"
        fi
    fi
    
    # Test smart agent service
    if [ -n "$SMART_AGENT_SERVICE_URL" ]; then
        echo -e "${YELLOW}Testing smart agent service...${NC}"
        
        health_response=$(curl -s "${SMART_AGENT_SERVICE_URL}/api/health" || echo "")
        if echo "$health_response" | grep -q "healthy"; then
            echo -e "${GREEN}✅ Smart agent service health check passed${NC}"
        else
            echo -e "${RED}❌ Smart agent service health check failed${NC}"
            echo "$health_response"
        fi
        
        # Test status endpoint
        status_response=$(curl -s "${SMART_AGENT_SERVICE_URL}/api/status" || echo "")
        if echo "$status_response" | grep -q "GOMFLOW Smart Payment Agent"; then
            echo -e "${GREEN}✅ Smart agent status check passed${NC}"
        else
            echo -e "${YELLOW}⚠️ Smart agent status check inconclusive${NC}"
        fi
    fi
}

# Main execution
main() {
    echo -e "${BLUE}=== GOMFLOW Payment Services Railway Deployment ===${NC}"
    
    # Pre-flight checks
    check_railway_cli
    check_railway_auth
    
    # Load environment variables from file if exists
    if [ -f ".env.${ENVIRONMENT}" ]; then
        echo -e "${YELLOW}📝 Loading environment variables from .env.${ENVIRONMENT}${NC}"
        export $(cat .env.${ENVIRONMENT} | grep -v '^#' | xargs)
    fi
    
    # Validate environment variables
    if ! validate_env_vars "payments"; then
        echo -e "${RED}❌ Payments service environment validation failed${NC}"
        exit 1
    fi
    
    if ! validate_env_vars "smart-agent"; then
        echo -e "${RED}❌ Smart agent service environment validation failed${NC}"
        exit 1
    fi
    
    # Deploy services
    deploy_service "payments"
    deploy_service "smart-agent"
    
    # Update cross-service URLs
    update_service_urls
    
    # Wait for services to be healthy
    if [ -n "$PAYMENT_SERVICE_URL" ]; then
        wait_for_health "$PAYMENT_SERVICE_URL" "Payments Service"
    fi
    
    if [ -n "$SMART_AGENT_SERVICE_URL" ]; then
        wait_for_health "$SMART_AGENT_SERVICE_URL" "Smart Agent Service"
    fi
    
    # Configure webhooks
    configure_webhooks
    
    # Run smoke tests
    run_smoke_tests
    
    echo -e "${GREEN}🎉 GOMFLOW Payment Services deployment completed successfully!${NC}"
    echo -e "${BLUE}📋 Deployment Summary:${NC}"
    echo -e "  Payments Service: ${PAYMENT_SERVICE_URL:-Not deployed}"
    echo -e "  Smart Agent Service: ${SMART_AGENT_SERVICE_URL:-Not deployed}"
    echo -e "${YELLOW}📚 Next steps:${NC}"
    echo -e "  1. Test payment flows end-to-end"
    echo -e "  2. Configure monitoring and alerting"
    echo -e "  3. Update other services with new URLs"
    echo -e "  4. Run comprehensive integration tests"
}

# Execute main function
main "$@"