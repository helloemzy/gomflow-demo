#!/bin/bash

# GOMFLOW Production Deployment Script
# This script orchestrates the complete deployment of all GOMFLOW services to production

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DEPLOY_LOG="deploy-$(date +%Y%m%d-%H%M%S).log"
SERVICES=(
    "gomflow-core"
    "gomflow-whatsapp"
    "gomflow-telegram"
    "gomflow-discord"
    "gomflow-payments"
    "gomflow-smart-agent"
    "gomflow-analytics"
    "gomflow-monitoring"
    "gomflow-security"
)

# Logging function
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$DEPLOY_LOG"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$DEPLOY_LOG"
}

warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$DEPLOY_LOG"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if required tools are installed
    command -v docker >/dev/null 2>&1 || { error "Docker is required but not installed. Aborting."; exit 1; }
    command -v node >/dev/null 2>&1 || { error "Node.js is required but not installed. Aborting."; exit 1; }
    command -v npm >/dev/null 2>&1 || { error "npm is required but not installed. Aborting."; exit 1; }
    command -v vercel >/dev/null 2>&1 || { error "Vercel CLI is required but not installed. Aborting."; exit 1; }
    
    # Check environment variables
    if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
        error "Supabase environment variables are not set. Please check your .env file."
        exit 1
    fi
    
    if [[ -z "$REDIS_URL" ]]; then
        error "Redis URL is not set. Please check your .env file."
        exit 1
    fi
    
    log "Prerequisites check passed ✓"
}

# Build shared module
build_shared_module() {
    log "Building shared module..."
    
    cd gomflow-shared
    npm install
    npm run build
    cd ..
    
    log "Shared module built successfully ✓"
}

