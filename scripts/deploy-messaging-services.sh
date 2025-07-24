#!/bin/bash

# GOMFLOW Messaging Services Deployment Script
# Deploys WhatsApp, Telegram, and Discord services to Railway

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEPLOY_LOG="messaging-deploy-$(date +%Y%m%d-%H%M%S).log"
MESSAGING_SERVICES=(
    "gomflow-whatsapp"
    "gomflow-telegram"
    "gomflow-discord"
)

# Logging functions
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$DEPLOY_LOG"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$DEPLOY_LOG"
}

warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$DEPLOY_LOG"
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1${NC}" | tee -a "$DEPLOY_LOG"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites for messaging services deployment..."
    
    # Check if required tools are installed
    command -v railway >/dev/null 2>&1 || { error "Railway CLI is required but not installed. Run: npm install -g @railway/cli"; exit 1; }
    command -v docker >/dev/null 2>&1 || { error "Docker is required but not installed."; exit 1; }
    command -v node >/dev/null 2>&1 || { error "Node.js is required but not installed."; exit 1; }
    command -v npm >/dev/null 2>&1 || { error "npm is required but not installed."; exit 1; }
    
    # Check if user is logged into Railway
    if ! railway auth >/dev/null 2>&1; then
        error "Not logged into Railway. Please run: railway login"
        exit 1
    fi
    
    # Check if shared module exists
    if [[ ! -d "gomflow-shared" ]]; then
        error "gomflow-shared module not found. Please ensure it exists and is built."
        exit 1
    fi
    
    log "Prerequisites check passed ✓"
}

# Build shared module
build_shared_module() {
    log "Building shared module..."
    
    cd gomflow-shared
    if [[ -f "package.json" ]]; then
        npm install
        npm run build
    else
        error "gomflow-shared package.json not found"
        exit 1
    fi
    cd ..
    
    log "Shared module built successfully ✓"
}

