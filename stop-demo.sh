#!/bin/bash

# GOMFLOW Demo Environment Stop Script
# This script stops all demo services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}"
echo "============================================"
echo "🛑 STOPPING GOMFLOW DEMO ENVIRONMENT"
echo "============================================"
echo -e "${NC}"

# Function to stop service by PID file
stop_service() {
    local service_name=$1
    local service_dir=$2
    local pid_file="$service_dir/logs/$service_name.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 $pid 2>/dev/null; then
            echo -e "${YELLOW}Stopping $service_name (PID: $pid)...${NC}"
            kill $pid 2>/dev/null || true
            
            # Wait for graceful shutdown
            local count=0
            while kill -0 $pid 2>/dev/null && [ $count -lt 10 ]; do
                sleep 1
                ((count++))
            done
            
            # Force kill if still running
            if kill -0 $pid 2>/dev/null; then
                echo -e "${RED}Force stopping $service_name...${NC}"
                kill -9 $pid 2>/dev/null || true
            fi
            
            echo -e "${GREEN}✓ $service_name stopped${NC}"
        else
            echo -e "${YELLOW}$service_name was not running${NC}"
        fi
        rm -f "$pid_file"
    else
        echo -e "${YELLOW}No PID file found for $service_name${NC}"
    fi
}

# Stop all services
stop_service "gomflow-core" "gomflow-core"
stop_service "gomflow-whatsapp" "gomflow-whatsapp"
stop_service "gomflow-telegram" "gomflow-telegram"
stop_service "gomflow-discord" "gomflow-discord"
stop_service "gomflow-payments" "gomflow-payments"
stop_service "gomflow-smart-agent" "gomflow-smart-agent"
stop_service "gomflow-analytics" "gomflow-analytics"
stop_service "gomflow-monitoring" "gomflow-monitoring"
stop_service "gomflow-notifications" "gomflow-notifications"

# Kill any remaining GOMFLOW processes
echo -e "${YELLOW}Cleaning up any remaining processes...${NC}"
pkill -f "gomflow" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
pkill -f "nodemon" 2>/dev/null || true

# Clean up
echo -e "${YELLOW}Cleaning up temporary files...${NC}"
find . -name "*.pid" -delete 2>/dev/null || true
rm -f .env.local 2>/dev/null || true

echo -e "\n${GREEN}"
echo "============================================"
echo "✅ GOMFLOW DEMO ENVIRONMENT STOPPED"
echo "============================================"
echo -e "${NC}"
echo -e "${YELLOW}All services have been stopped.${NC}"
echo -e "${GREEN}To start demo again: ./start-demo.sh${NC}"
echo