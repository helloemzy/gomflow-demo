#!/bin/bash

# GOMFLOW Load Balancer Setup Script
# This script configures load balancing for GOMFLOW microservices

set -e

echo "🚀 Setting up GOMFLOW Load Balancer Configuration"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo -e "${RED}❌ Railway CLI is not installed${NC}"
    echo "Please install Railway CLI: https://docs.railway.app/cli/installation"
    exit 1
fi

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${RED}❌ Vercel CLI is not installed${NC}"
    echo "Please install Vercel CLI: npm i -g vercel"
    exit 1
fi

echo -e "${GREEN}✅ Required CLIs are installed${NC}"

# Function to setup Railway service scaling
setup_railway_service() {
    local service_name=$1
    local service_path=$2
    local max_replicas=${3:-3}
    local cpu_limit=${4:-1000m}
    local memory_limit=${5:-1GB}
    
    echo -e "${YELLOW}📦 Configuring ${service_name} service...${NC}"
    
    cd "${service_path}"
    
    # Check if railway.json exists
    if [ ! -f "railway.json" ]; then
        echo -e "${RED}❌ railway.json not found in ${service_path}${NC}"
        return 1
    fi
    
    # Update railway.json with load balancing config
    cat > railway.json << EOF
{
  "\$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "numReplicas": 2,
    "restartPolicyType": "ON_FAILURE",
    "sleepApplication": false,
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 30,
    "healthcheckInterval": 10,
    "startCommand": "npm run start:prod",
    "resources": {
      "memoryLimit": "${memory_limit}",
      "cpuLimit": "${cpu_limit}"
    },
    "autoscaling": {
      "enabled": true,
      "minReplicas": 1,
      "maxReplicas": ${max_replicas},
      "targetCPUUtilization": 70,
      "targetMemoryUtilization": 80
    }
  },
  "environments": {
    "production": {
      "variables": {
        "NODE_ENV": "production",
        "PORT": "3000"
      }
    },
    "staging": {
      "variables": {
        "NODE_ENV": "staging",
        "PORT": "3000"
      }
    }
  }
}
EOF
    
    echo -e "${GREEN}✅ ${service_name} configuration updated${NC}"
    cd - > /dev/null
}

# Function to setup Vercel edge functions
setup_vercel_optimization() {
    echo -e "${YELLOW}⚡ Configuring Vercel edge functions...${NC}"
    
    cd gomflow-core
    
    # Ensure vercel.json is optimized
    if [ -f "vercel.json" ]; then
        echo -e "${GREEN}✅ Vercel configuration found${NC}"
        
        # Add edge function configuration
        cat > src/middleware.ts << 'EOF'
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Add performance headers
  response.headers.set('X-Response-Time', Date.now().toString());
  response.headers.set('X-Region', process.env.VERCEL_REGION || 'unknown');
  
  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // Add cache headers for static assets
  if (request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
  }
  
  return response;
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
EOF
        
        echo -e "${GREEN}✅ Vercel middleware configured${NC}"
    else
        echo -e "${RED}❌ vercel.json not found${NC}"
        return 1
    fi
    
    cd - > /dev/null
}

# Function to create monitoring dashboard
setup_monitoring() {
    echo -e "${YELLOW}📊 Setting up monitoring dashboard...${NC}"
    
    cat > monitoring/load-balancer-config.json << 'EOF'
{
  "services": {
    "core": {
      "platform": "vercel",
      "regions": ["sin1", "hkg1", "syd1"],
      "healthcheck": "https://gomflow.com/api/health",
      "metrics": "https://gomflow.com/api/health/metrics"
    },
    "whatsapp": {
      "platform": "railway",
      "replicas": 2,
      "healthcheck": "${WHATSAPP_SERVICE_URL}/api/health",
      "scaling": {
        "min": 1,
        "max": 3,
        "cpu": 70,
        "memory": 80
      }
    },
    "telegram": {
      "platform": "railway",
      "replicas": 2,
      "healthcheck": "${TELEGRAM_SERVICE_URL}/api/health",
      "scaling": {
        "min": 1,
        "max": 3,
        "cpu": 70,
        "memory": 80
      }
    },
    "discord": {
      "platform": "railway",
      "replicas": 2,
      "healthcheck": "${DISCORD_SERVICE_URL}/api/health",
      "scaling": {
        "min": 1,
        "max": 5,
        "cpu": 70,
        "memory": 80
      }
    },
    "payments": {
      "platform": "railway",
      "replicas": 2,
      "healthcheck": "${PAYMENTS_SERVICE_URL}/api/health",
      "scaling": {
        "min": 1,
        "max": 4,
        "cpu": 70,
        "memory": 80
      }
    },
    "smart-agent": {
      "platform": "railway",
      "replicas": 2,
      "healthcheck": "${SMART_AGENT_SERVICE_URL}/api/health",
      "scaling": {
        "min": 1,
        "max": 3,
        "cpu": 70,
        "memory": 80
      }
    }
  },
  "monitoring": {
    "intervals": {
      "healthcheck": 30,
      "metrics": 300
    },
    "thresholds": {
      "responseTime": 5000,
      "errorRate": 5.0,
      "cpuUtilization": 80,
      "memoryUtilization": 85
    }
  }
}
EOF
    
    echo -e "${GREEN}✅ Monitoring configuration created${NC}"
}

