# Vercel Deployment Guide

This document explains the changes made to deploy The Camping Planner full-stack app to Vercel.

## Changes Summary

### 1. Created `vercel.json` (Root)
Configures Vercel to build the frontend and route requests properly:
- **Build Command**: `npm --prefix client ci && npm --prefix client run build`
- **Output Directory**: `client/dist`
- **Rewrites**: Routes `/api/*` to serverless functions, everything else to frontend

### 2. Created `api/server.ts` (Vercel Serverless Function)
Wraps the entire Express app using `serverless-http`:
- Mounts all Express routes under `/api/server/*`
- Uses the exported `app` from `server/index.ts`

### 3. Created `api/stripe-webhook.ts` (Dedicated Webhook Function)
Handles Stripe webhooks with raw body parsing:
- Implements signature verification
- Processes events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
- Sends automated emails via the existing email service
- Available at `/api/stripe-webhook`

### 4. Updated `server/index.ts`
Modified to export the Express app for serverless deployment:
- Wrapped initialization in IIFE to support top-level await
- Exports `app` for use in Vercel functions
- Only starts the server when `NODE_ENV === "development"` and not on Vercel

### 5. Updated `client/vite.config.ts`
Changed build output directory:
- **Before**: `dist/public`
- **After**: `dist` (Vercel expects this)

### 6. Created `server/dev.ts`
Optional development server file:
- Can be used to run the server separately from Vite
- Imports the exported `app` and starts it with Vite HMR support

### 7. Installed Required Packages
Added serverless dependencies:
- `serverless-http` - Wraps Express for serverless
- `raw-body` - Required for Stripe webhook signature verification
- `@vercel/node` - TypeScript types for Vercel functions

## Vercel Environment Variables

Set these in Vercel → Settings → Environment Variables:

### Required Variables
- `DATABASE_URL` - PostgreSQL connection string
- `STRIPE_SECRET_KEY` - Stripe API secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `STRIPE_PRICE_ID` - Stripe price ID for Pro membership
- `VITE_STRIPE_PUBLIC_KEY` - Stripe publishable key (must have VITE_ prefix)

### Email Variables
- `SMTP_HOST` - SMTP server hostname
- `SMTP_PORT` - SMTP server port
- `SMTP_USER` - SMTP username
- `SMTP_PASS` - SMTP password
- `SMTP_FROM` - From email address

### Optional Variables
- `SESSION_SECRET` - Session encryption secret
- `NPS_API_KEY` - National Park Service API key
- `VITE_MAPBOX_TOKEN` - Mapbox API token (must have VITE_ prefix)

## Vercel Project Settings

### Build Settings
- **Root Directory**: Leave empty (repo root)
- **Build Command**: Use default or `npm --prefix client ci && npm --prefix client run build`
- **Output Directory**: `client/dist`

### Framework Preset
- Select "Vite" or "Other"

## API Routes

After deployment, your routes will be:

### Frontend
- All pages served from `client/dist`
- Example: `https://your-app.vercel.app/`

### Backend API
- All Express routes: `https://your-app.vercel.app/api/server/*`
- Health check: `https://your-app.vercel.app/api/server/health`
- Auth: `https://your-app.vercel.app/api/server/auth/user`
- Trips: `https://your-app.vercel.app/api/server/trips`

### Stripe Webhook
- Webhook endpoint: `https://your-app.vercel.app/api/stripe-webhook`
- Configure this URL in Stripe Dashboard → Webhooks

## Stripe Webhook Configuration

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-app.vercel.app/api/stripe-webhook`
3. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the webhook signing secret
5. Add it to Vercel environment variables as `STRIPE_WEBHOOK_SECRET`

## Local Development

### Current Setup (Works in Replit)
```bash
npm run dev
```
This runs the integrated Express + Vite server on port 5000.

### Alternative: Separate Servers (Optional)
```bash
# Terminal 1: Frontend
npm --prefix client run dev

# Terminal 2: Backend
tsx server/dev.ts
```

## Important Notes

### Authentication Consideration
The current Replit Auth (OIDC) integration won't work on Vercel out-of-the-box. You have two options:

1. **Keep Replit Auth** - Host the backend on Replit, use Vercel for frontend only
2. **Switch to Alternative** - Use Clerk, Auth0, or another provider that works on Vercel

### Database Connection
Ensure your PostgreSQL provider (Neon/Supabase) uses connection pooling for serverless environments.

### Testing Before Deployment
1. Build locally: `npm --prefix client run build`
2. Check that `client/dist` contains the built files
3. Verify no build errors

## IMPORTANT: Manual Configuration Step

**Before deploying, you MUST update the Replit workflow:**

1. Open `.replit` file in the file browser
2. Find line 98 that says: `args = "npm run dev"`
3. Change it to: `args = "npm --prefix client run dev"`
4. Save the file

This tells Replit to run the dev command from the `client` directory where your package.json with the dev script is located.

## Deployment Steps

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Add Vercel deployment configuration"
   git push origin main
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Vercel will auto-detect the `vercel.json` configuration

3. **Set Environment Variables**
   - Add all required environment variables in Vercel dashboard
   - Don't forget to add variables for all three environments: Production, Preview, Development

4. **Deploy**
   - Vercel will automatically deploy on push to main
   - Preview deployments are created for pull requests

5. **Update Stripe Webhook**
   - Configure webhook URL in Stripe Dashboard
   - Test with Stripe CLI: `stripe listen --forward-to https://your-app.vercel.app/api/stripe-webhook`

## Troubleshooting

### Build Fails
- Check Vercel build logs
- Verify all environment variables are set
- Ensure `client/dist` is in `.gitignore` (it should be)

### API Routes Don't Work
- Verify `vercel.json` rewrites are correct
- Check that `api/server.ts` exports properly
- Look for errors in Vercel function logs

### Stripe Webhook Fails
- Verify `STRIPE_WEBHOOK_SECRET` is set correctly
- Check webhook signature in Stripe Dashboard
- Test locally with Stripe CLI

### Database Connection Errors
- Verify `DATABASE_URL` is set
- Check that your database provider allows serverless connections
- Enable connection pooling if using traditional PostgreSQL

## Files Modified

- ✅ `vercel.json` (created)
- ✅ `api/server.ts` (created)
- ✅ `api/stripe-webhook.ts` (created)
- ✅ `server/index.ts` (modified)
- ✅ `server/dev.ts` (created)
- ✅ `client/vite.config.ts` (modified)
- ✅ Dependencies installed: `serverless-http`, `raw-body`, `@vercel/node`

## Next Steps

1. Push changes to GitHub
2. Import repository to Vercel
3. Configure environment variables
4. Deploy and test
5. Update Stripe webhook URL
6. Test full payment flow on staging/preview deployment