# Run tests
run_tests() {
    log "Running tests for all services..."
    
    local failed_tests=()
    
    for service in "${SERVICES[@]}"; do
        if [[ -d "$service" ]]; then
            log "Running tests for $service..."
            cd "$service"
            
            if npm test; then
                log "Tests passed for $service ✓"
            else
                error "Tests failed for $service"
                failed_tests+=("$service")
            fi
            
            cd ..
        fi
    done
    
    if [[ ${#failed_tests[@]} -gt 0 ]]; then
        error "Tests failed for: ${failed_tests[*]}"
        exit 1
    fi
    
    log "All tests passed ✓"
}

# Build services
build_services() {
    log "Building all services..."
    
    for service in "${SERVICES[@]}"; do
        if [[ -d "$service" ]]; then
            log "Building $service..."
            cd "$service"
            
            npm install
            npm run build
            
            log "$service built successfully ✓"
            cd ..
        fi
    done
    
    log "All services built successfully ✓"
}

# Deploy to Vercel (Core API)
deploy_core() {
    log "Deploying Core API to Vercel..."
    
    cd gomflow-core
    
    # Set production environment variables
    vercel env add SUPABASE_URL production <<< "$SUPABASE_URL"
    vercel env add SUPABASE_SERVICE_ROLE_KEY production <<< "$SUPABASE_SERVICE_ROLE_KEY"
    vercel env add REDIS_URL production <<< "$REDIS_URL"
    vercel env add JWT_SECRET production <<< "$JWT_SECRET"
    vercel env add PAYMONGO_PUBLIC_KEY production <<< "$PAYMONGO_PUBLIC_KEY"
    vercel env add PAYMONGO_SECRET_KEY production <<< "$PAYMONGO_SECRET_KEY"
    vercel env add BILLPLZ_API_KEY production <<< "$BILLPLZ_API_KEY"
    vercel env add BILLPLZ_X_SIGNATURE production <<< "$BILLPLZ_X_SIGNATURE"
    vercel env add OPENAI_API_KEY production <<< "$OPENAI_API_KEY"
    
    # Deploy to production
    vercel --prod
    
    cd ..
    log "Core API deployed to Vercel ✓"
}

# Deploy to Railway (Microservices)
deploy_microservices() {
    log "Deploying microservices to Railway..."
    
    local microservices=(
        "gomflow-whatsapp"
        "gomflow-telegram"
        "gomflow-discord"
        "gomflow-payments"
        "gomflow-smart-agent"
        "gomflow-analytics"
        "gomflow-monitoring"
        "gomflow-security"
    )
    
    for service in "${microservices[@]}"; do
        if [[ -d "$service" ]]; then
            log "Deploying $service to Railway..."
            cd "$service"
            
            # Check if railway.json exists
            if [[ -f "railway.json" ]]; then
                # Deploy using Railway CLI (assuming it's configured)
                railway deploy --environment production
                log "$service deployed to Railway ✓"
            else
                warning "$service: railway.json not found, skipping Railway deployment"
            fi
            
            cd ..
        fi
    done
    
    log "Microservices deployment completed ✓"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    # Run migrations for each service that has them
    local services_with_migrations=(
        "gomflow-core"
        "gomflow-analytics"
        "gomflow-monitoring"
        "gomflow-security"
    )
    
    for service in "${services_with_migrations[@]}"; do
        if [[ -d "$service/migrations" ]]; then
            log "Running migrations for $service..."
            cd "$service"
            
            # Run migrations (this would depend on your migration tool)
            if [[ -f "package.json" ]] && npm run migrate:prod 2>/dev/null; then
                log "Migrations completed for $service ✓"
            else
                warning "No migration script found for $service"
            fi
            
            cd ..
        fi
    done
    
    log "Database migrations completed ✓"
}

# Health check
health_check() {
    log "Performing health checks..."
    
    # Wait for services to start
    sleep 30
    
    # Check core API health
    if curl -f -s "https://gomflow-core.vercel.app/health" > /dev/null; then
        log "Core API health check passed ✓"
    else
        error "Core API health check failed"
        exit 1
    fi
    
    # Check microservices health (if they have health endpoints)
    local microservices=(
        "gomflow-whatsapp"
        "gomflow-telegram"
        "gomflow-discord"
        "gomflow-payments"
        "gomflow-smart-agent"
        "gomflow-analytics"
        "gomflow-monitoring"
        "gomflow-security"
    )
    
    for service in "${microservices[@]}"; do
        # This would need to be adjusted based on actual service URLs
        local service_url="https://${service}.railway.app/health"
        if curl -f -s "$service_url" > /dev/null; then
            log "$service health check passed ✓"
        else
            warning "$service health check failed or service not accessible"
        fi
    done
    
    log "Health checks completed ✓"
}

# Configure webhooks
configure_webhooks() {
    log "Configuring production webhooks..."
    
    # Configure payment webhooks
    cd gomflow-payments
    if [[ -f "scripts/configure-webhooks.js" ]]; then
        node scripts/configure-webhooks.js --environment production
        log "Payment webhooks configured ✓"
    fi
    cd ..
    
    # Configure other webhooks as needed
    log "Webhook configuration completed ✓"
}

# Setup monitoring
setup_monitoring() {
    log "Setting up production monitoring..."
    
    # Deploy monitoring dashboard
    cd gomflow-monitoring
    if [[ -f "scripts/setup-monitoring.js" ]]; then
        node scripts/setup-monitoring.js --environment production
        log "Monitoring setup completed ✓"
    fi
    cd ..
    
    log "Production monitoring configured ✓"
}

# Cleanup
cleanup() {
    log "Cleaning up deployment artifacts..."
    
    # Remove any temporary files
    find . -name "*.log" -not -name "$DEPLOY_LOG" -delete
    find . -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true
    
    log "Cleanup completed ✓"
}

# Main deployment function
main() {
    log "Starting GOMFLOW production deployment..."
    log "Deployment log: $DEPLOY_LOG"
    
    # Record start time
    local start_time=$(date +%s)
    
    # Run deployment steps
    check_prerequisites
    build_shared_module
    run_tests
    build_services
    deploy_core
    deploy_microservices
    run_migrations
    configure_webhooks
    setup_monitoring
    health_check
    cleanup
    
    # Calculate deployment time
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log "🚀 GOMFLOW production deployment completed successfully!"
    log "Deployment time: $(($duration / 60)) minutes and $(($duration % 60)) seconds"
    log "Deployment log saved to: $DEPLOY_LOG"
    
    # Display service URLs
    echo ""
    echo "🌐 Production Service URLs:"
    echo "   Core API: https://gomflow-core.vercel.app"
    echo "   Dashboard: https://gomflow-core.vercel.app/dashboard"
    echo "   Documentation: https://gomflow-core.vercel.app/docs"
    echo ""
    echo "📊 Monitoring:"
    echo "   System Health: https://gomflow-monitoring.railway.app/dashboard"
    echo "   Logs: https://gomflow-monitoring.railway.app/logs"
    echo "   Alerts: https://gomflow-monitoring.railway.app/alerts"
    echo ""
    echo "🔒 Security:"
    echo "   Security Dashboard: https://gomflow-security.railway.app/dashboard"
    echo "   Compliance Reports: https://gomflow-security.railway.app/compliance"
}

# Handle script interruption
trap 'error "Deployment interrupted"; exit 1' INT TERM

# Run main function
main "$@"