# Function to create health check script
create_health_check_script() {
    echo -e "${YELLOW}🏥 Creating health check script...${NC}"
    
    cat > scripts/health-check.sh << 'EOF'
#!/bin/bash

# GOMFLOW Health Check Script
# Checks all services and reports status

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Service URLs
CORE_URL="https://gomflow.com"
WHATSAPP_URL="${WHATSAPP_SERVICE_URL:-http://localhost:3001}"
TELEGRAM_URL="${TELEGRAM_SERVICE_URL:-http://localhost:3002}"
DISCORD_URL="${DISCORD_SERVICE_URL:-http://localhost:3003}"
PAYMENTS_URL="${PAYMENTS_SERVICE_URL:-http://localhost:3004}"
SMART_AGENT_URL="${SMART_AGENT_SERVICE_URL:-http://localhost:3005}"

# Function to check service health
check_service() {
    local service_name=$1
    local service_url=$2
    
    echo -n "Checking ${service_name}... "
    
    if curl -s -f -m 10 "${service_url}/api/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Healthy${NC}"
        return 0
    else
        echo -e "${RED}❌ Unhealthy${NC}"
        return 1
    fi
}

# Main health check
echo "🏥 GOMFLOW Health Check Report"
echo "=============================="
echo "Timestamp: $(date)"
echo

# Check all services
services=(
    "Core API:$CORE_URL"
    "WhatsApp Service:$WHATSAPP_URL"
    "Telegram Service:$TELEGRAM_URL"
    "Discord Service:$DISCORD_URL"
    "Payments Service:$PAYMENTS_URL"
    "Smart Agent:$SMART_AGENT_URL"
)

healthy_count=0
total_count=${#services[@]}

for service in "${services[@]}"; do
    IFS=':' read -r name url <<< "$service"
    if check_service "$name" "$url"; then
        ((healthy_count++))
    fi
done

echo
echo "Summary: ${healthy_count}/${total_count} services healthy"

if [ $healthy_count -eq $total_count ]; then
    echo -e "${GREEN}🎉 All services are healthy!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Some services are unhealthy${NC}"
    exit 1
fi
EOF
    
    chmod +x scripts/health-check.sh
    echo -e "${GREEN}✅ Health check script created${NC}"
}

# Main execution
main() {
    echo "Starting load balancer setup..."
    
    # Setup Vercel optimization
    setup_vercel_optimization
    
    # Setup Railway services
    setup_railway_service "WhatsApp" "gomflow-whatsapp" 3 "500m" "512MB"
    setup_railway_service "Telegram" "gomflow-telegram" 3 "500m" "512MB"
    setup_railway_service "Discord" "gomflow-discord" 5 "1000m" "1GB"
    setup_railway_service "Payments" "gomflow-payments" 4 "1000m" "1GB"
    setup_railway_service "Smart Agent" "gomflow-smart-agent" 3 "2000m" "2GB"
    
    # Setup monitoring
    setup_monitoring
    
    # Create health check script
    create_health_check_script
    
    echo
    echo -e "${GREEN}🎉 Load balancer setup completed!${NC}"
    echo
    echo "Next steps:"
    echo "1. Deploy services: ./scripts/deploy-production.sh"
    echo "2. Test health checks: ./scripts/health-check.sh"
    echo "3. Monitor performance: Check monitoring/load-balancer-config.json"
    echo
    echo "Load balancing features configured:"
    echo "• Auto-scaling enabled for all services"
    echo "• Health checks configured (30s intervals)"
    echo "• Resource limits set per service"
    echo "• Monitoring dashboard ready"
    echo "• Performance optimizations applied"
}

# Run main function
main "$@"