# Validate environment variables
validate_environment() {
    log "Validating environment variables..."
    
    local required_vars=(
        "SUPABASE_URL"
        "SUPABASE_SERVICE_ROLE_KEY"
        "SERVICE_SECRET"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        error "Missing required environment variables: ${missing_vars[*]}"
        error "Please set these variables or source your .env file"
        exit 1
    fi
    
    # Service-specific validations
    if [[ -z "$TELEGRAM_BOT_TOKEN" ]]; then
        warning "TELEGRAM_BOT_TOKEN not set - Telegram service may not work properly"
    fi
    
    if [[ -z "$TWILIO_ACCOUNT_SID" || -z "$TWILIO_AUTH_TOKEN" ]]; then
        warning "Twilio credentials not set - WhatsApp service may not work properly"
    fi
    
    if [[ -z "$DISCORD_TOKEN" ]]; then
        warning "DISCORD_TOKEN not set - Discord service may not work properly"
    fi
    
    log "Environment validation completed ✓"
}

# Test service builds
test_service_builds() {
    log "Testing service builds..."
    
    for service in "${MESSAGING_SERVICES[@]}"; do
        if [[ -d "$service" ]]; then
            log "Testing build for $service..."
            cd "$service"
            
            # Install dependencies
            if ! npm install; then
                error "Failed to install dependencies for $service"
                exit 1
            fi
            
            # Run TypeScript compilation
            if ! npm run build; then
                error "Failed to build $service"
                exit 1
            fi
            
            # Run tests if available
            if npm run test >/dev/null 2>&1; then
                info "Running tests for $service..."
                if ! npm test; then
                    warning "Tests failed for $service - continuing with deployment"
                fi
            else
                info "No tests found for $service"
            fi
            
            cd ..
            log "Build test passed for $service ✓"
        else
            error "Service directory $service not found"
            exit 1
        fi
    done
    
    log "All service builds tested successfully ✓"
}

# Deploy WhatsApp service
deploy_whatsapp_service() {
    log "Deploying WhatsApp service to Railway..."
    
    cd gomflow-whatsapp
    
    # Create or link to Railway project
    info "Setting up Railway project for WhatsApp service..."
    if ! railway status >/dev/null 2>&1; then
        info "Creating new Railway project for WhatsApp service..."
        railway create gomflow-whatsapp-prod
    fi
    
    # Add Redis plugin
    info "Adding Redis plugin..."
    railway add redis || warning "Redis plugin may already exist"
    
    # Set environment variables
    info "Setting environment variables..."
    railway env set NODE_ENV=production
    railway env set PORT=3000
    railway env set SUPABASE_URL="$SUPABASE_URL"
    railway env set SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
    railway env set SERVICE_SECRET="$SERVICE_SECRET"
    
    if [[ -n "$TWILIO_ACCOUNT_SID" ]]; then
        railway env set TWILIO_ACCOUNT_SID="$TWILIO_ACCOUNT_SID"
        railway env set TWILIO_AUTH_TOKEN="$TWILIO_AUTH_TOKEN"
        railway env set TWILIO_WHATSAPP_NUMBER="$TWILIO_WHATSAPP_NUMBER"
    fi
    
    railway env set CORE_API_URL="https://gomflow-core.vercel.app"
    railway env set PAYMENT_SERVICE_URL="https://gomflow-payments.railway.app"
    railway env set SMART_AGENT_SERVICE_URL="https://gomflow-smart-agent.railway.app"
    
    # Deploy service
    info "Deploying WhatsApp service..."
    railway deploy
    
    # Get service URL
    WHATSAPP_URL=$(railway status --json 2>/dev/null | jq -r '.deployments[0].url' 2>/dev/null || echo "")
    if [[ -n "$WHATSAPP_URL" ]]; then
        log "WhatsApp service deployed at: $WHATSAPP_URL"
        export WHATSAPP_SERVICE_URL="$WHATSAPP_URL"
    else
        warning "Could not determine WhatsApp service URL"
    fi
    
    cd ..
    log "WhatsApp service deployment completed ✓"
}

# Deploy Telegram service
deploy_telegram_service() {
    log "Deploying Telegram service to Railway..."
    
    cd gomflow-telegram
    
    # Create or link to Railway project
    info "Setting up Railway project for Telegram service..."
    if ! railway status >/dev/null 2>&1; then
        info "Creating new Railway project for Telegram service..."
        railway create gomflow-telegram-prod
    fi
    
    # Add Redis plugin
    info "Adding Redis plugin..."
    railway add redis || warning "Redis plugin may already exist"
    
    # Set environment variables
    info "Setting environment variables..."
    railway env set NODE_ENV=production
    railway env set PORT=3000
    railway env set SUPABASE_URL="$SUPABASE_URL"
    railway env set SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
    railway env set SERVICE_SECRET="$SERVICE_SECRET"
    
    if [[ -n "$TELEGRAM_BOT_TOKEN" ]]; then
        railway env set TELEGRAM_BOT_TOKEN="$TELEGRAM_BOT_TOKEN"
        railway env set TELEGRAM_WEBHOOK_SECRET="$TELEGRAM_WEBHOOK_SECRET"
    fi
    
    railway env set CORE_API_URL="https://gomflow-core.vercel.app"
    railway env set PAYMENT_SERVICE_URL="https://gomflow-payments.railway.app"
    railway env set SMART_AGENT_SERVICE_URL="https://gomflow-smart-agent.railway.app"
    railway env set WHATSAPP_SERVICE_URL="${WHATSAPP_SERVICE_URL:-https://gomflow-whatsapp.railway.app}"
    
    railway env set ENABLE_INLINE_PAYMENTS=true
    railway env set ENABLE_SMART_PAYMENT_DETECTION=true
    railway env set AUTO_DELETE_PROCESSED_IMAGES=true
    railway env set MAX_FILE_SIZE=20971520
    railway env set RATE_LIMIT_WINDOW_MS=60000
    railway env set RATE_LIMIT_MAX_MESSAGES=30
    railway env set RATE_LIMIT_MAX_UPLOADS=5
    
    # Deploy service
    info "Deploying Telegram service..."
    railway deploy
    
    # Get service URL
    TELEGRAM_URL=$(railway status --json 2>/dev/null | jq -r '.deployments[0].url' 2>/dev/null || echo "")
    if [[ -n "$TELEGRAM_URL" ]]; then
        log "Telegram service deployed at: $TELEGRAM_URL"
        export TELEGRAM_SERVICE_URL="$TELEGRAM_URL"
        
        # Set webhook URL
        railway env set TELEGRAM_WEBHOOK_URL="$TELEGRAM_URL/webhook/telegram"
    else
        warning "Could not determine Telegram service URL"
    fi
    
    cd ..
    log "Telegram service deployment completed ✓"
}

# Deploy Discord service
deploy_discord_service() {
    log "Deploying Discord service to Railway..."
    
    cd gomflow-discord
    
    # Create or link to Railway project
    info "Setting up Railway project for Discord service..."
    if ! railway status >/dev/null 2>&1; then
        info "Creating new Railway project for Discord service..."
        railway create gomflow-discord-prod
    fi
    
    # Add Redis plugin
    info "Adding Redis plugin..."
    railway add redis || warning "Redis plugin may already exist"
    
    # Set environment variables
    info "Setting environment variables..."
    railway env set NODE_ENV=production
    railway env set PORT=3000
    railway env set SUPABASE_URL="$SUPABASE_URL"
    railway env set SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
    railway env set SERVICE_SECRET="$SERVICE_SECRET"
    
    if [[ -n "$DISCORD_TOKEN" ]]; then
        railway env set DISCORD_TOKEN="$DISCORD_TOKEN"
        railway env set DISCORD_CLIENT_ID="$DISCORD_CLIENT_ID"
    fi
    
    railway env set CORE_API_URL="https://gomflow-core.vercel.app"
    railway env set PAYMENT_SERVICE_URL="https://gomflow-payments.railway.app"
    railway env set SMART_AGENT_SERVICE_URL="https://gomflow-smart-agent.railway.app"
    railway env set WHATSAPP_SERVICE_URL="${WHATSAPP_SERVICE_URL:-https://gomflow-whatsapp.railway.app}"
    railway env set TELEGRAM_SERVICE_URL="${TELEGRAM_SERVICE_URL:-https://gomflow-telegram.railway.app}"
    
    railway env set ENABLE_SLASH_COMMANDS=true
    railway env set ENABLE_BUTTON_INTERACTIONS=true
    railway env set ENABLE_MODAL_INTERACTIONS=true
    
    # Deploy service
    info "Deploying Discord service..."
    railway deploy
    
    # Get service URL
    DISCORD_URL=$(railway status --json 2>/dev/null | jq -r '.deployments[0].url' 2>/dev/null || echo "")
    if [[ -n "$DISCORD_URL" ]]; then
        log "Discord service deployed at: $DISCORD_URL"
        export DISCORD_SERVICE_URL="$DISCORD_URL"
    else
        warning "Could not determine Discord service URL"
    fi
    
    cd ..
    log "Discord service deployment completed ✓"
}

# Configure webhooks
configure_webhooks() {
    log "Configuring webhooks and bot integrations..."
    
    # Wait for services to be ready
    info "Waiting for services to be ready..."
    sleep 30
    
    # Configure Telegram webhook
    if [[ -n "$TELEGRAM_BOT_TOKEN" && -n "$TELEGRAM_SERVICE_URL" ]]; then
        info "Configuring Telegram webhook..."
        curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
            -H "Content-Type: application/json" \
            -d "{
                \"url\": \"$TELEGRAM_SERVICE_URL/webhook/telegram\",
                \"secret_token\": \"$TELEGRAM_WEBHOOK_SECRET\",
                \"allowed_updates\": [\"message\", \"callback_query\", \"inline_query\"]
            }" && log "Telegram webhook configured ✓" || warning "Failed to configure Telegram webhook"
    fi
    
    # Deploy Discord slash commands
    if [[ -n "$DISCORD_TOKEN" && -n "$DISCORD_SERVICE_URL" ]]; then
        info "Deploying Discord slash commands..."
        cd gomflow-discord
        railway run npm run deploy:commands && log "Discord commands deployed ✓" || warning "Failed to deploy Discord commands"
        cd ..
    fi
    
    log "Webhook configuration completed ✓"
}

