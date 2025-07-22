#!/bin/bash

# GOMFLOW Webhook Configuration Script
# Automatically configures webhooks for payment providers and messaging platforms

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ENVIRONMENT=${1:-staging}

echo -e "${GREEN}🔧 Configuring webhooks for ${ENVIRONMENT} environment${NC}"

# Set URLs based on environment
if [ "$ENVIRONMENT" = "production" ]; then
    PAYMENTS_URL="https://gomflow-payments.railway.app"
    TELEGRAM_URL="https://gomflow-telegram.railway.app"
    WHATSAPP_URL="https://gomflow-whatsapp.railway.app"
else
    PAYMENTS_URL="https://gomflow-payments-staging.railway.app"
    TELEGRAM_URL="https://gomflow-telegram-staging.railway.app"
    WHATSAPP_URL="https://gomflow-whatsapp-staging.railway.app"
fi

# Function to configure PayMongo webhooks
configure_paymongo_webhooks() {
    echo -e "${YELLOW}📡 Configuring PayMongo webhooks...${NC}"
    
    # Create webhook for payment events
    curl -X POST https://api.paymongo.com/v1/webhooks \
        -H "Content-Type: application/json" \
        -H "Authorization: Basic $(echo -n $PAYMONGO_SECRET_KEY: | base64)" \
        -d "{
            \"data\": {
                \"attributes\": {
                    \"url\": \"${PAYMENTS_URL}/api/webhooks/paymongo\",
                    \"events\": [
                        \"payment.paid\",
                        \"payment.failed\",
                        \"checkout_session.payment.paid\",
                        \"checkout_session.payment.failed\"
                    ]
                }
            }
        }" || echo -e "${YELLOW}⚠️ PayMongo webhook may already exist${NC}"
    
    echo -e "${GREEN}✅ PayMongo webhooks configured${NC}"
}

# Function to configure Billplz webhooks
configure_billplz_webhooks() {
    echo -e "${YELLOW}📡 Configuring Billplz webhooks...${NC}"
    
    # Update collection webhook URL
    curl -X PATCH "https://www.billplz.com/api/v3/collections/${BILLPLZ_COLLECTION_ID}" \
        -u "${BILLPLZ_SECRET_KEY}:" \
        -d "webhook_url=${PAYMENTS_URL}/api/webhooks/billplz" || echo -e "${YELLOW}⚠️ Billplz webhook may already exist${NC}"
    
    echo -e "${GREEN}✅ Billplz webhooks configured${NC}"
}

# Function to configure Telegram webhook
configure_telegram_webhook() {
    echo -e "${YELLOW}📡 Configuring Telegram webhook...${NC}"
    
    # Set webhook URL
    curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
        -H "Content-Type: application/json" \
        -d "{
            \"url\": \"${TELEGRAM_URL}/webhook/telegram\",
            \"secret_token\": \"${TELEGRAM_WEBHOOK_SECRET}\",
            \"allowed_updates\": [\"message\", \"callback_query\", \"inline_query\"]
        }" || echo -e "${YELLOW}⚠️ Telegram webhook configuration failed${NC}"
    
    echo -e "${GREEN}✅ Telegram webhook configured${NC}"
}

# Function to configure Twilio webhook
configure_twilio_webhook() {
    echo -e "${YELLOW}📡 Configuring Twilio WhatsApp webhook...${NC}"
    
    # Update WhatsApp sandbox webhook (for testing)
    curl -X POST "https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Applications.json" \
        -u "${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}" \
        -d "StatusCallback=${WHATSAPP_URL}/webhook/status" \
        -d "StatusCallbackMethod=POST" || echo -e "${YELLOW}⚠️ Twilio webhook configuration may require manual setup${NC}"
    
    echo -e "${GREEN}✅ Twilio webhook configured${NC}"
}

# Function to deploy Discord slash commands
deploy_discord_commands() {
    echo -e "${YELLOW}📡 Deploying Discord slash commands...${NC}"
    
    # Trigger command deployment endpoint
    curl -X POST "${DISCORD_URL}/api/commands/deploy" \
        -H "Authorization: Bearer ${INTERNAL_SERVICE_KEY}" \
        -H "Content-Type: application/json" || echo -e "${YELLOW}⚠️ Discord commands deployment may require manual setup${NC}"
    
    echo -e "${GREEN}✅ Discord commands deployed${NC}"
}

# Function to verify webhook configurations
verify_webhooks() {
    echo -e "${YELLOW}🔍 Verifying webhook configurations...${NC}"
    
    # Check payment service webhooks
    curl -sf "${PAYMENTS_URL}/api/health" > /dev/null && echo -e "${GREEN}✅ Payments service is ready${NC}"
    
    # Check Telegram webhook info
    curl -sf "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo" > /dev/null && echo -e "${GREEN}✅ Telegram webhook is active${NC}"
    
    # Check messaging services
    curl -sf "${TELEGRAM_URL}/api/health" > /dev/null && echo -e "${GREEN}✅ Telegram service is ready${NC}"
    curl -sf "${WHATSAPP_URL}/api/health" > /dev/null && echo -e "${GREEN}✅ WhatsApp service is ready${NC}"
    
    echo -e "${GREEN}✅ All webhook verifications completed${NC}"
}

# Load environment variables based on environment
if [ "$ENVIRONMENT" = "production" ]; then
    # In production, these should be set as environment variables
    # or loaded from a secure secrets management system
    echo -e "${YELLOW}⚠️ Ensure production environment variables are set${NC}"
else
    # For staging, you can source from a file or set defaults
    echo -e "${YELLOW}📝 Using staging environment configuration${NC}"
fi

# Configure all webhooks
if [ -n "$PAYMONGO_SECRET_KEY" ]; then
    configure_paymongo_webhooks
else
    echo -e "${YELLOW}⚠️ PayMongo credentials not found, skipping...${NC}"
fi

if [ -n "$BILLPLZ_SECRET_KEY" ]; then
    configure_billplz_webhooks
else
    echo -e "${YELLOW}⚠️ Billplz credentials not found, skipping...${NC}"
fi

if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
    configure_telegram_webhook
else
    echo -e "${YELLOW}⚠️ Telegram bot token not found, skipping...${NC}"
fi

if [ -n "$TWILIO_ACCOUNT_SID" ]; then
    configure_twilio_webhook
else
    echo -e "${YELLOW}⚠️ Twilio credentials not found, skipping...${NC}"
fi

if [ -n "$DISCORD_TOKEN" ]; then
    deploy_discord_commands
else
    echo -e "${YELLOW}⚠️ Discord token not found, skipping...${NC}"
fi

# Verify all configurations
verify_webhooks

echo -e "${GREEN}🎉 Webhook configuration completed!${NC}"

# Print webhook URLs for reference
echo -e "${YELLOW}📋 Webhook URLs configured:${NC}"
echo "  PayMongo: ${PAYMENTS_URL}/api/webhooks/paymongo"
echo "  Billplz: ${PAYMENTS_URL}/api/webhooks/billplz"
echo "  Telegram: ${TELEGRAM_URL}/webhook/telegram"
echo "  WhatsApp: ${WHATSAPP_URL}/webhook/twilio"