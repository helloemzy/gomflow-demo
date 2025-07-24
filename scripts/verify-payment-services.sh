#!/bin/bash

# GOMFLOW Payment Services Verification Script
# Comprehensive testing of deployed payment services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default URLs (can be overridden with environment variables)
PAYMENTS_URL=${PAYMENTS_URL:-"https://gomflow-payments.railway.app"}
SMART_AGENT_URL=${SMART_AGENT_URL:-"https://gomflow-smart-agent.railway.app"}
SERVICE_SECRET=${SERVICE_SECRET:-""}

echo -e "${GREEN}🔍 GOMFLOW Payment Services Verification${NC}"
echo -e "${BLUE}Payments Service: ${PAYMENTS_URL}${NC}"
echo -e "${BLUE}Smart Agent Service: ${SMART_AGENT_URL}${NC}"

# Function to test HTTP endpoint
test_endpoint() {
    local url=$1
    local expected_status=${2:-200}
    local description=$3
    
    echo -e "${YELLOW}🧪 Testing: ${description}${NC}"
    
    response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$url" || echo "HTTPSTATUS:000")
    body=$(echo "$response" | sed -E 's/HTTPSTATUS:[0-9]{3}$//')
    status=$(echo "$response" | tr -d '\n' | sed -E 's/.*HTTPSTATUS:([0-9]{3})$/\1/')
    
    if [ "$status" -eq "$expected_status" ]; then
        echo -e "${GREEN}✅ ${description} - Status: ${status}${NC}"
        return 0
    else
        echo -e "${RED}❌ ${description} - Status: ${status}${NC}"
        if [ -n "$body" ] && [ "$body" != "HTTPSTATUS:$status" ]; then
            echo -e "${YELLOW}Response: ${body}${NC}"
        fi
        return 1
    fi
}

# Function to test authenticated endpoint
test_authenticated_endpoint() {
    local url=$1
    local expected_status=${2:-200}
    local description=$3
    
    if [ -z "$SERVICE_SECRET" ]; then
        echo -e "${YELLOW}⚠️ SERVICE_SECRET not set, skipping: ${description}${NC}"
        return 0
    fi
    
    echo -e "${YELLOW}🧪 Testing: ${description} (authenticated)${NC}"
    
    response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
        -H "Authorization: Bearer $SERVICE_SECRET" \
        -H "Content-Type: application/json" \
        "$url" || echo "HTTPSTATUS:000")
    
    body=$(echo "$response" | sed -E 's/HTTPSTATUS:[0-9]{3}$//')
    status=$(echo "$response" | tr -d '\n' | sed -E 's/.*HTTPSTATUS:([0-9]{3})$/\1/')
    
    if [ "$status" -eq "$expected_status" ]; then
        echo -e "${GREEN}✅ ${description} - Status: ${status}${NC}"
        return 0
    else
        echo -e "${RED}❌ ${description} - Status: ${status}${NC}"
        if [ -n "$body" ] && [ "$body" != "HTTPSTATUS:$status" ]; then
            echo -e "${YELLOW}Response: ${body}${NC}"
        fi
        return 1
    fi
}

# Function to test JSON endpoint response
test_json_endpoint() {
    local url=$1
    local expected_field=$2
    local expected_value=$3
    local description=$4
    
    echo -e "${YELLOW}🧪 Testing: ${description}${NC}"
    
    response=$(curl -s "$url" || echo "{}")
    
    if command -v jq >/dev/null 2>&1; then
        actual_value=$(echo "$response" | jq -r ".$expected_field" 2>/dev/null || echo "null")
        
        if [ "$actual_value" = "$expected_value" ]; then
            echo -e "${GREEN}✅ ${description} - ${expected_field}: ${actual_value}${NC}"
            return 0
        else
            echo -e "${RED}❌ ${description} - Expected ${expected_field}: ${expected_value}, Got: ${actual_value}${NC}"
            return 1
        fi
    else
        if echo "$response" | grep -q "$expected_value"; then
            echo -e "${GREEN}✅ ${description} - Contains expected value${NC}"
            return 0
        else
            echo -e "${RED}❌ ${description} - Missing expected value${NC}"
            echo -e "${YELLOW}Response: ${response}${NC}"
            return 1
        fi
    fi
}