# Health checks
run_health_checks() {
    log "Running health checks..."
    
    # Wait for services to be fully ready
    sleep 60
    
    local failed_checks=()
    
    for service in "${MESSAGING_SERVICES[@]}"; do
        local service_url=""
        case $service in
            "gomflow-whatsapp")
                service_url="$WHATSAPP_SERVICE_URL"
                ;;
            "gomflow-telegram")
                service_url="$TELEGRAM_SERVICE_URL"
                ;;
            "gomflow-discord")
                service_url="$DISCORD_SERVICE_URL"
                ;;
        esac
        
        if [[ -n "$service_url" ]]; then
            info "Checking health of $service at $service_url..."
            if curl -f -s "$service_url/api/health" >/dev/null; then
                log "$service health check passed ✓"
            else
                error "$service health check failed"
                failed_checks+=("$service")
            fi
        else
            warning "No URL available for $service health check"
        fi
    done
    
    # Verify webhook configurations
    if [[ -n "$TELEGRAM_BOT_TOKEN" ]]; then
        info "Verifying Telegram webhook..."
        if curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo" | grep -q "\"url\":\"$TELEGRAM_SERVICE_URL"; then
            log "Telegram webhook verification passed ✓"
        else
            warning "Telegram webhook verification failed"
        fi
    fi
    
    if [[ ${#failed_checks[@]} -gt 0 ]]; then
        error "Health checks failed for: ${failed_checks[*]}"
        return 1
    fi
    
    log "All health checks passed ✓"
}

# Update core API with service URLs
update_core_api() {
    log "Updating core API with messaging service URLs..."
    
    # Update Vercel environment variables for core API
    if command -v vercel >/dev/null 2>&1; then
        cd gomflow-core
        
        if [[ -n "$WHATSAPP_SERVICE_URL" ]]; then
            vercel env add WHATSAPP_SERVICE_URL production <<< "$WHATSAPP_SERVICE_URL" || warning "Failed to update WHATSAPP_SERVICE_URL"
        fi
        
        if [[ -n "$TELEGRAM_SERVICE_URL" ]]; then
            vercel env add TELEGRAM_SERVICE_URL production <<< "$TELEGRAM_SERVICE_URL" || warning "Failed to update TELEGRAM_SERVICE_URL"
        fi
        
        if [[ -n "$DISCORD_SERVICE_URL" ]]; then
            vercel env add DISCORD_SERVICE_URL production <<< "$DISCORD_SERVICE_URL" || warning "Failed to update DISCORD_SERVICE_URL"
        fi
        
        cd ..
        log "Core API environment variables updated ✓"
    else
        warning "Vercel CLI not found - please manually update core API environment variables"
    fi
}

# Cleanup function
cleanup() {
    log "Cleaning up deployment artifacts..."
    
    # Remove any temporary files
    find . -name "*.log" -not -name "$DEPLOY_LOG" -delete 2>/dev/null || true
    
    log "Cleanup completed ✓"
}

# Main deployment function
main() {
    log "Starting GOMFLOW messaging services deployment to Railway..."
    log "Services to deploy: ${MESSAGING_SERVICES[*]}"
    log "Deployment log: $DEPLOY_LOG"
    
    # Record start time
    local start_time=$(date +%s)
    
    # Run deployment steps
    check_prerequisites
    validate_environment
    build_shared_module
    test_service_builds
    deploy_whatsapp_service
    deploy_telegram_service
    deploy_discord_service
    configure_webhooks
    run_health_checks
    update_core_api
    cleanup
    
    # Calculate deployment time
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log "🚀 GOMFLOW messaging services deployment completed successfully!"
    log "Deployment time: $(($duration / 60)) minutes and $(($duration % 60)) seconds"
    log "Deployment log saved to: $DEPLOY_LOG"
    
    # Display service URLs
    echo ""
    echo -e "${GREEN}🌐 Deployed Messaging Service URLs:${NC}"
    [[ -n "$WHATSAPP_SERVICE_URL" ]] && echo "   WhatsApp Service: $WHATSAPP_SERVICE_URL"
    [[ -n "$TELEGRAM_SERVICE_URL" ]] && echo "   Telegram Service: $TELEGRAM_SERVICE_URL"
    [[ -n "$DISCORD_SERVICE_URL" ]] && echo "   Discord Service: $DISCORD_SERVICE_URL"
    echo ""
    echo -e "${GREEN}🔧 Service Health Endpoints:${NC}"
    [[ -n "$WHATSAPP_SERVICE_URL" ]] && echo "   WhatsApp Health: $WHATSAPP_SERVICE_URL/api/health"
    [[ -n "$TELEGRAM_SERVICE_URL" ]] && echo "   Telegram Health: $TELEGRAM_SERVICE_URL/api/health"
    [[ -n "$DISCORD_SERVICE_URL" ]] && echo "   Discord Health: $DISCORD_SERVICE_URL/api/health"
    echo ""
    echo -e "${GREEN}📋 Next Steps:${NC}"
    echo "   1. Test bot commands in Telegram/Discord"
    echo "   2. Verify WhatsApp message delivery"
    echo "   3. Test payment screenshot processing"
    echo "   4. Monitor service logs in Railway dashboard"
    echo "   5. Set up monitoring alerts"
}

# Handle script interruption
trap 'error "Deployment interrupted"; cleanup; exit 1' INT TERM

# Check for help flag
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    echo "GOMFLOW Messaging Services Deployment Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help    Show this help message"
    echo ""
    echo "Required Environment Variables:"
    echo "  SUPABASE_URL                    Supabase project URL"
    echo "  SUPABASE_SERVICE_ROLE_KEY       Supabase service role key"
    echo "  SERVICE_SECRET                  Inter-service communication secret"
    echo ""
    echo "Optional Environment Variables:"
    echo "  TELEGRAM_BOT_TOKEN              Telegram bot token"
    echo "  TELEGRAM_WEBHOOK_SECRET         Telegram webhook secret"
    echo "  TWILIO_ACCOUNT_SID              Twilio account SID"
    echo "  TWILIO_AUTH_TOKEN               Twilio auth token"
    echo "  TWILIO_WHATSAPP_NUMBER          Twilio WhatsApp number"
    echo "  DISCORD_TOKEN                   Discord bot token"
    echo "  DISCORD_CLIENT_ID               Discord application client ID"
    echo ""
    echo "Prerequisites:"
    echo "  - Railway CLI installed and authenticated"
    echo "  - Docker installed"
    echo "  - Node.js and npm installed"
    echo "  - gomflow-shared module built"
    exit 0
fi

# Run main function
main "$@"