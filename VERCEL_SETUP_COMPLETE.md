# ✅ Vercel Deployment Setup Complete!

Your project is now configured for Vercel serverless deployment while maintaining local Replit development.

## 🚨 NEXT STEP (Required)

**Update your Replit workflow configuration:**

1. Click on `.replit` in the file browser
2. Find line 98: `args = "npm run dev"`
3. Change to: `args = "npm --prefix client run dev"`
4. Save the file
5. Click "Run" button to restart the workflow

This single change fixes the local development environment.

## 📦 What Was Changed

### New Files Created
- `vercel.json` - Vercel configuration
- `api/server.ts` - Serverless wrapper for Express app  
- `api/stripe-webhook.ts` - Dedicated Stripe webhook handler
- `server/dev.ts` - Optional development server
- `VERCEL_DEPLOYMENT.md` - Full deployment guide

### Modified Files
- `server/index.ts` - Now exports app for Vercel
- `client/vite.config.ts` - Changed build output to `dist`

### Dependencies Added
- `serverless-http` - Wraps Express for serverless
- `raw-body` - Stripe webhook signature verification
- `@vercel/node` - Vercel TypeScript types

## 🚀 How to Deploy to Vercel

1. **Update .replit** (see above) ⬆️

2. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Add Vercel deployment configuration"
   git push origin main
   ```

3. **Deploy on Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository
   - Vercel will auto-detect `vercel.json`
   - Click "Deploy"

4. **Configure Environment Variables in Vercel:**
   Go to Project Settings → Environment Variables and add:
   
   **Required:**
   - `DATABASE_URL`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_PRICE_ID`
   - `VITE_STRIPE_PUBLIC_KEY`
   
   **Email:**
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `SMTP_USER`
   - `SMTP_PASS`
   - `SMTP_FROM`
   
   **Optional:**
   - `SESSION_SECRET`
   - `NPS_API_KEY`
   - `VITE_MAPBOX_TOKEN`

5. **Update Stripe Webhook:**
   - Go to Stripe Dashboard → Webhooks
   - Add endpoint: `https://your-app.vercel.app/api/stripe-webhook`
   - Select events: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`
   - Copy the webhook signing secret
   - Add it to Vercel as `STRIPE_WEBHOOK_SECRET`

## 🔄 How It Works

### Local Development (Replit)
- Runs on port 5000 as before
- Express + Vite integrated server
- All features work normally

### Production (Vercel)
- **Frontend:** Served from `client/dist`
- **API:** All Express routes at `/api/server/*`
- **Webhooks:** Stripe webhook at `/api/stripe-webhook`

### Example Routes After Deployment
- Frontend: `https://your-app.vercel.app/`
- API Health: `https://your-app.vercel.app/api/server/health`
- Trips: `https://your-app.vercel.app/api/server/trips`
- Stripe Webhook: `https://your-app.vercel.app/api/stripe-webhook`

## 📖 Full Documentation

See `VERCEL_DEPLOYMENT.md` for:
- Complete configuration details
- Troubleshooting guide
- Alternative deployment strategies
- Authentication considerations

## ⚠️ Important Notes

### Authentication
Your current Replit Auth (OIDC) won't work on Vercel. Options:
1. Keep backend on Replit, deploy frontend only on Vercel
2. Switch to Clerk/Auth0/NextAuth for Vercel compatibility

### Database
Ensure your PostgreSQL provider (Neon/Supabase) supports serverless:
- Use connection pooling
- Limit concurrent connections
- Consider using Neon for best serverless compatibility

## ✅ Testing Checklist

Before deploying to production:

- [ ] Updated `.replit` workflow configuration
- [ ] Local dev server runs successfully
- [ ] All environment variables documented
- [ ] Frontend builds without errors: `npm --prefix client run build`
- [ ] Stripe webhook secret ready
- [ ] Database connection string ready

## 🐛 Troubleshooting

**Workflow won't start?**
- Make sure you updated line 98 in `.replit`
- Should say: `args = "npm --prefix client run dev"`

**Build fails on Vercel?**
- Check all environment variables are set
- Verify `client/dist` is in `.gitignore`
- Check Vercel build logs for specific errors

**API routes 404?**
- Remember routes are at `/api/server/*` not `/api/*`
- Example: `/api/server/trips` not `/api/trips`

**Stripe webhook fails?**
- Verify `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard
- Test with Stripe CLI: `stripe listen --forward-to https://your-app.vercel.app/api/stripe-webhook`

## 🎉 You're Ready!

Once you update `.replit` and push to GitHub, your app can be deployed to Vercel in minutes!

Questions? Check `VERCEL_DEPLOYMENT.md` for the complete guide.
