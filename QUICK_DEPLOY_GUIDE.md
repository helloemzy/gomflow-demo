# 🚀 GOMFLOW Demo - Quick Deploy Guide

## 1-Minute Deployment to GitHub + Vercel

### Step 1: Create GitHub Repository (2 minutes)

1. **Go to GitHub**: https://github.com/new
2. **Repository name**: `gomflow-demo`
3. **Description**: `GOMFLOW K-pop Group Order Management Platform - Demo Version`
4. **Visibility**: Public (for easy demo access)
5. **Click "Create repository"**

### Step 2: Push Code to GitHub (30 seconds)

```bash
# In your gomflow directory
git remote add origin https://github.com/YOUR_USERNAME/gomflow-demo.git
./deploy-to-github.sh
```

### Step 3: Deploy to Vercel (1 minute)

#### Option A: Quick Deploy Button
Click this button (replace YOUR_USERNAME):
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/gomflow-demo&root-directory=gomflow-core)

#### Option B: Manual Deployment
1. **Go to Vercel**: https://vercel.com/new
2. **Import your GitHub repo**: `gomflow-demo`
3. **Configure settings**:
   - **Root Directory**: Leave empty (uses monorepo detection)
   - **Build Command**: Will use vercel.json configuration
   - **Output Directory**: Will use vercel.json configuration
4. **Add Environment Variables** (copy from `.env.demo`):
   ```
   DEMO_MODE=true
   NEXT_PUBLIC_DEMO_MODE=true
   NEXT_PUBLIC_ENABLE_MOCK_PAYMENTS=true
   NEXT_PUBLIC_ENABLE_DEMO_DATA=true
   ```
5. **Click "Deploy"**

### Step 4: Test Your Demo (30 seconds)

Your demo will be live at: `https://gomflow-demo-YOUR_USERNAME.vercel.app`

Test these key features:
- ✅ Homepage loads with GOMFLOW branding
- ✅ Create a test group order
- ✅ Submit an order as a buyer  
- ✅ Upload payment proof (any image file)
- ✅ View analytics dashboard

---

## 🎯 Complete Demo Features

Your deployed demo includes:

### ✅ Core Platform
- **Order Management**: Full CRUD operations
- **Payment Processing**: Mock PayMongo + Billplz
- **File Uploads**: Payment proof with AI processing
- **Real-time Analytics**: Charts and dashboards
- **Multi-country Support**: Philippines + Malaysia

### ✅ Advanced Features  
- **AI Smart Agent**: Mock payment processing
- **Collaboration Tools**: Team workspaces
- **Market Intelligence**: Predictive analytics
- **Social Integration**: Multi-platform posting
- **Mobile Responsive**: Works on all devices

### ✅ Bot Simulations
- **WhatsApp**: Message templates and workflows
- **Telegram**: Bot commands and responses  
- **Discord**: Slash commands and embeds

---

## 🔧 Customization

### Change Domain (Optional)
1. In Vercel dashboard → Project Settings → Domains
2. Add: `gomflow-demo.yourdomain.com`
3. Update DNS as instructed

### Update Demo Data
Edit `gomflow-core/src/lib/demo-data.ts` and redeploy

### Modify Branding  
Update `gomflow-core/src/app/layout.tsx` for title/meta
Update `gomflow-core/tailwind.config.ts` for colors

---

## 📊 Monitoring

### Vercel Analytics
- Automatic page view tracking
- Performance monitoring
- Error logging

### Demo Usage Tracking
Built-in analytics track:
- Order creation attempts
- Payment method selections  
- Feature usage patterns
- Error rates

---

## 🐛 Troubleshooting

### Build Fails
- Check Node.js version (needs 18+)
- Verify package.json scripts
- Review build logs in Vercel dashboard

### Demo Not Loading
- Check environment variables are set
- Verify DEMO_MODE=true
- Clear browser cache

### Services Not Responding  
- All backend services are mocked
- Check browser console for errors
- Ensure demo mode is enabled

---

## 📞 Support

- **GitHub Issues**: Report demo problems
- **Email**: emily@gomflow.com  
- **Deployment Guide**: See `DEPLOYMENT_GUIDE.md`

---

## ✅ Deployment Checklist

- [ ] GitHub repository created
- [ ] Code pushed successfully  
- [ ] Vercel deployment configured
- [ ] Environment variables set
- [ ] Demo loads successfully
- [ ] Key features tested
- [ ] Share demo URL with team

---

**🎉 Your GOMFLOW demo is now live!**

Share your demo URL to showcase the complete K-pop group order management platform.

**Demo URL**: `https://gomflow-demo-YOUR_USERNAME.vercel.app`

---

*Deployment time: ~5 minutes total*