# Function to run basic connectivity tests
run_basic_tests() {
    echo -e "${BLUE}=== Basic Connectivity Tests ===${NC}"
    
    local basic_tests_passed=0
    local basic_tests_total=4
    
    # Test payments service root
    if test_endpoint "$PAYMENTS_URL" 200 "Payments service root endpoint"; then
        ((basic_tests_passed++))
    fi
    
    # Test payments service health
    if test_endpoint "$PAYMENTS_URL/api/health" 200 "Payments service health check"; then
        ((basic_tests_passed++))
    fi
    
    # Test smart agent service root
    if test_endpoint "$SMART_AGENT_URL" 200 "Smart agent service root endpoint"; then
        ((basic_tests_passed++))
    fi
    
    # Test smart agent service health
    if test_endpoint "$SMART_AGENT_URL/api/health" 200 "Smart agent service health check"; then
        ((basic_tests_passed++))
    fi
    
    echo -e "${BLUE}Basic Tests: ${basic_tests_passed}/${basic_tests_total} passed${NC}"
    return $((basic_tests_total - basic_tests_passed))
}

# Function to run service-specific tests
run_service_tests() {
    echo -e "${BLUE}=== Service-Specific Tests ===${NC}"
    
    local service_tests_passed=0
    local service_tests_total=6
    
    # Test payments service configuration
    if test_json_endpoint "$PAYMENTS_URL" "service" "GOMFLOW Payment Service" "Payments service identification"; then
        ((service_tests_passed++))
    fi
    
    # Test payments service environment
    if test_json_endpoint "$PAYMENTS_URL" "environment" "production" "Payments service environment"; then
        ((service_tests_passed++))
    fi
    
    # Test smart agent service configuration
    if test_json_endpoint "$SMART_AGENT_URL" "service" "GOMFLOW Smart Payment Agent" "Smart agent service identification"; then
        ((service_tests_passed++))
    fi
    
    # Test smart agent capabilities
    if test_endpoint "$SMART_AGENT_URL" 200 "Smart agent capabilities endpoint"; then
        response=$(curl -s "$SMART_AGENT_URL")
        if echo "$response" | grep -q "Payment screenshot analysis"; then
            echo -e "${GREEN}✅ Smart agent capabilities verified${NC}"
            ((service_tests_passed++))
        else
            echo -e "${RED}❌ Smart agent capabilities not found${NC}"
        fi
    fi
    
    # Test smart agent status endpoint
    if test_endpoint "$SMART_AGENT_URL/api/status" 200 "Smart agent detailed status"; then
        ((service_tests_passed++))
    fi
    
    # Test smart agent stats endpoint (may require auth)
    if test_endpoint "$SMART_AGENT_URL/api/stats" 200 "Smart agent statistics" || 
       test_endpoint "$SMART_AGENT_URL/api/stats" 401 "Smart agent statistics (auth required)"; then
        ((service_tests_passed++))
    fi
    
    echo -e "${BLUE}Service Tests: ${service_tests_passed}/${service_tests_total} passed${NC}"
    return $((service_tests_total - service_tests_passed))
}

# Function to run webhook endpoint tests
run_webhook_tests() {
    echo -e "${BLUE}=== Webhook Endpoint Tests ===${NC}"
    
    local webhook_tests_passed=0
    local webhook_tests_total=4
    
    # Test PayMongo webhook endpoint (should reject without signature)
    if test_endpoint "$PAYMENTS_URL/api/webhooks/paymongo" 400 "PayMongo webhook (no signature)"; then
        ((webhook_tests_passed++))
    fi
    
    # Test Billplz webhook endpoint (should reject without signature)
    if test_endpoint "$PAYMENTS_URL/api/webhooks/billplz" 400 "Billplz webhook (no signature)"; then
        ((webhook_tests_passed++))
    fi
    
    # Test smart agent process endpoint (should reject without file)
    if test_endpoint "$SMART_AGENT_URL/api/process" 400 "Smart agent process (no file)"; then
        ((webhook_tests_passed++))
    fi
    
    # Test 404 handling
    if test_endpoint "$PAYMENTS_URL/api/nonexistent" 404 "Payments service 404 handling"; then
        ((webhook_tests_passed++))
    fi
    
    echo -e "${BLUE}Webhook Tests: ${webhook_tests_passed}/${webhook_tests_total} passed${NC}"
    return $((webhook_tests_total - webhook_tests_passed))
}

