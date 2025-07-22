#!/bin/bash

# GOMFLOW Demo GitHub Deployment Script
# This script helps you deploy the GOMFLOW demo to GitHub

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}"
echo "=========================================="
echo "🚀 GOMFLOW Demo GitHub Deployment"
echo "=========================================="
echo -e "${NC}"

# Check if we have a remote already
if git remote get-url origin >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Git remote already exists.${NC}"
    echo "Current remote: $(git remote get-url origin)"
    read -p "Do you want to use this remote? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Please update your remote manually:"
        echo "git remote set-url origin https://github.com/yourusername/gomflow-demo.git"
        exit 1
    fi
else
    echo -e "${RED}❌ No git remote found.${NC}"
    echo "Please set up your GitHub repository first:"
    echo ""
    echo -e "${BLUE}1. Create a new repository on GitHub${NC}"
    echo "   - Go to https://github.com/new"
    echo "   - Name: gomflow-demo"
    echo "   - Description: GOMFLOW K-pop Group Order Management Platform - Demo Version"
    echo "   - Keep it Public (for easy demo access)"
    echo ""
    echo -e "${BLUE}2. Add the remote to this repository:${NC}"
    echo "   git remote add origin https://github.com/YOUR_USERNAME/gomflow-demo.git"
    echo ""
    echo -e "${BLUE}3. Run this script again${NC}"
    echo ""
    exit 1
fi

echo -e "${BLUE}📋 Repository Status:${NC}"
git status --short

echo -e "\n${BLUE}📤 Pushing to GitHub...${NC}"
git push -u origin main

echo -e "\n${GREEN}✅ Successfully pushed to GitHub!${NC}"

# Get the repository URL
REPO_URL=$(git remote get-url origin | sed 's/\.git$//')
echo -e "\n${BLUE}📱 Your repository:${NC} $REPO_URL"

echo -e "\n${GREEN}🚀 Next Steps:${NC}"
echo "1. 🌐 Deploy to Vercel:"
echo "   - Go to https://vercel.com/new"
echo "   - Import your GitHub repository"
echo "   - Configure environment variables (see DEPLOYMENT_GUIDE.md)"
echo ""
echo "2. 📋 Or use the quick deploy button:"
echo "   https://vercel.com/new/clone?repository-url=$REPO_URL"
echo ""
echo "3. 🧪 Test the demo locally first:"
echo "   ./start-demo.sh"
echo ""
echo "4. 📖 Read the deployment guide:"
echo "   https://github.com/$(basename "$REPO_URL" .git)/blob/main/DEPLOYMENT_GUIDE.md"

echo -e "\n${GREEN}=========================================="
echo "🎉 GOMFLOW Demo Ready for Deployment!"
echo "=========================================="
echo -e "${NC}"