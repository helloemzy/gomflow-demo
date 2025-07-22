# 🚀 GOMFLOW Demo Deployment Guide

This guide helps you deploy the GOMFLOW demo to GitHub and host it on Vercel for public testing.

## 📋 Prerequisites

- GitHub account
- Vercel account (free)
- Git installed locally
- Node.js 18+ installed

## 🎯 Deployment Options

### Option 1: Quick Deploy to Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/gomflow-demo&env=DEMO_MODE,NEXT_PUBLIC_DEMO_MODE,NEXT_PUBLIC_ENABLE_MOCK_PAYMENTS&demo-title=GOMFLOW%20Demo&demo-description=K-pop%20Group%20Order%20Management%20Platform)

1. **Fork this repository** to your GitHub account
2. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Sign up with GitHub
   - Click "New Project"
   - Import your forked repository

3. **Configure Environment Variables**:
   ```
   DEMO_MODE=true
   NEXT_PUBLIC_DEMO_MODE=true
   NEXT_PUBLIC_ENABLE_MOCK_PAYMENTS=true
   NEXT_PUBLIC_ENABLE_DEMO_DATA=true
   NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
   ```

4. **Deploy**: Vercel will automatically build and deploy your demo

### Option 2: Manual GitHub + Vercel Setup

#### Step 1: Setup GitHub Repository

```bash
# Initialize git (if not already done)
git init
git add .
git commit -m "Initial GOMFLOW demo deployment"

# Create repository on GitHub and push
git remote add origin https://github.com/yourusername/gomflow-demo.git
git branch -M main
git push -u origin main
```

#### Step 2: Configure Vercel Deployment

1. **Install Vercel CLI** (optional):
   ```bash
   npm i -g vercel
   vercel login
   ```

2. **Deploy from repository**:
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Connect GitHub and select your repository
   - Configure build settings:
     - **Root Directory**: `gomflow-core`
     - **Build Command**: `npm run build`
     - **Output Directory**: `.next`

3. **Set Environment Variables** in Vercel dashboard:
   ```
   DEMO_MODE=true
   NEXT_PUBLIC_DEMO_MODE=true
   NEXT_PUBLIC_ENABLE_MOCK_PAYMENTS=true
   NEXT_PUBLIC_ENABLE_DEMO_DATA=true
   NEXT_PUBLIC_SUPABASE_URL=https://demo.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=demo-key
   JWT_SECRET=demo_jwt_secret_key_for_testing_only
   ```

#### Step 3: Configure Domain (Optional)

1. In Vercel dashboard → Project Settings → Domains
2. Add custom domain: `gomflow-demo.your-domain.com`
3. Update DNS records as instructed

## 🔧 Configuration Details

### Environment Variables for Demo

| Variable | Value | Purpose |
|----------|--------|---------|
| `DEMO_MODE` | `true` | Enables demo mode across all services |
| `NEXT_PUBLIC_DEMO_MODE` | `true` | Client-side demo features |
| `NEXT_PUBLIC_ENABLE_MOCK_PAYMENTS` | `true` | Mock payment processing |
| `NEXT_PUBLIC_ENABLE_DEMO_DATA` | `true` | Pre-loaded demo data |
| `NEXT_PUBLIC_APP_URL` | Your Vercel URL | Base URL for API calls |

### Build Configuration

The `vercel.json` file is configured to:
- Build only the `gomflow-core` Next.js application
- Set appropriate environment variables
- Configure API routes and headers
- Enable CORS for demo testing

## 🧪 Testing Deployed Demo

Once deployed, test these key features:

### 1. Core Functionality
- ✅ Homepage loads with GOMFLOW branding
- ✅ Order creation and management
- ✅ Buyer submission workflows
- ✅ Payment proof upload

### 2. Demo Features
- ✅ Mock payment processing (no real transactions)
- ✅ Simulated bot responses
- ✅ Demo data pre-loaded
- ✅ Analytics dashboards functional

### 3. Error Handling
- ✅ Graceful handling of missing API keys
- ✅ Proper error messages for users
- ✅ Fallback to demo data when needed

## 🔄 Continuous Deployment

Vercel automatically redeploys when you push to the main branch:

```bash
# Make changes
git add .
git commit -m "Update demo features"
git push origin main

# Vercel will auto-deploy within minutes
```

## 📊 Monitoring Demo Usage

### Vercel Analytics
- Vercel provides built-in analytics
- Track page views, unique visitors
- Monitor performance metrics

### Demo-Specific Metrics
The demo includes built-in tracking:
- Order creation attempts
- Payment method selections
- Feature usage patterns
- Error rates and types

## 🐛 Troubleshooting

### Common Deployment Issues

#### Build Failures
```bash
# Check build logs in Vercel dashboard
# Common fixes:
- Ensure Node.js 18+ in vercel.json
- Check package.json scripts
- Verify all dependencies installed
```

#### Environment Variable Issues
```bash
# Verify in Vercel dashboard:
- All required variables set
- No typos in variable names
- Values properly formatted
```

#### API Route Errors
```bash
# Check function logs:
- API routes timeout (increase maxDuration)
- CORS errors (check headers config)
- Missing environment variables
```

### Demo-Specific Issues

#### Services Not Responding
- Demo services are mocked - they always return success
- Check browser console for client-side errors
- Verify demo mode is properly enabled

#### Payment Processing Fails
- In demo mode, all payments should succeed
- Check if `NEXT_PUBLIC_ENABLE_MOCK_PAYMENTS=true`
- Clear browser cache and retry

## 🚀 Advanced Deployment Options

### Multi-Environment Setup

Create different branches for different demo versions:

```bash
# Development demo
git checkout -b demo-dev
# Set NEXT_PUBLIC_APP_URL=https://gomflow-demo-dev.vercel.app

# Staging demo  
git checkout -b demo-staging
# Set NEXT_PUBLIC_APP_URL=https://gomflow-demo-staging.vercel.app
```

### Custom Domain Configuration

1. Purchase domain (e.g., `gomflow-demo.com`)
2. Add to Vercel project
3. Configure DNS:
   ```
   CNAME: gomflow-demo.com → cname.vercel-dns.com
   ```

### Performance Optimization

- Enable Vercel Speed Insights
- Configure Image Optimization
- Set up proper caching headers
- Use Vercel Analytics for monitoring

## 📞 Support

### Demo-Related Issues
- **GitHub Issues**: Report problems with the demo
- **Vercel Support**: Deployment and hosting issues
- **Email**: emily@gomflow.com for general questions

### Resources
- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [GitHub Pages Alternative](https://docs.github.com/en/pages)

---

## ✅ Deployment Checklist

- [ ] Repository created on GitHub
- [ ] Code pushed to main branch
- [ ] Vercel project connected
- [ ] Environment variables configured
- [ ] Demo deployment successful
- [ ] All demo features tested
- [ ] Custom domain configured (optional)
- [ ] Analytics setup completed
- [ ] Documentation updated with live URL

---

**🎉 Your GOMFLOW demo is now live and ready for testing!**

Share the URL with potential users, investors, or team members to showcase the complete platform functionality.

---

*Last updated: January 2025*