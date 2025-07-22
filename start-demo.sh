#!/bin/bash

# GOMFLOW Demo Environment Startup Script
# This script starts all services in demo mode with mock data

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEMO_LOG="demo-$(date +%Y%m%d-%H%M%S).log"

# Logging functions
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$DEMO_LOG"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$DEMO_LOG"
}

warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$DEMO_LOG"
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1${NC}" | tee -a "$DEMO_LOG"
}

# Banner
echo -e "${GREEN}"
echo "============================================"
echo "🎭 GOMFLOW DEMO ENVIRONMENT"
echo "============================================"
echo "Starting all services in demo mode..."
echo "All integrations are mocked for testing"
echo "============================================"
echo -e "${NC}"

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    command -v node >/dev/null 2>&1 || { error "Node.js is required but not installed. Aborting."; exit 1; }
    command -v npm >/dev/null 2>&1 || { error "npm is required but not installed. Aborting."; exit 1; }
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt "18" ]; then
        error "Node.js version 18+ is required. Found: $(node -v)"
        exit 1
    fi
    
    log "Prerequisites check passed ✓"
}

# Copy demo environment file
setup_environment() {
    log "Setting up demo environment..."
    
    if [ ! -f ".env.demo" ]; then
        error "Demo environment file not found!"
        exit 1
    fi
    
    cp .env.demo .env.local
    log "Demo environment configured ✓"
}

# Build shared module
build_shared_module() {
    log "Building shared module..."
    
    cd gomflow-shared
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    npm run build
    cd ..
    
    log "Shared module built ✓"
}

# Start services
start_service() {
    local service_name=$1
    local port=$2
    local service_dir=$3
    
    info "Starting $service_name on port $port..."
    
    if [ ! -d "$service_dir" ]; then
        warning "Service directory $service_dir not found, skipping..."
        return
    fi
    
    cd "$service_dir"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        npm install
        npm link ../gomflow-shared 2>/dev/null || true
    fi
    
    # Create logs directory
    mkdir -p logs
    
    # Start service in background
    PORT=$port DEMO_MODE=true npm run dev > "logs/$service_name-demo.log" 2>&1 &
    local pid=$!
    echo $pid > "logs/$service_name.pid"
    
    cd ..
    
    # Wait a moment and check if process is still running
    sleep 2
    if kill -0 $pid 2>/dev/null; then
        log "$service_name started successfully (PID: $pid)"
    else
        error "$service_name failed to start"
    fi
}

# Kill existing processes
cleanup_existing() {
    log "Cleaning up existing processes..."
    
    # Kill any existing GOMFLOW processes
    pkill -f "gomflow" 2>/dev/null || true
    
    # Clean up old PID files
    find . -name "*.pid" -delete 2>/dev/null || true
    
    log "Cleanup completed ✓"
}

# Main execution
main() {
    check_prerequisites
    cleanup_existing
    setup_environment
    build_shared_module
    
    log "Starting GOMFLOW services in demo mode..."
    
    # Start services with their respective ports
    start_service "gomflow-core" 3000 "gomflow-core"
    start_service "gomflow-whatsapp" 3001 "gomflow-whatsapp"
    start_service "gomflow-telegram" 3002 "gomflow-telegram"
    start_service "gomflow-discord" 3003 "gomflow-discord"
    start_service "gomflow-payments" 3004 "gomflow-payments"
    start_service "gomflow-smart-agent" 3005 "gomflow-smart-agent"
    start_service "gomflow-analytics" 3006 "gomflow-analytics"
    start_service "gomflow-monitoring" 3007 "gomflow-monitoring"
    start_service "gomflow-notifications" 3009 "gomflow-notifications"
    
    # Wait for services to start
    log "Waiting for services to initialize..."
    sleep 10
    
    # Display service status
    echo -e "\n${GREEN}============================================"
    echo "🎭 GOMFLOW DEMO SERVICES STARTED"
    echo "============================================${NC}"
    echo
    echo -e "${BLUE}📱 Web Application:${NC}"
    echo "   🌐 http://localhost:3000"
    echo
    echo -e "${BLUE}🤖 Bot Services:${NC}"
    echo "   📱 WhatsApp: http://localhost:3001/health"
    echo "   💬 Telegram: http://localhost:3002/health"
    echo "   🎮 Discord: http://localhost:3003/health"
    echo
    echo -e "${BLUE}💳 Backend Services:${NC}"
    echo "   💰 Payments: http://localhost:3004/health"
    echo "   🧠 Smart Agent: http://localhost:3005/health"
    echo "   📊 Analytics: http://localhost:3006/health"
    echo "   📈 Monitoring: http://localhost:3007/health"
    echo "   🔔 Notifications: http://localhost:3009/health"
    echo
    echo -e "${YELLOW}🎭 DEMO MODE FEATURES:${NC}"
    echo "   ✅ Mock payment processing (no real transactions)"
    echo "   ✅ Simulated bot responses"
    echo "   ✅ Demo data pre-loaded"
    echo "   ✅ All flows testable without API keys"
    echo
    echo -e "${GREEN}📋 TEST SCENARIOS:${NC}"
    echo "   1. Create a new group order"
    echo "   2. Submit an order as a buyer"
    echo "   3. Upload payment proof (any image)"
    echo "   4. Test bot interactions (simulated)"
    echo "   5. View analytics and reports"
    echo "   6. Try collaboration features"
    echo
    echo -e "${BLUE}🛑 To stop all services:${NC}"
    echo "   ./stop-demo.sh"
    echo
    echo -e "${GREEN}============================================"
    echo "🎉 DEMO ENVIRONMENT READY!"
    echo "============================================${NC}"
    echo
    
    # Log locations
    info "Service logs are available in:"
    find . -name "*-demo.log" -path "*/logs/*" | while read -r log_file; do
        echo "   📄 $log_file"
    done
    
    # Keep the script running to show logs
    echo -e "\n${YELLOW}Press Ctrl+C to view live logs from all services...${NC}"
    read -p "Press Enter to continue..."
    
    echo -e "\n${GREEN}📊 LIVE SERVICE LOGS:${NC}"
    echo "=================================="
    
    # Tail all service logs
    find . -name "*-demo.log" -path "*/logs/*" -exec tail -f {} + 2>/dev/null || {
        warning "No logs found yet. Services may still be starting..."
        sleep 5
        find . -name "*-demo.log" -path "*/logs/*" -exec tail -f {} + 2>/dev/null || true
    }
}

# Handle interruption
trap 'echo -e "\n${YELLOW}Demo environment is still running in the background.${NC}"; echo "Use ./stop-demo.sh to stop all services."; exit 0' INT

# Run main function
main