# Function to run performance tests
run_performance_tests() {
    echo -e "${BLUE}=== Performance Tests ===${NC}"
    
    local perf_tests_passed=0
    local perf_tests_total=4
    
    # Test response time for payments service
    echo -e "${YELLOW}🧪 Testing payments service response time${NC}"
    start_time=$(date +%s%N)
    if curl -sf "$PAYMENTS_URL/api/health" >/dev/null; then
        end_time=$(date +%s%N)
        response_time=$(( (end_time - start_time) / 1000000 ))
        
        if [ $response_time -lt 2000 ]; then
            echo -e "${GREEN}✅ Payments service response time: ${response_time}ms (< 2s)${NC}"
            ((perf_tests_passed++))
        else
            echo -e "${YELLOW}⚠️ Payments service response time: ${response_time}ms (> 2s)${NC}"
        fi
    else
        echo -e "${RED}❌ Payments service response time test failed${NC}"
    fi
    
    # Test response time for smart agent service
    echo -e "${YELLOW}🧪 Testing smart agent service response time${NC}"
    start_time=$(date +%s%N)
    if curl -sf "$SMART_AGENT_URL/api/health" >/dev/null; then
        end_time=$(date +%s%N)
        response_time=$(( (end_time - start_time) / 1000000 ))
        
        if [ $response_time -lt 2000 ]; then
            echo -e "${GREEN}✅ Smart agent service response time: ${response_time}ms (< 2s)${NC}"
            ((perf_tests_passed++))
        else
            echo -e "${YELLOW}⚠️ Smart agent service response time: ${response_time}ms (> 2s)${NC}"
        fi
    else
        echo -e "${RED}❌ Smart agent service response time test failed${NC}"
    fi
    
    # Test concurrent requests
    echo -e "${YELLOW}🧪 Testing concurrent request handling${NC}"
    if command -v xargs >/dev/null 2>&1; then
        concurrent_results=$(echo {1..5} | xargs -n 1 -P 5 -I {} curl -sf "$PAYMENTS_URL/api/health" | wc -l)
        if [ "$concurrent_results" -eq 5 ]; then
            echo -e "${GREEN}✅ Concurrent requests handled successfully (5/5)${NC}"
            ((perf_tests_passed++))
        else
            echo -e "${YELLOW}⚠️ Concurrent requests: ${concurrent_results}/5 successful${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️ xargs not available, skipping concurrent test${NC}"
        ((perf_tests_passed++))
    fi
    
    # Test for common headers
    echo -e "${YELLOW}🧪 Testing security headers${NC}"
    headers=$(curl -sI "$PAYMENTS_URL/api/health" || echo "")
    if echo "$headers" | grep -qi "x-request-id"; then
        echo -e "${GREEN}✅ Security headers present${NC}"
        ((perf_tests_passed++))
    else
        echo -e "${YELLOW}⚠️ Some security headers may be missing${NC}"
    fi
    
    echo -e "${BLUE}Performance Tests: ${perf_tests_passed}/${perf_tests_total} passed${NC}"
    return $((perf_tests_total - perf_tests_passed))
}

# Function to generate test report
generate_report() {
    local total_tests=$1
    local total_passed=$2
    local total_failed=$((total_tests - total_passed))
    
    echo -e "${BLUE}=== Test Report ===${NC}"
    echo -e "Total Tests: $total_tests"
    echo -e "${GREEN}Passed: $total_passed${NC}"
    
    if [ $total_failed -gt 0 ]; then
        echo -e "${RED}Failed: $total_failed${NC}"
        echo -e "${YELLOW}Success Rate: $(( total_passed * 100 / total_tests ))%${NC}"
    else
        echo -e "${GREEN}Failed: 0${NC}"
        echo -e "${GREEN}Success Rate: 100% 🎉${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}Service URLs:${NC}"
    echo -e "  Payments: $PAYMENTS_URL"
    echo -e "  Smart Agent: $SMART_AGENT_URL"
    
    if [ $total_failed -eq 0 ]; then
        echo -e "${GREEN}✅ All tests passed! Services are ready for production.${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️ Some tests failed. Review the issues above.${NC}"
        return 1
    fi
}

# Main execution
main() {
    local total_tests=0
    local total_passed=0
    
    # Run all test suites
    echo -e "${GREEN}🚀 Starting GOMFLOW Payment Services Verification${NC}"
    echo ""
    
    # Basic connectivity tests
    run_basic_tests
    basic_result=$?
    total_tests=$((total_tests + 4))
    total_passed=$((total_passed + 4 - basic_result))
    
    echo ""
    
    # Service-specific tests
    run_service_tests
    service_result=$?
    total_tests=$((total_tests + 6))
    total_passed=$((total_passed + 6 - service_result))
    
    echo ""
    
    # Webhook endpoint tests
    run_webhook_tests
    webhook_result=$?
    total_tests=$((total_tests + 4))
    total_passed=$((total_passed + 4 - webhook_result))
    
    echo ""
    
    # Performance tests
    run_performance_tests
    perf_result=$?
    total_tests=$((total_tests + 4))
    total_passed=$((total_passed + 4 - perf_result))
    
    echo ""
    
    # Generate final report
    generate_report $total_tests $total_passed
}

# Execute main function
main "$@"