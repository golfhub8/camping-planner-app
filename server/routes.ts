import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertRecipeSchema, generateGroceryListSchema, insertTripSchema, updateTripSchema, addCollaboratorSchema, addTripCostSchema, addMealSchema, createSharedGroceryListSchema, searchCampgroundsSchema, addCampingBasicSchema, type GroceryItem, type GroceryCategory, type Recipe } from "@shared/schema";
import { z } from "zod";
import { setupAuth, isAuthenticated, isAuthenticatedOptional } from "./replitAuth";
import Stripe from "stripe";
import { load as cheerioLoad } from "cheerio";
import nodemailer from "nodemailer";
import { promises as dns } from "dns";
import * as net from "net";
import * as path from "path";
import * as fs from "fs";
import { initializeEmailService, sendWelcomeToProEmail } from "./emailService";

/**
 * Converts IPv6 address to bytes for proper IPv4-mapped detection
 * Handles both dotted-decimal (::ffff:127.0.0.1) and hex (::ffff:7f00:1) formats
 */
function parseIPv6ToIPv4(ipv6: string): string | null {
  const cleaned = ipv6.replace(/^\[|\]$/g, '').toLowerCase();
  
  // Check if it's an IPv4-mapped IPv6 address (::ffff:xxxx:xxxx or ::ffff:x.x.x.x)
  if (!cleaned.startsWith('::ffff:')) {
    return null;
  }
  
  const suffix = cleaned.substring(7); // Remove '::ffff:' prefix
  
  // If already in dotted-decimal format, return it
  if (/^\d+\.\d+\.\d+\.\d+$/.test(suffix)) {
    return suffix;
  }
  
  // Handle hexadecimal format (e.g., 7f00:1 → 127.0.0.1)
  // Split into 16-bit groups
  const parts = suffix.split(':');
  if (parts.length !== 2) {
    return null;
  }
  
  // Parse each hex group to get the 4 IPv4 octets
  const group1 = parseInt(parts[0], 16);
  const group2 = parseInt(parts[1], 16);
  
  if (isNaN(group1) || isNaN(group2)) {
    return null;
  }
  
  // Convert to IPv4: first group = first 2 octets, second group = last 2 octets
  const octet1 = (group1 >> 8) & 0xFF;
  const octet2 = group1 & 0xFF;
  const octet3 = (group2 >> 8) & 0xFF;
  const octet4 = group2 & 0xFF;
  
  return `${octet1}.${octet2}.${octet3}.${octet4}`;
}

/**
 * SSRF Protection Helper
 * Checks if an IP address is in a private, loopback, or link-local range
 * Handles IPv4, IPv6, and all IPv4-mapped IPv6 formats (dotted and hex)
 */
function isPrivateOrLocalIP(ip: string): boolean {
  let cleanIp = ip.replace(/^\[|\]$/g, '');
  
  // Detect and convert IPv4-mapped IPv6 (both dotted and hex formats)
  const ipv4 = parseIPv6ToIPv4(cleanIp);
  if (ipv4) {
    cleanIp = ipv4;
  }
  
  // Normalize the IP using Node's net module for validation
  const isIPv4 = net.isIPv4(cleanIp);
  const isIPv6 = net.isIPv6(cleanIp);
  
  if (!isIPv4 && !isIPv6) {
    // Invalid IP format, block it to be safe
    return true;
  }
  
  // Block unspecified addresses (all zeros)
  if (cleanIp === '0.0.0.0' || cleanIp === '::' || cleanIp === '::0' || 
      cleanIp.match(/^0:0:0:0:0:0:0:0$/)) {
    return true;
  }
  
  // IPv4 checks
  if (isIPv4) {
    const parts = cleanIp.split('.').map(Number);
    
    // Loopback: 127.0.0.0/8
    if (parts[0] === 127) {
      return true;
    }
    
    // Private: 10.0.0.0/8
    if (parts[0] === 10) {
      return true;
    }
    
    // Private: 172.16.0.0/12 (172.16-31.x.x)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
      return true;
    }
    
    // Private: 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) {
      return true;
    }
    
    // Link-local: 169.254.0.0/16
    if (parts[0] === 169 && parts[1] === 254) {
      return true;
    }
    
    return false;
  }
  
  // IPv6 checks
  if (isIPv6) {
    const lower = cleanIp.toLowerCase();
    
    // Loopback: ::1
    if (lower === '::1' || lower.match(/^0:0:0:0:0:0:0:1$/)) {
      return true;
    }
    
    // Unique Local Addresses: fc00::/7
    if (lower.match(/^f[cd][0-9a-f]{2}:/)) {
      return true;
    }
    
    // Link-local: fe80::/10
    if (lower.match(/^fe[89ab][0-9a-f]:/)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Validates a URL for SSRF protection by resolving hostname to ALL IPs
 * and checking if ANY of them are in a private/internal range
 * This prevents bypass via mixed A/AAAA records (public + private)
 */
async function validateUrlForSSRF(url: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    
    // Require HTTPS for security
    if (parsedUrl.protocol !== 'https:' && 
        !hostname.includes('thecampingplanner.com')) {
      return {
        valid: false,
        error: 'Only HTTPS URLs are allowed for external sites'
      };
    }
    
    // Resolve hostname to ALL IP addresses (both IPv4 and IPv6)
    try {
      const addresses = await dns.lookup(hostname, { all: true });
      
      // Check if ANY resolved IP is private/internal
      // This prevents bypass via domains that return mixed public + private IPs
      for (const { address } of addresses) {
        if (isPrivateOrLocalIP(address)) {
          return {
            valid: false,
            error: `Cannot scrape private network addresses (hostname resolves to private IP: ${address})`
          };
        }
      }
      
      return { valid: true };
    } catch (dnsError) {
      // DNS resolution failed - could be invalid domain or network issue
      return {
        valid: false,
        error: `Cannot resolve hostname: ${hostname}`
      };
    }
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid URL format'
    };
  }
}

// Free tier trip limit configuration
// Free tier limits - can be overridden via environment variables
// Defaults to 5 if not set or if parsing fails
const FREE_TRIP_LIMIT = (() => {
  const parsed = parseInt(process.env.FREE_TRIP_LIMIT || '5', 10);
  return Number.isNaN(parsed) ? 5 : parsed;
})();

const FREE_GROCERY_LIMIT = (() => {
  const parsed = parseInt(process.env.FREE_GROCERY_LIMIT || '5', 10);
  return Number.isNaN(parsed) ? 5 : parsed;
})();

// Initialize Stripe client
// Reference: blueprint:javascript_stripe
let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  const keyPrefix = process.env.STRIPE_SECRET_KEY.substring(0, 7);
  console.log(`[Stripe] Initializing with key prefix: ${keyPrefix}`);
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-10-29.clover",
  });
  console.log('[Stripe] Client initialized successfully');
} else {
  console.error('[Stripe] STRIPE_SECRET_KEY not found in environment');
}

// In-memory cache for processed webhook event IDs (idempotency)
// This prevents duplicate processing of the same webhook event
// Store event IDs for 24 hours to handle Stripe retry attempts
const processedWebhookEvents = new Map<string, number>();

// Clean up old processed event IDs every hour
setInterval(() => {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  processedWebhookEvents.forEach((timestamp, eventId) => {
    if (now - timestamp > oneDay) {
      processedWebhookEvents.delete(eventId);
    }
  });
}, 60 * 60 * 1000);

// Register Stripe webhook route BEFORE global JSON middleware
// This is critical for proper signature verification
export function registerWebhookRoute(app: Express): void {
  // POST /api/stripe/webhook
  // Stripe webhook handler for payment events
  // This endpoint is called by Stripe when payment events occur
  // NO authentication middleware - Stripe verifies using webhook signature
  // IMPORTANT: This route MUST use raw body for signature verification
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    if (!stripe) {
      return res.status(503).send("Stripe not configured");
    }

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig) {
      return res.status(400).send("No signature");
    }

    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET not configured");
      return res.status(500).send("Webhook secret not configured");
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        webhookSecret
      );
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Check if we've already processed this event (idempotency)
    if (processedWebhookEvents.has(event.id)) {
      console.log(`[Webhook] Event ${event.id} already processed, skipping duplicate`);
      return res.status(200).send("Duplicate event - already processed");
    }

    try {
      // Log the event type for debugging
      console.log(`[Webhook] Received event: ${event.type} (${event.id})`);
      
      // Handle the event
      switch (event.type) {
        case 'checkout.session.completed': {
          console.log(`[Webhook] ==================== Processing checkout.session.completed ====================`);
          const session = event.data.object as Stripe.Checkout.Session;
          console.log(`[Webhook] Session ID: ${session.id}`);
          console.log(`[Webhook] client_reference_id: ${session.client_reference_id}`);
          console.log(`[Webhook] metadata:`, JSON.stringify(session.metadata));
          console.log(`[Webhook] customer: ${session.customer}`);
          console.log(`[Webhook] customer_email: ${session.customer_email}`);
          console.log(`[Webhook] subscription: ${session.subscription}`);
          
          let userId = session.client_reference_id || session.metadata?.app_user_id;
          let userIdFoundViaEmail = false;

          console.log(`[Webhook] Extracted userId: ${userId || 'NOT FOUND'}`);

          // If no userId in metadata, try to look up by email from customer
          if (!userId && session.customer_email) {
            console.log(`[Webhook] No userId in metadata, looking up by email: ${session.customer_email}`);
            const user = await storage.getUserByEmail(session.customer_email);
            if (user) {
              userId = user.id;
              userIdFoundViaEmail = true;
              console.log(`[Webhook] Found user by email: ${userId}`);
            } else {
              console.log(`[Webhook] No user found with email: ${session.customer_email}`);
            }
          }

          if (!userId) {
            console.error("[Webhook] ❌ CRITICAL: No user ID found in checkout session and couldn't look up by email");
            console.error("[Webhook] This means the subscription will NOT be activated!");
            break;
          }
          
          console.log(`[Webhook] ✅ Successfully identified userId: ${userId}`);

          const purchaseType = session.metadata?.purchase_type;
          console.log(`[Webhook] Purchase type: ${purchaseType || 'not specified'}, User ID: ${userId}`);

          if (purchaseType === 'pro_membership_annual') {
            console.log(`[Webhook] Processing Pro membership subscription...`);
            // Handle annual Pro membership subscription - save customer and subscription IDs
            if (session.customer && session.subscription) {
              console.log(`[Webhook] Updating database - customer: ${session.customer}, subscription: ${session.subscription}`);
              await storage.updateStripeCustomerId(userId, session.customer as string);
              await storage.updateStripeSubscriptionId(userId, session.subscription as string);
              
              // Fetch the subscription to get the actual current_period_end (includes trial)
              console.log(`[Webhook] Fetching subscription details from Stripe...`);
              const subscriptionResponse = await stripe.subscriptions.retrieve(session.subscription as string);
              
              // Type guard: ensure this is an active subscription (not deleted)
              if (!subscriptionResponse || subscriptionResponse.object !== 'subscription') {
                console.error(`Expected subscription object but got: ${subscriptionResponse?.object || 'null'}`);
                break;
              }
              
              // Type guard: ensure current_period_end exists and is a number
              if (!('current_period_end' in subscriptionResponse) || 
                  typeof subscriptionResponse.current_period_end !== 'number') {
                console.error('Subscription missing valid current_period_end');
                break;
              }
              
              const endDate = new Date(subscriptionResponse.current_period_end * 1000);
              console.log(`[Webhook] Setting Pro membership end date: ${endDate}`);
              await storage.updateProMembershipEndDate(userId, endDate);
              
              // Store subscription status for efficient /api/me access
              console.log(`[Webhook] Setting subscription status: ${subscriptionResponse.status}`);
              await storage.updateSubscriptionStatus(userId, subscriptionResponse.status);
              
              // If userId was found via email (not in metadata), update Stripe metadata
              // This ensures future subscription webhook events can find the user
              if (userIdFoundViaEmail) {
                try {
                  console.log(`[Webhook] Updating Stripe subscription metadata with app_user_id: ${userId}`);
                  await stripe.subscriptions.update(session.subscription as string, {
                    metadata: {
                      app_user_id: userId,
                    },
                  });
                  console.log(`[Webhook] Successfully updated subscription metadata`);
                } catch (metadataError) {
                  // Log but don't fail the entire event if metadata update fails
                  console.error(`[Webhook] Failed to update subscription metadata:`, metadataError);
                }
              }
              
              console.log(`[Webhook] ✅ SUCCESS: Activated Pro membership for user ${userId}`);
              console.log(`[Webhook] Status: ${subscriptionResponse.status}, Expires: ${endDate}`);
              
              // Send welcome email to user
              try {
                const user = await storage.getUser(userId);
                if (user && user.email) {
                  console.log(`[Webhook] Sending welcome email to ${user.email}...`);
                  
                  await sendWelcomeToProEmail({
                    to: user.email,
                    name: user.firstName || undefined,
                  });
                  
                  console.log(`[Webhook] ✅ Welcome email sent successfully`);
                } else {
                  console.log(`[Webhook] ⚠️ Could not send email - user or email not found`);
                }
              } catch (emailError) {
                // Don't fail the webhook if email fails
                console.error(`[Webhook] ⚠️ Failed to send welcome email:`, emailError);
              }
            }
          }
          break;
        }

        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          
          // Type guard: ensure this is an active subscription (not deleted)
          if (subscription.object !== 'subscription') {
            console.error(`Expected subscription object but got: ${subscription.object}`);
            break;
          }
          
          console.log(`[Webhook] Processing ${event.type} for subscription ${subscription.id}, status: ${subscription.status}`);
          
          // Find user by Stripe subscription ID metadata
          let userId = subscription.metadata?.app_user_id;
          
          // If no userId in metadata, try to look up by customer email (fallback for legacy subscriptions)
          if (!userId && subscription.customer) {
            try {
              console.log(`[Webhook] No userId in subscription metadata, attempting customer lookup`);
              const customer = await stripe.customers.retrieve(subscription.customer as string);
              
              if (customer && !customer.deleted && customer.email) {
                console.log(`[Webhook] Looking up user by customer email: ${customer.email}`);
                const user = await storage.getUserByEmail(customer.email);
                if (user) {
                  userId = user.id;
                  console.log(`[Webhook] Found user by email: ${userId}`);
                  
                  // Update the subscription metadata for future events
                  try {
                    console.log(`[Webhook] Updating subscription metadata with app_user_id: ${userId}`);
                    await stripe.subscriptions.update(subscription.id, {
                      metadata: {
                        app_user_id: userId,
                      },
                    });
                    console.log(`[Webhook] Successfully updated subscription metadata`);
                  } catch (metadataError) {
                    console.error(`[Webhook] Failed to update subscription metadata:`, metadataError);
                  }
                }
              }
            } catch (customerError) {
              console.error(`[Webhook] Error fetching customer:`, customerError);
            }
          }
          
          if (!userId) {
            console.error(`[Webhook] Could not find user for subscription ${subscription.id}. Skipping update.`);
            break;
          }

          // Store subscription status for efficient /api/me access
          await storage.updateSubscriptionStatus(userId, subscription.status);

          // Update Pro membership status based on Stripe subscription status
          // Grant access for: active, trialing, past_due (grace period)
          // Revoke access for: canceled, incomplete, incomplete_expired, unpaid, paused
          const allowedStatuses = ['active', 'trialing', 'past_due'];
          
          if (allowedStatuses.includes(subscription.status)) {
            // Type guard: ensure current_period_end exists and is a number
            if (!('current_period_end' in subscription) || 
                typeof subscription.current_period_end !== 'number') {
              console.error('Subscription missing valid current_period_end');
              break;
            }
            
            const endDate = new Date(subscription.current_period_end * 1000);
            await storage.updateProMembershipEndDate(userId, endDate);
            console.log(`[Webhook] Updated Pro membership for user ${userId} - status: ${subscription.status}, expires ${endDate}`);
          } else {
            // Subscription canceled, expired, or in other non-active state - revoke access
            await storage.updateProMembershipEndDate(userId, null);
            console.log(`[Webhook] Revoked Pro membership for user ${userId} - status: ${subscription.status}`);
          }
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      // Mark event as successfully processed (idempotency)
      processedWebhookEvents.set(event.id, Date.now());
      
      res.json({ received: true });
    } catch (error) {
      console.error("Error processing webhook:", error);
      res.status(500).send("Webhook processing failed");
    }
  });
}

// Middleware to require Pro membership for printables access
// Checks if user has active Pro membership (includes both trial and paid)
// Usage: app.get("/api/printables", isAuthenticated, requirePrintableAccess, handler)
function requirePrintableAccess(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: "Not logged in" });
  }

  const userId = req.user.claims.sub;
  
  // Check if user has Pro membership access
  storage.getUser(userId).then(user => {
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // Check for active Pro membership (including trial period)
    if (user.proMembershipEndDate && user.proMembershipEndDate > new Date()) {
      return next();
    }

    // No valid access
    return res.status(402).json({ error: "Printable access required. Please purchase lifetime access or subscribe." });
  }).catch(err => {
    console.error("Error checking printable access:", err);
    return res.status(500).json({ error: "Failed to verify access" });
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize email service for sending subscription confirmations
  initializeEmailService();
  
  // Set up authentication middleware (Replit Auth integration)
  await setupAuth(app);

  // Authentication Routes
  
  // GET /api/auth/user
  // Returns the currently logged in user
  // Protected route - requires authentication
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // GET /api/me
  // Returns user profile with derived Pro status and trip count
  // Protected route - requires authentication
  app.get('/api/me', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Count user's trips
      const trips = await storage.getAllTrips(userId);
      const tripsCount = trips.length;

      // Derive isPro from proMembershipEndDate
      const now = new Date();
      const isPro = user.proMembershipEndDate ? new Date(user.proMembershipEndDate) > now : false;
      
      // Derive isTrialing from stored subscription status (no Stripe API call needed)
      // Subscription status is updated by webhooks, avoiding per-request Stripe fetches
      const isTrialing = user.subscriptionStatus === 'trialing';

      res.json({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isPro,
        isTrialing,
        periodEnd: user.proMembershipEndDate,
        proMembershipEndDate: user.proMembershipEndDate,
        tripsCount,
        stripeCustomerId: user.stripeCustomerId,
      });
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  // GET /api/usage/stats
  // Returns usage statistics: trips, meals, and grocery lists
  // Protected route - requires authentication
  app.get('/api/usage/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Count user's trips
      const trips = await storage.getAllTrips(userId);
      const tripsCount = trips.length;
      
      // Count total meals across all trips
      let mealsCount = 0;
      for (const trip of trips) {
        const meals = await storage.getTripMeals(trip.id, userId);
        mealsCount += meals.length;
      }
      
      // Count grocery lists generated (shared grocery lists with trips)
      let groceryListsCount = 0;
      for (const trip of trips) {
        const sharedList = await storage.getSharedGroceryListByTrip(trip.id);
        if (sharedList) {
          groceryListsCount++;
        }
      }

      res.json({
        tripsCount,
        mealsCount,
        groceryListsCount,
      });
    } catch (error) {
      console.error("Error fetching usage stats:", error);
      res.status(500).json({ message: "Failed to fetch usage stats" });
    }
  });

  // GET /api/entitlements
  // Returns user entitlements for trip creation and feature access
  // Protected route - requires authentication
  app.get('/api/entitlements', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Count user's trips
      const trips = await storage.getAllTrips(userId);
      const tripsCount = trips.length;

      // Derive isPro from proMembershipEndDate
      const now = new Date();
      const isPro = user.proMembershipEndDate ? new Date(user.proMembershipEndDate) > now : false;

      // Pro users have unlimited trips, free users are limited to FREE_TRIP_LIMIT
      const canCreateTrip = isPro || tripsCount < FREE_TRIP_LIMIT;
      // Use null for unlimited trips instead of Infinity (JSON serialization safe)
      const remainingTrips = isPro ? null : Math.max(0, FREE_TRIP_LIMIT - tripsCount);

      res.json({
        canCreateTrip,
        remainingTrips, // null = unlimited, number = trips remaining
        limit: isPro ? null : FREE_TRIP_LIMIT,
        isPro,
        tripsCount,
      });
    } catch (error) {
      console.error("Error fetching entitlements:", error);
      res.status(500).json({ message: "Failed to fetch entitlements" });
    }
  });

  // Printables Routes
  
  // GET /api/printables/access
  // Check if user has Pro membership for printables access
  // Includes both trial and paid annual subscriptions
  // Protected route - requires authentication
  app.get('/api/printables/access', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ hasAccess: false, message: "User not found" });
      }

      // Check for active Pro membership (trial or paid)
      if (user.proMembershipEndDate && user.proMembershipEndDate > new Date()) {
        return res.json({ 
          hasAccess: true, 
          accessType: 'pro',
          expiresAt: user.proMembershipEndDate,
          message: "You have Pro membership access to all printables"
        });
      }

      // No access
      return res.json({ 
        hasAccess: false,
        message: "Purchase lifetime access or subscribe to download printables"
      });
    } catch (error) {
      console.error("Error checking printable access:", error);
      res.status(500).json({ hasAccess: false, message: "Failed to check access" });
    }
  });

  // GET /api/printables/downloads
  // Get list of all printables (free and Pro)
  // Optional authentication - works for both logged-in and anonymous users
  // Free users see locked Pro printables, Pro users see download links
  app.get('/api/printables/downloads', isAuthenticatedOptional, async (req: any, res) => {
    // Check if user is logged in and has Pro access
    const user = req.user ?? null;
    let isPro = false;
    
    if (user) {
      try {
        const userId = user.claims.sub;
        const dbUser = await storage.getUser(userId);
        
        // Check if user has active Pro membership (proMembershipEndDate is in the future)
        if (dbUser?.proMembershipEndDate) {
          const now = new Date();
          const endDate = new Date(dbUser.proMembershipEndDate);
          isPro = endDate > now;
          
          // Debug logging to track Pro detection
          console.log(`[Printables] User ${userId} Pro check:`, {
            proMembershipEndDate: dbUser.proMembershipEndDate,
            currentDate: now,
            isPro,
            daysRemaining: Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          });
        } else {
          console.log(`[Printables] User ${userId} has no proMembershipEndDate`);
        }
      } catch (error) {
        console.error("Error checking Pro status:", error);
      }
    } else {
      console.log(`[Printables] Anonymous user request`);
    }

    const printables = [
      {
        id: "free-food-packing",
        title: "Free Food Packing List (US Letter)",
        file: "/printables/THE CAMPING PLANNER - Free Food Packing List US LETTER.pdf",
        description: "Plan meals easily with this free food packing checklist.",
        free: true,
      },
      {
        id: "free-charades",
        title: "Free Camping Charades (US Letter)",
        file: "/printables/FREE CAMPING CHARADES US LETTER.pdf",
        description: "A fun, family-friendly game for the campfire.",
        free: true,
      },
      {
        id: "camping-planner-us",
        title: "The Camping Planner (US Letter)",
        file: "/printables/THE CAMPING PLANNER US LETTER.pdf",
        description: "The original planner to organize every camping trip.",
        requiresPro: true,
      },
      {
        id: "camping-planner-a4",
        title: "The Camping Planner (A4)",
        file: "/printables/THE CAMPING PLANNER A4 SIZE.pdf",
        description: "A4 version of the core planner.",
        requiresPro: true,
      },
      {
        id: "ultimate-planner",
        title: "The ULTIMATE Camping Planner",
        file: "/printables/THE ULTIMATE CAMPING PLANNER US LETTER.pdf",
        description: "All-in-one planner bundle for serious campers.",
        requiresPro: true,
      },
      {
        id: "games-bundle",
        title: "Camping Games Bundle",
        file: "/printables/CAMPING GAMES BUNDLE  US LETTER.pdf",
        description: "A collection of printable games for every age.",
        requiresPro: true,
      },
      {
        id: "mega-activity-book",
        title: "Mega Camping Activity Book (A4)",
        file: "/printables/MEGA CAMPING ACTIVITY BOOK A4.pdf",
        description: "Over 70 pages of fun activities for kids and families.",
        requiresPro: true,
      },
    ];

    // Filter: if not Pro, hide file path for paid ones
    const visible = printables.map((p) => {
      if (p.requiresPro && !isPro) {
        return { ...p, file: null };
      }
      return p;
    });

    res.json({ printables: visible, user: user ? { isPro } : null });
  });

  // GET /api/printables/download/:id
  // Protected endpoint to serve Pro printable PDFs
  // Requires authentication and Pro membership
  app.get('/api/printables/download/:id', isAuthenticated, requirePrintableAccess, async (req: any, res) => {
    const { id } = req.params;
    
    // Whitelist mapping of file IDs to actual PDF filenames
    // This prevents path traversal attacks and ensures only approved files are served
    const fileMap: Record<string, string> = {
      'camping-planner-us': 'THE CAMPING PLANNER US LETTER.pdf',
      'camping-planner-a4': 'THE CAMPING PLANNER A4 SIZE.pdf',
      'ultimate-planner': 'THE ULTIMATE CAMPING PLANNER US LETTER.pdf',
      'games-bundle': 'CAMPING GAMES BUNDLE  US LETTER.pdf',
      'mega-activity-book': 'MEGA CAMPING ACTIVITY BOOK A4.pdf',
    };
    
    const filename = fileMap[id];
    
    if (!filename) {
      console.log(`[Printables] Invalid file ID requested: ${id}`);
      return res.status(404).json({ error: 'Printable not found' });
    }
    
    const filePath = path.resolve(import.meta.dirname, '../client/public/printables', filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`[Printables] File not found on disk: ${filePath}`);
      return res.status(404).json({ error: 'File not found' });
    }
    
    console.log(`[Printables] Serving ${filename} to user ${req.user.claims.sub}`);
    
    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Stream the file
    res.sendFile(filePath);
  });

  // Recipe Routes
  // All routes are prefixed with /api
  // All recipe routes require authentication
  
  // Type definition for structured ingredient from WordPress table
  interface IngredientChecklistItem {
    name: string;
    amountImperial?: string;
    amountMetric?: string;
    notes?: string;
  }

  // Type definition for parsed WordPress recipe content
  interface ParsedRecipeContent {
    ingredientsChecklist: IngredientChecklistItem[];
    extraBullets: string[];
  }

  // Helper function: Parse WordPress recipe HTML to extract structured ingredients
  // This function uses cheerio to parse the HTML and extract both:
  // 1. Structured ingredients from the "Ingredients Checklist" table
  // 2. Extra bullet points (related recipes, tips, etc.)
  // WordPress recipe structure may vary - adjust selectors below if needed
  function parseWordPressRecipe(html: string): ParsedRecipeContent {
    const $ = cheerioLoad(html);
    
    const ingredientsChecklist: IngredientChecklistItem[] = [];
    const extraBullets: string[] = [];
    
    // ========================================
    // PART 1: Extract structured ingredients from table
    // ========================================
    // Look for a table that contains ingredients data
    // The table typically has columns: Ingredient, Amount (Imperial), Metric, Notes
    // ADJUST THIS SELECTOR if your WordPress theme changes the table structure
    
    // Try to find the ingredients table
    // We look for a table that has "Ingredient" in the header
    $('table').each((index: number, tableEl: any) => {
      const $table = $(tableEl);
      const headerCells = $table.find('thead tr th, thead tr td, tr:first-child th, tr:first-child td');
      
      // Check if this looks like an ingredients table by looking at headers
      const headers: string[] = [];
      headerCells.each((i: number, cell: any) => {
        headers.push($(cell).text().trim().toLowerCase());
      });
      
      // If we find "ingredient" in the headers, this is likely our ingredients table
      const hasIngredientHeader = headers.some(h => h.includes('ingredient'));
      
      if (hasIngredientHeader) {
        // Find the column indices for each field
        // ADJUST THESE SEARCH TERMS if your table headers change
        const nameIndex = headers.findIndex(h => h.includes('ingredient'));
        const imperialIndex = headers.findIndex(h => h.includes('imperial') || h.includes('amount'));
        const metricIndex = headers.findIndex(h => h.includes('metric'));
        const notesIndex = headers.findIndex(h => h.includes('note'));
        
        // Get all data rows - prefer tbody if it exists to avoid duplicate processing
        // ADJUST THIS if your table structure doesn't use tbody
        const hasTbody = $table.find('tbody tr').length > 0;
        const rowSelector = hasTbody ? 'tbody tr' : 'tr';
        const dataRows = $table.find(rowSelector);
        
        // Skip first row if we're using all 'tr' (it's the header)
        const startIndex = hasTbody ? 0 : 1;
        
        dataRows.slice(startIndex).each((i: number, rowEl: any) => {
          const $row = $(rowEl);
          const cells = $row.find('td, th');
          
          // Skip if this is a header row
          if (cells.length === 0) return;
          
          // Extract data from each column
          const ingredient: IngredientChecklistItem = {
            name: nameIndex >= 0 ? $(cells[nameIndex]).text().trim() : '',
          };
          
          if (imperialIndex >= 0 && $(cells[imperialIndex]).text().trim()) {
            ingredient.amountImperial = $(cells[imperialIndex]).text().trim();
          }
          
          if (metricIndex >= 0 && $(cells[metricIndex]).text().trim()) {
            ingredient.amountMetric = $(cells[metricIndex]).text().trim();
          }
          
          if (notesIndex >= 0 && $(cells[notesIndex]).text().trim()) {
            ingredient.notes = $(cells[notesIndex]).text().trim();
          }
          
          // Only add if we have at least a name
          if (ingredient.name) {
            ingredientsChecklist.push(ingredient);
          }
        });
      }
    });
    
    // ========================================
    // PART 2: Extract extra bullet points (related recipes, tips, etc.)
    // ========================================
    // We want to collect <li> items, but be smart about filtering:
    // - If we found table-based ingredients, skip the first <ul> (likely suggested recipes)
    // - If no table ingredients were found, include all lists (first list might be ingredients)
    // ADJUST THESE SELECTORS if your WordPress structure changes
    
    const allLists = $('ul');
    
    // Determine starting index: skip first list only if we already have table-based ingredients
    const startIndex = ingredientsChecklist.length > 0 ? 1 : 0;
    
    allLists.slice(startIndex).each((index: number, ulEl: any) => {
      $(ulEl).find('li').each((i: number, liEl: any) => {
        const text = $(liEl).text().trim();
        // Clean up HTML entities
        const cleanText = text
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"');
        
        if (cleanText) {
          extraBullets.push(cleanText);
        }
      });
    });
    
    return {
      ingredientsChecklist,
      extraBullets,
    };
  }

  // Legacy helper function for backward compatibility
  // This is kept for the /ingredients endpoint, but the main endpoint now uses parseWordPressRecipe
  function extractIngredientsFromHtml(html: string): string[] {
    const parsed = parseWordPressRecipe(html);
    // Return the checklist names if available, otherwise extra bullets
    if (parsed.ingredientsChecklist.length > 0) {
      return parsed.ingredientsChecklist.map(item => {
        let text = item.name;
        if (item.amountImperial) text = `${item.amountImperial} ${text}`;
        if (item.notes) text = `${text} (${item.notes})`;
        return text;
      });
    }
    return parsed.extraBullets;
  }
  
  // GET /api/recipes
  // Returns all recipes for the logged in user, sorted by newest first
  // Protected route - requires authentication
  app.get("/api/recipes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recipes = await storage.getAllRecipes(userId);
      res.json(recipes);
    } catch (error) {
      console.error("Error fetching recipes:", error);
      res.status(500).json({ error: "Failed to fetch recipes" });
    }
  });

  // GET /api/external-recipes
  // Fetches latest recipes from WordPress "camping-food" category (ID: 4)
  // Returns: { recipes: Array<{ id, title, slug, url, excerpt, date }> }
  // Protected route - requires authentication
  app.get("/api/external-recipes", isAuthenticated, async (req: any, res) => {
    try {
      // Fetch latest posts from the "camping-food" category (category ID: 4)
      const wpRes = await fetch(
        "https://thecampingplanner.com/wp-json/wp/v2/posts?categories=4&per_page=20"
      );
      
      if (!wpRes.ok) {
        console.error("Failed to fetch from WordPress:", wpRes.status);
        return res.status(500).json({ error: "Failed to fetch external recipes" });
      }
      
      const posts = await wpRes.json();
      
      // Map to the shape our frontend expects
      const recipes = posts.map((p: any) => ({
        id: `wp-${p.id}`,
        title: p.title?.rendered || "Untitled Recipe",
        slug: p.slug,
        url: p.link,
        excerpt: p.excerpt?.rendered || "",
        date: p.date,
        source: "external" as const,
      }));
      
      res.json({ recipes });
    } catch (err) {
      console.error("Failed to fetch external recipes", err);
      res.status(500).json({ error: "Failed to fetch external recipes" });
    }
  });

  // GET /api/recipes/external
  // Fetches camping recipes from TheCampingPlanner.com WordPress site
  // Returns: Array of external recipes with { id, title, source, url, ingredients? }
  // This endpoint tries to fetch posts from the "camping-food" category using WordPress REST API
  // If the API is unavailable or CORS blocks the request, it returns an empty array
  // Protected route - requires authentication
  // IMPORTANT: This route must come BEFORE /api/recipes/:id to avoid matching "external" as an ID
  app.get("/api/recipes/external", isAuthenticated, async (req: any, res) => {
    try {
      // WordPress site base URL
      const siteUrl = "https://thecampingplanner.com";
      
      // Step 1: First, try to find the "camping-food" category ID
      // WordPress REST API exposes categories at /wp-json/wp/v2/categories
      let categoryId: number | null = null;
      
      try {
        const categoriesResponse = await fetch(`${siteUrl}/wp-json/wp/v2/categories?per_page=100`);
        
        if (categoriesResponse.ok) {
          const categories = await categoriesResponse.json();
          // Find the category with slug "camping-food"
          const campingFoodCategory = categories.find(
            (cat: any) => cat.slug === "camping-food"
          );
          
          if (campingFoodCategory) {
            categoryId = campingFoodCategory.id;
          }
        }
      } catch (error) {
        console.log("Failed to fetch categories from WordPress:", error);
        // Continue anyway - we'll return empty array at the end
      }
      
      // Step 2: If we found the category ID, fetch posts from that category
      if (categoryId) {
        try {
          // Fetch up to 20 posts from the camping-food category
          // Use _fields parameter to limit the response size for faster loading
          const postsUrl = `${siteUrl}/wp-json/wp/v2/posts?categories=${categoryId}&per_page=20&_fields=id,title,link,excerpt`;
          const postsResponse = await fetch(postsUrl);
          
          if (postsResponse.ok) {
            const posts = await postsResponse.json();
            
            // Transform WordPress posts into our external recipe format
            const externalRecipes = posts.map((post: any) => ({
              // Use WordPress post ID as string to avoid conflicts with internal recipe IDs
              id: `wp-${post.id}`,
              
              // WordPress returns title as { rendered: "..." }
              title: post.title?.rendered || "Untitled Recipe",
              
              // Mark as external source so frontend knows this is from WordPress
              source: "external" as const,
              
              // Link to the full recipe on TheCampingPlanner.com
              url: post.link,
              
              // For now, we can't extract ingredients from WordPress
              // This could be enhanced later with web scraping if needed
              ingredients: undefined,
            }));
            
            return res.json(externalRecipes);
          }
        } catch (error) {
          console.log("Failed to fetch posts from WordPress:", error);
          // Continue to return empty array
        }
      }
      
      // If we couldn't fetch recipes (no category found, CORS error, etc.), return empty array
      // This allows the frontend to still render without breaking
      res.json([]);
    } catch (error) {
      console.error("Error in external recipes endpoint:", error);
      // Return empty array instead of error to gracefully handle failures
      res.json([]);
    }
  });

  // GET /api/recipes/external/:id
  // Fetches a single external recipe from WordPress by post ID
  // Example: /api/recipes/external/wp-12345
  // Returns: { id, title, contentHtml, ingredients[], url }
  // PUBLIC route - no authentication required
  // IMPORTANT: This route must come BEFORE /api/recipes/:id to avoid routing conflicts
  app.get("/api/recipes/external/:id", async (req: any, res) => {
    try {
      const externalId = req.params.id;
      
      // Extract the WordPress post ID from our prefixed format (wp-12345 -> 12345)
      // If the ID doesn't start with "wp-", try to use it as-is
      let wpPostId: string;
      if (externalId.startsWith("wp-")) {
        wpPostId = externalId.substring(3); // Remove "wp-" prefix
      } else {
        wpPostId = externalId;
      }
      
      // WordPress site base URL
      // You can change this URL if you move your WordPress site or want to use a different one
      const siteUrl = "https://thecampingplanner.com";
      
      // Fetch the full post from WordPress REST API
      // WordPress REST API endpoint: /wp-json/wp/v2/posts/:id
      // You can add more fields by modifying the _fields parameter below
      const postUrl = `${siteUrl}/wp-json/wp/v2/posts/${wpPostId}`;
      
      const response = await fetch(postUrl);
      
      if (!response.ok) {
        return res.status(404).json({ error: "Recipe not found on WordPress" });
      }
      
      const post = await response.json();
      
      // Extract the HTML content from the post
      // WordPress returns content as { rendered: "..." }
      const contentHtml = post.content?.rendered || "";
      
      // Parse the HTML to extract structured ingredients and extra content
      // Uses cheerio to find ingredients table and filter out unrelated bullets
      const parsed = parseWordPressRecipe(contentHtml);
      
      // Return the recipe data with structured ingredients
      // ingredientsChecklist: Structured table data with amounts and notes
      // extraBullets: Additional content like related recipes or tips
      res.json({
        id: externalId,
        title: post.title?.rendered || "Untitled Recipe",
        contentHtml,
        ingredientsChecklist: parsed.ingredientsChecklist,
        extraBullets: parsed.extraBullets,
        url: post.link,
      });
    } catch (error) {
      console.error("Error fetching external recipe:", error);
      res.status(500).json({ error: "Failed to fetch recipe from WordPress" });
    }
  });

  // GET /api/recipes/external/:id/ingredients
  // Returns just the ingredients array for an external recipe
  // This is a convenience endpoint for "downloading" or copying just the ingredients
  // Example: /api/recipes/external/wp-12345/ingredients
  // Returns: { ingredients: [...] }
  // PUBLIC route - no authentication required
  // IMPORTANT: This route must come BEFORE /api/recipes/:id to avoid routing conflicts
  app.get("/api/recipes/external/:id/ingredients", async (req: any, res) => {
    try {
      const externalId = req.params.id;
      
      // Extract the WordPress post ID from our prefixed format (wp-12345 -> 12345)
      let wpPostId: string;
      if (externalId.startsWith("wp-")) {
        wpPostId = externalId.substring(3);
      } else {
        wpPostId = externalId;
      }
      
      // WordPress site base URL (same as above - you can change this if needed)
      const siteUrl = "https://thecampingplanner.com";
      
      // Fetch just the content field to extract ingredients
      // Using _fields parameter to minimize data transfer
      const postUrl = `${siteUrl}/wp-json/wp/v2/posts/${wpPostId}?_fields=content`;
      
      const response = await fetch(postUrl);
      
      if (!response.ok) {
        return res.status(404).json({ error: "Recipe not found on WordPress" });
      }
      
      const post = await response.json();
      const contentHtml = post.content?.rendered || "";
      
      // Extract ingredients using the shared helper function
      const ingredients = extractIngredientsFromHtml(contentHtml);
      
      // Return just the ingredients array (not the full recipe data)
      res.json({ ingredients });
    } catch (error) {
      console.error("Error fetching external recipe ingredients:", error);
      res.status(500).json({ error: "Failed to fetch ingredients from WordPress" });
    }
  });

  // POST /api/recipes/share
  // Shares a recipe with a collaborator via email
  // Body: { recipeId: string | number, toEmail: string }
  // Returns: { message: string } - A message that can be copied and sent
  // This endpoint builds a shareable message about the recipe
  // In the future, this can be connected to an email service to actually send the email
  // Protected route - requires authentication
  // IMPORTANT: This route must come BEFORE /api/recipes/:id to avoid routing conflicts
  app.post("/api/recipes/share", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate the request body
      const shareSchema = z.object({
        recipeId: z.union([z.number(), z.string()]),
        toEmail: z.string().email("Invalid email address"),
      });
      
      const { recipeId, toEmail } = shareSchema.parse(req.body);
      
      let recipeTitle: string;
      let recipeUrl: string | null = null;
      let recipeIngredients: string[] | undefined;
      
      // Check if this is an external recipe (starts with "wp-") or internal recipe (number)
      if (typeof recipeId === "string" && recipeId.startsWith("wp-")) {
        // This is an external WordPress recipe
        // For external recipes, we don't have the full data stored locally
        // The frontend should have passed the title and URL, but we'll construct a generic message
        recipeTitle = "A Camping Recipe from TheCampingPlanner.com";
        recipeUrl = `https://thecampingplanner.com/category/camping-food/`;
      } else {
        // This is an internal recipe - fetch it from the database
        const numericId = typeof recipeId === "string" ? parseInt(recipeId) : recipeId;
        
        if (isNaN(numericId)) {
          return res.status(400).json({ error: "Invalid recipe ID format" });
        }
        
        const recipe = await storage.getRecipeById(numericId, userId);
        
        if (!recipe) {
          return res.status(404).json({ error: "Recipe not found" });
        }
        
        recipeTitle = recipe.title;
        recipeIngredients = recipe.ingredients;
        // For internal recipes, we don't have a public URL yet
        // In the future, you could generate a shareable link
        recipeUrl = null;
      }
      
      // Build the shareable message
      // This message can be copied by the user and sent manually
      // Or in the future, sent automatically via email service
      let message = `Your friend shared a camping recipe with you!\n\n`;
      message += `Recipe: ${recipeTitle}\n\n`;
      
      if (recipeIngredients && recipeIngredients.length > 0) {
        message += `Ingredients:\n`;
        recipeIngredients.forEach(ingredient => {
          message += `• ${ingredient}\n`;
        });
        message += `\n`;
      }
      
      if (recipeUrl) {
        message += `View the full recipe here: ${recipeUrl}\n`;
      } else {
        message += `Ask your friend for more details about this recipe!\n`;
      }
      
      message += `\nHappy camping! 🏕️`;
      
      // Return the message to the frontend
      res.json({ 
        message,
        recipient: toEmail,
      });
    } catch (error) {
      // Handle validation errors from Zod
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: error.errors 
        });
      }
      
      console.error("Error sharing recipe:", error);
      res.status(500).json({ error: "Failed to share recipe" });
    }
  });

  // GET /api/recipes/scrape
  // Fetches HTML content from a recipe URL to enable client-side JSON-LD parsing
  // Query parameter: url (the recipe URL to scrape)
  // Returns: { html: string }
  // This endpoint bypasses CORS restrictions by fetching on the server side
  // Protected route - requires authentication
  // SECURITY: Only allows scraping from trusted recipe domains to prevent SSRF attacks
  app.get("/api/recipes/scrape", isAuthenticated, async (req: any, res) => {
    try {
      const url = req.query.url as string;
      
      if (!url) {
        return res.status(400).json({ error: "URL parameter is required" });
      }
      
      // SSRF Protection: Validate URL, resolve ALL IPs, and check for private ranges
      const validation = await validateUrlForSSRF(url);
      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }
      
      // Fetch the HTML content
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CampingPlannerBot/1.0)',
        },
      });
      
      if (!response.ok) {
        return res.status(response.status).json({ 
          error: `Failed to fetch URL: ${response.statusText}` 
        });
      }
      
      const html = await response.text();
      
      // Return the HTML content for client-side parsing
      res.json({ html });
    } catch (error) {
      console.error("Error scraping recipe URL:", error);
      res.status(500).json({ error: "Failed to scrape recipe" });
    }
  });

  // POST /api/recipes/parse
  // Fetches and parses a recipe URL using JSON-LD and fallback scraping
  // Body: { url: string }
  // Returns: { title: string, ingredients: string[], steps: string[], imageUrl?: string }
  // This endpoint provides server-side parsing for more consistent and robust results
  // Protected route - requires authentication
  app.post("/api/recipes/parse", isAuthenticated, async (req: any, res) => {
    try {
      const { url } = req.body;
      
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: "URL is required" });
      }
      
      // SSRF Protection: Validate URL, resolve ALL IPs, and check for private ranges
      const validation = await validateUrlForSSRF(url);
      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }
      
      // Fetch the HTML content
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CampingPlannerBot/1.0)',
        },
      });
      
      if (!response.ok) {
        return res.status(response.status).json({ 
          error: `Failed to fetch URL: ${response.statusText}` 
        });
      }
      
      const html = await response.text();
      
      // Extract JSON-LD recipe data
      const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
      let match;
      
      while ((match = jsonLdRegex.exec(html)) !== null) {
        try {
          const jsonData = JSON.parse(match[1]);
          
          // Handle both single objects and arrays of objects
          const recipes = Array.isArray(jsonData) ? jsonData : [jsonData];
          
          for (const item of recipes) {
            // Check if this is a Recipe object (can be nested in @graph)
            const recipe = item['@type'] === 'Recipe' ? item : 
                          item['@graph']?.find((g: any) => g['@type'] === 'Recipe');
            
            if (!recipe) continue;
            
            // Extract title
            const title = recipe.name || recipe.headline || '';
            if (!title) continue;
            
            // Extract ingredients
            let ingredients: string[] = [];
            if (Array.isArray(recipe.recipeIngredient)) {
              ingredients = recipe.recipeIngredient.map((ing: any) => 
                typeof ing === 'string' ? ing : ing.text || ''
              ).filter(Boolean);
            }
            
            // Extract steps/instructions
            let steps: string[] = [];
            if (recipe.recipeInstructions) {
              if (typeof recipe.recipeInstructions === 'string') {
                steps = recipe.recipeInstructions
                  .split(/\n+/)
                  .map((s: string) => s.trim())
                  .filter((s: string) => s && s.length > 10);
              } else if (Array.isArray(recipe.recipeInstructions)) {
                steps = recipe.recipeInstructions.map((step: any) => {
                  if (typeof step === 'string') return step;
                  if (step['@type'] === 'HowToStep') return step.text || step.name || '';
                  if (step.text) return step.text;
                  return '';
                }).filter(Boolean);
              }
            }
            
            // Extract image URL
            let imageUrl: string | undefined;
            if (recipe.image) {
              if (typeof recipe.image === 'string') {
                imageUrl = recipe.image;
              } else if (Array.isArray(recipe.image)) {
                imageUrl = recipe.image[0];
              } else if (recipe.image.url) {
                imageUrl = recipe.image.url;
              }
            }
            
            // Return if we have at least title and ingredients
            if (title && ingredients.length > 0) {
              return res.json({
                title,
                ingredients,
                steps,
                imageUrl,
              });
            }
          }
        } catch (parseError) {
          console.warn('Failed to parse JSON-LD block:', parseError);
          continue;
        }
      }
      
      // If JSON-LD extraction failed, try HTML scraping for TheCampingPlanner.com
      const urlObj = new URL(url);
      const isTheCampingPlanner = urlObj.hostname.includes('thecampingplanner.com');
      
      if (isTheCampingPlanner) {
        console.log('[Recipe Parser] JSON-LD failed for TheCampingPlanner.com, trying HTML scraping...');
        
        try {
          const $ = cheerioLoad(html);
          
          // Extract title from h1 or .entry-title
          let title = '';
          const h1Text = $('h1.entry-title').first().text().trim();
          if (h1Text) {
            title = h1Text;
          } else {
            title = $('h1').first().text().trim();
          }
          
          // Extract ingredients from list under "Ingredients" heading
          // Only process the FIRST ingredients section to avoid duplicates
          const ingredients: string[] = [];
          let foundIngredients = false;
          
          $('h2, h3, h4').each((_, elem) => {
            if (foundIngredients) return; // Stop after first section
            
            const headingText = $(elem).text().toLowerCase();
            if (headingText.includes('ingredient')) {
              foundIngredients = true;
              
              // Get the next ul or ol list after this heading
              let list = $(elem).next('ul, ol');
              if (list.length === 0) {
                // Try finding the list in the next sibling(s)
                list = $(elem).nextAll('ul, ol').first();
              }
              
              if (list.length > 0) {
                list.find('li').each((_, li) => {
                  const text = $(li).text().trim();
                  if (text) {
                    ingredients.push(text);
                  }
                });
              }
            }
          });
          
          // Extract instructions/steps
          // Only process the FIRST instructions section to avoid duplicates
          const steps: string[] = [];
          let foundSteps = false;
          
          $('h2, h3, h4').each((_, elem) => {
            if (foundSteps) return; // Stop after first section
            
            const headingText = $(elem).text().toLowerCase();
            if (headingText.includes('instruction') || headingText.includes('direction') || headingText.includes('step')) {
              foundSteps = true;
              
              // Get the next ol or ul list
              let list = $(elem).next('ol, ul');
              if (list.length === 0) {
                list = $(elem).nextAll('ol, ul').first();
              }
              
              if (list.length > 0) {
                list.find('li').each((_, li) => {
                  const text = $(li).text().trim();
                  if (text && text.length > 10) {
                    steps.push(text);
                  }
                });
              }
              // Remove paragraph fallback to avoid capturing narrative text
            }
          });
          
          // Extract image from .entry-content img or first img
          let imageUrl: string | undefined;
          const firstImg = $('.entry-content img, .post-content img, article img').first();
          if (firstImg.length > 0) {
            const src = firstImg.attr('src') || firstImg.attr('data-src');
            if (src && src.startsWith('http')) {
              imageUrl = src;
            }
          }
          
          console.log(`[Recipe Parser] HTML scraping found: ${ingredients.length} ingredients, ${steps.length} steps`);
          
          // Return scraped data if we found at least title and ingredients
          if (title && ingredients.length > 0) {
            return res.json({
              title,
              ingredients,
              steps,
              imageUrl,
            });
          }
        } catch (scrapeError) {
          console.warn('[Recipe Parser] HTML scraping failed:', scrapeError);
        }
      }
      
      // If all parsing methods failed, return empty data for manual entry
      return res.json({
        title: '',
        ingredients: [],
        steps: [],
      });
    } catch (error) {
      console.error("Error parsing recipe:", error);
      res.status(500).json({ error: "Failed to parse recipe" });
    }
  });

  // GET /api/recipes/:id
  // Returns a single recipe by ID (only if user owns it)
  // Protected route - requires authentication
  app.get("/api/recipes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      // Validate that ID is a valid number
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid recipe ID" });
      }

      const recipe = await storage.getRecipeById(id, userId);
      
      if (!recipe) {
        return res.status(404).json({ error: "Recipe not found" });
      }

      res.json(recipe);
    } catch (error) {
      console.error("Error fetching recipe:", error);
      res.status(500).json({ error: "Failed to fetch recipe" });
    }
  });

  // POST /api/recipes
  // Creates a new recipe for the logged in user
  // Body: { title: string, ingredients: string[], steps: string }
  // Protected route - requires authentication
  app.post("/api/recipes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate the request body against our schema
      const validatedData = insertRecipeSchema.parse(req.body);
      
      // Create the recipe in storage (with userId)
      const recipe = await storage.createRecipe(validatedData, userId);
      
      // Return the created recipe with 201 status
      res.status(201).json(recipe);
    } catch (error) {
      // Handle validation errors from Zod
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid recipe data", 
          details: error.errors 
        });
      }
      
      console.error("Error creating recipe:", error);
      res.status(500).json({ error: "Failed to create recipe" });
    }
  });

  // GET /api/search
  // Searches recipes by title for the logged in user
  // Query parameter: q (the search query)
  // Example: /api/search?q=chili
  // Protected route - requires authentication
  app.get("/api/search", isAuthenticated, async (req: any, res) => {
    try {
      const query = req.query.q as string;
      const userId = req.user.claims.sub;
      
      // Validate that query exists
      if (!query || query.trim() === "") {
        return res.status(400).json({ error: "Search query is required" });
      }

      const recipes = await storage.searchRecipes(query, userId);
      res.json(recipes);
    } catch (error) {
      console.error("Error searching recipes:", error);
      res.status(500).json({ error: "Failed to search recipes" });
    }
  });

  // Grocery List Routes
  
  // Helper function to categorize ingredients
  // Analyzes ingredient text to determine which category it belongs to
  function categorizeIngredient(ingredient: string): GroceryCategory {
    const lower = ingredient.toLowerCase();
    
    // Produce keywords
    if (/(tomato|lettuce|onion|pepper|carrot|potato|celery|garlic|mushroom|broccoli|spinach|cucumber|zucchini|corn|pea|bean|apple|banana|orange|lemon|lime|berry|fruit|vegetable)/i.test(lower)) {
      return "Produce";
    }
    
    // Dairy keywords
    if (/(milk|cheese|butter|cream|yogurt|sour cream|cottage cheese|cheddar|mozzarella|parmesan)/i.test(lower)) {
      return "Dairy";
    }
    
    // Meat keywords
    if (/(beef|chicken|pork|turkey|fish|salmon|tuna|bacon|sausage|ham|steak|ground beef|meat)/i.test(lower)) {
      return "Meat";
    }
    
    // Camping Gear keywords
    if (/(foil|paper|plate|cup|napkin|utensil|fork|knife|spoon|lighter|match|firewood|charcoal|grill)/i.test(lower)) {
      return "Camping Gear";
    }
    
    // Default to Pantry for everything else (spices, canned goods, oils, etc.)
    return "Pantry";
  }
  
  // POST /api/grocery/generate
  // Generates a grocery list from selected recipes
  // Body: { recipeIds: number[] }
  // Returns: { items: GroceryItem[] } grouped by category
  // Protected route - requires authentication
  app.post("/api/grocery/generate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate the request body
      const { recipeIds } = generateGroceryListSchema.parse(req.body);
      
      // Fetch all selected recipes (user can only access their own recipes)
      const recipes = await Promise.all(
        recipeIds.map(id => storage.getRecipeById(id, userId))
      );
      
      // Filter out any null recipes (in case some IDs don't exist)
      const validRecipes = recipes.filter((r): r is Recipe => r !== null && r !== undefined);
      
      if (validRecipes.length === 0) {
        return res.status(404).json({ error: "No valid recipes found" });
      }
      
      // Collect all ingredients from selected recipes
      const allIngredients: string[] = [];
      validRecipes.forEach(recipe => {
        allIngredients.push(...recipe.ingredients);
      });
      
      // Normalize and deduplicate ingredients (case-insensitive)
      const uniqueIngredients = Array.from(
        new Set(allIngredients.map(i => i.trim().toLowerCase()))
      ).map(i => {
        // Find the original casing from the first occurrence
        return allIngredients.find(orig => orig.trim().toLowerCase() === i) || i;
      });
      
      // Categorize each ingredient and create GroceryItem objects
      const groceryItems: GroceryItem[] = uniqueIngredients.map(ingredient => ({
        name: ingredient,
        category: categorizeIngredient(ingredient),
        checked: false,
      }));
      
      // Group by category
      const grouped: Record<GroceryCategory, GroceryItem[]> = {
        "Produce": [],
        "Dairy": [],
        "Meat": [],
        "Pantry": [],
        "Camping Gear": [],
      };
      
      groceryItems.forEach(item => {
        grouped[item.category].push(item);
      });
      
      res.json({ items: groceryItems, grouped });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: error.errors 
        });
      }
      
      console.error("Error generating grocery list:", error);
      res.status(500).json({ error: "Failed to generate grocery list" });
    }
  });

  // Helper function for creating shareable tokens
  // Used by both /api/grocery/share (backward compat) and /api/grocery/share/link
  async function createShareTokenHandler(req: any, res: any) {
    try {
      const userId = req.user.claims.sub;
      
      // Check if user has reached the free tier grocery list limit
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Derive isPro from proMembershipEndDate
      const now = new Date();
      const isPro = user.proMembershipEndDate ? new Date(user.proMembershipEndDate) > now : false;

      // If not Pro, check grocery limit using counter field
      if (!isPro && user.groceryCount >= FREE_GROCERY_LIMIT) {
        return res.status(402).json({ 
          code: "PAYWALL",
          message: "You've reached the free limit of 5 shared grocery lists. Start a free trial to create unlimited lists."
        });
      }
      
      // Validate the request body
      const data = createSharedGroceryListSchema.parse(req.body);
      
      // Create the shared grocery list
      const sharedList = await storage.createSharedGroceryList(data, userId);
      
      // Increment the grocery counter for the user
      await storage.incrementGroceryCount(userId);
      
      // Generate the full shareable URL
      const shareUrl = `${req.protocol}://${req.get('host')}/shared/${sharedList.token}`;
      
      res.json({ 
        token: sharedList.token,
        shareUrl,
        id: sharedList.id,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: error.errors 
        });
      }
      
      console.error("Error creating shared grocery list:", error);
      res.status(500).json({ error: "Failed to create shared list" });
    }
  }

  // POST /api/grocery-lists
  // Creates and persists a grocery list (not necessarily shared yet)
  // Body: { items: GroceryItem[], tripId?: number, tripName?: string }
  // Returns: { token: string, id: number, listUrl: string }
  // Protected route - requires authentication
  // Note: Used for saving lists from "Build Your Grocery List" flow
  app.post("/api/grocery-lists", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Check if user has reached the free tier grocery list limit
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Derive isPro from proMembershipEndDate
      const now = new Date();
      const isPro = user.proMembershipEndDate ? new Date(user.proMembershipEndDate) > now : false;

      // If not Pro, check grocery limit using counter field
      if (!isPro && user.groceryCount >= FREE_GROCERY_LIMIT) {
        return res.status(402).json({ 
          code: "PAYWALL",
          message: "You've reached the free limit of 5 shared grocery lists. Start a free trial to create unlimited lists."
        });
      }
      
      // Validate the request body
      const data = createSharedGroceryListSchema.parse(req.body);
      
      // Create the grocery list in the database
      const groceryList = await storage.createSharedGroceryList(data, userId);
      
      // Increment the grocery counter for the user
      await storage.incrementGroceryCount(userId);
      
      // Generate the list URL (not a share URL - user can view their own list)
      const listUrl = `${req.protocol}://${req.get('host')}/grocery/list/${groceryList.token}`;
      
      console.log(`[GroceryList] Created grocery list ${groceryList.id} for user ${userId} with ${data.items.length} items`);
      
      res.json({ 
        token: groceryList.token,
        id: groceryList.id,
        listUrl,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: error.errors 
        });
      }
      
      console.error("Error creating grocery list:", error);
      res.status(500).json({ error: "Failed to create grocery list" });
    }
  });

  // GET /api/grocery-lists/:token
  // Retrieves a saved grocery list by its token
  // Public route - no authentication required (anyone with token can view)
  app.get("/api/grocery-lists/:token", async (req: any, res) => {
    try {
      const { token } = req.params;
      
      // Retrieve the grocery list
      const groceryList = await storage.getSharedGroceryListByToken(token);
      
      if (!groceryList) {
        return res.status(404).json({ error: "Grocery list not found or expired" });
      }
      
      res.json(groceryList);
    } catch (error) {
      console.error("Error fetching grocery list:", error);
      res.status(500).json({ error: "Failed to fetch grocery list" });
    }
  });

  // POST /api/grocery/share/link
  // Creates a shareable grocery list with a unique token
  // Body: { items: GroceryItem[], tripId?: number, tripName?: string, collaborators?: string[] }
  // Returns: { token: string, shareUrl: string }
  // Protected route - requires authentication
  // Note: Preferred endpoint for token sharing
  app.post("/api/grocery/share/link", isAuthenticated, createShareTokenHandler);

  // GET /api/grocery/shared/:token
  // Retrieves a shared grocery list by its token
  // Public route - no authentication required
  app.get("/api/grocery/shared/:token", async (req: any, res) => {
    try {
      const { token } = req.params;
      
      // Retrieve the shared list
      const sharedList = await storage.getSharedGroceryListByToken(token);
      
      if (!sharedList) {
        return res.status(404).json({ error: "Shared list not found or expired" });
      }
      
      res.json(sharedList);
    } catch (error) {
      console.error("Error fetching shared grocery list:", error);
      res.status(500).json({ error: "Failed to fetch shared list" });
    }
  });

  // Campground Search Routes
  
  // GET /api/campgrounds
  // Search for campgrounds by location query
  // Protected route - requires authentication
  app.get("/api/campgrounds", isAuthenticated, async (req: any, res) => {
    try {
      // Validate query parameter
      const validation = searchCampgroundsSchema.safeParse({
        query: req.query.query || ""
      });
      
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: validation.error.errors 
        });
      }
      
      const { query } = validation.data;
      const campgrounds = await storage.searchCampgrounds(query);
      
      res.json({ campgrounds });
    } catch (error) {
      console.error("Error searching campgrounds:", error);
      res.status(500).json({ error: "Failed to search campgrounds" });
    }
  });

  // Camping Basics Routes
  
  // GET /api/camping-basics
  // Get the user's selected camping basics (items to add to grocery list)
  // Protected route - requires authentication
  app.get("/api/camping-basics", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const selectedBasics = await storage.getCampingBasics(userId);
      
      res.json({ selectedBasics });
    } catch (error) {
      console.error("Error fetching camping basics:", error);
      res.status(500).json({ error: "Failed to fetch camping basics" });
    }
  });

  // POST /api/camping-basics
  // Add a camping basic to the user's selected list
  // Body: { basicId: string } - must be a valid CAMPING_BASICS ID
  // Protected route - requires authentication
  app.post("/api/camping-basics", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate the request body against our schema
      const validatedData = addCampingBasicSchema.parse(req.body);
      
      // Add the camping basic
      const selectedBasics = await storage.addCampingBasic(userId, validatedData.basicId);
      
      res.json({ selectedBasics });
    } catch (error) {
      // Handle validation errors from Zod
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid camping basic data", 
          details: error.errors 
        });
      }
      
      console.error("Error adding camping basic:", error);
      res.status(500).json({ error: "Failed to add camping basic" });
    }
  });

  // DELETE /api/camping-basics/:basicId
  // Remove a camping basic from the user's selected list
  // URL param: basicId - must be a valid CAMPING_BASICS ID
  // Protected route - requires authentication
  app.delete("/api/camping-basics/:basicId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate the basicId parameter against our schema
      const validatedData = addCampingBasicSchema.parse({ basicId: req.params.basicId });
      
      // Remove the camping basic
      const selectedBasics = await storage.removeCampingBasic(userId, validatedData.basicId);
      
      res.json({ selectedBasics });
    } catch (error) {
      // Handle validation errors from Zod
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid camping basic ID", 
          details: error.errors 
        });
      }
      
      console.error("Error removing camping basic:", error);
      res.status(500).json({ error: "Failed to remove camping basic" });
    }
  });

  // Trip Routes
  
  // GET /api/trips
  // Returns all trips for the logged in user, sorted by start date (newest first)
  // Protected route - requires authentication
  app.get("/api/trips", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const trips = await storage.getAllTrips(userId);
      res.json(trips);
    } catch (error) {
      console.error("Error fetching trips:", error);
      res.status(500).json({ error: "Failed to fetch trips" });
    }
  });

  // GET /api/trips/:id
  // Returns a single trip by ID with all details (only if user owns it)
  // Protected route - requires authentication
  app.get("/api/trips/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      // Validate that ID is a valid number
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid trip ID" });
      }

      const trip = await storage.getTripById(id, userId);
      
      if (!trip) {
        return res.status(404).json({ error: "Trip not found" });
      }

      res.json(trip);
    } catch (error) {
      console.error("Error fetching trip:", error);
      res.status(500).json({ error: "Failed to fetch trip" });
    }
  });

  // POST /api/trips
  // Creates a new trip for the logged in user
  // Body: { name: string, location: string, startDate: Date, endDate: Date, lat?: number, lng?: number }
  // Optional geocoding: If location is provided but coordinates are not, and geocoding API key exists,
  // the server will attempt to geocode the location and save coordinates for weather forecasts
  // Protected route - requires authentication
  // Free tier: Limited to FREE_TRIP_LIMIT trips (default 5)
  app.post("/api/trips", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Check if user has reached the free tier trip limit
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Derive isPro from proMembershipEndDate
      const now = new Date();
      const isPro = user.proMembershipEndDate ? new Date(user.proMembershipEndDate) > now : false;

      // If not Pro, check trip limit using counter field
      if (!isPro && user.tripsCount >= FREE_TRIP_LIMIT) {
        return res.status(402).json({ 
          code: "PAYWALL",
          message: "You've reached the free limit of 5 trips. Start a free trial to create unlimited trips."
        });
      }
      
      // Validate the request body against our schema
      const validatedData = insertTripSchema.parse(req.body);
      
      // TODO: Geocoding placeholder
      // If location is provided but coordinates are missing, attempt geocoding
      // Supported services: Mapbox (requires MAPBOX_TOKEN), Google Maps (requires GOOGLE_MAPS_API_KEY),
      // or OpenCage (requires OPENCAGE_API_KEY)
      // Example:
      // if (validatedData.location && !validatedData.lat && !validatedData.lng) {
      //   if (process.env.MAPBOX_TOKEN) {
      //     const coords = await geocodeLocation(validatedData.location, process.env.MAPBOX_TOKEN);
      //     validatedData.lat = coords.lat;
      //     validatedData.lng = coords.lng;
      //   }
      // }
      
      // Create the trip in storage (with userId)
      const trip = await storage.createTrip(validatedData, userId);
      
      // Increment the trip counter for the user
      await storage.incrementTripsCount(userId);
      
      // Return the created trip with 201 status
      res.status(201).json(trip);
    } catch (error) {
      // Handle validation errors from Zod
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid trip data", 
          details: error.errors 
        });
      }
      
      console.error("Error creating trip:", error);
      res.status(500).json({ error: "Failed to create trip" });
    }
  });

  // PUT /api/trips/:id
  // Updates an existing trip for the logged in user
  // Body: { name?: string, location?: string, startDate?: Date, endDate?: Date, lat?: number, lng?: number }
  // All fields are optional for partial updates
  // If location changes and geocoding API key exists, coordinates will be updated
  // Protected route - requires authentication
  app.put("/api/trips/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tripId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      // Validate trip ID
      if (isNaN(tripId)) {
        return res.status(400).json({ error: "Invalid trip ID" });
      }
      
      // Get the existing trip to check ownership and compare location
      const existingTrip = await storage.getTripById(tripId, userId);
      if (!existingTrip) {
        return res.status(404).json({ error: "Trip not found" });
      }
      
      // Validate the request body against our schema
      const validatedData = updateTripSchema.parse(req.body);
      
      // TODO: Geocoding placeholder
      // If location changed and coordinates weren't manually provided, attempt geocoding
      // Supported services: Mapbox (requires MAPBOX_TOKEN), Google Maps (requires GOOGLE_MAPS_API_KEY),
      // or OpenCage (requires OPENCAGE_API_KEY)
      // Example:
      // if (validatedData.location && 
      //     validatedData.location !== existingTrip.location && 
      //     validatedData.lat === undefined && 
      //     validatedData.lng === undefined) {
      //   if (process.env.MAPBOX_TOKEN) {
      //     const coords = await geocodeLocation(validatedData.location, process.env.MAPBOX_TOKEN);
      //     validatedData.lat = coords.lat;
      //     validatedData.lng = coords.lng;
      //   }
      // }
      
      // Update the trip
      const updatedTrip = await storage.updateTrip(tripId, validatedData, userId);
      
      if (!updatedTrip) {
        return res.status(404).json({ error: "Trip not found" });
      }
      
      res.json(updatedTrip);
    } catch (error) {
      // Handle validation errors from Zod
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid trip update data", 
          details: error.errors 
        });
      }
      
      console.error("Error updating trip:", error);
      res.status(500).json({ error: "Failed to update trip" });
    }
  });

  // POST /api/trips/:id/collaborators
  // Add a collaborator to a trip
  // Body: { collaborator: string }
  // The collaborator string will be normalized (trimmed, lowercased) before storing
  // Protected route - requires authentication
  app.post("/api/trips/:id/collaborators", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      // Validate trip ID
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid trip ID" });
      }

      // Validate the request body
      const { collaborator } = addCollaboratorSchema.parse(req.body);
      
      // Add the collaborator to the trip (with ownership check)
      const updatedTrip = await storage.addCollaborator(id, collaborator, userId);
      
      if (!updatedTrip) {
        return res.status(404).json({ error: "Trip not found" });
      }

      res.json(updatedTrip);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid collaborator data", 
          details: error.errors 
        });
      }
      
      console.error("Error adding collaborator:", error);
      res.status(500).json({ error: "Failed to add collaborator" });
    }
  });

  // POST /api/trips/:id/cost
  // Update cost information for a trip
  // Body: { total: number, paidBy?: string }
  // The total will be stored with 2 decimal places
  // Protected route - requires authentication
  app.post("/api/trips/:id/cost", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      // Validate trip ID
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid trip ID" });
      }

      // Validate the request body
      const validatedData = addTripCostSchema.parse(req.body);
      
      // Convert to number if it was a string
      const total = typeof validatedData.total === 'string' 
        ? parseFloat(validatedData.total) 
        : validatedData.total;
      
      // Update the trip cost (with ownership check)
      const updatedTrip = await storage.updateTripCost(id, total, userId, validatedData.paidBy);
      
      if (!updatedTrip) {
        return res.status(404).json({ error: "Trip not found" });
      }

      res.json(updatedTrip);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid cost data", 
          details: error.errors 
        });
      }
      
      console.error("Error updating trip cost:", error);
      res.status(500).json({ error: "Failed to update trip cost" });
    }
  });

  // GET /api/trips/:id/meals
  // Get all meals for a trip
  // Protected route - requires authentication
  app.get("/api/trips/:id/meals", isAuthenticated, async (req: any, res) => {
    try {
      const tripId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      // Validate trip ID
      if (isNaN(tripId)) {
        return res.status(400).json({ error: "Invalid trip ID" });
      }

      // Get all meals for the trip (with ownership check)
      const meals = await storage.getTripMeals(tripId, userId);
      
      res.json(meals);
    } catch (error: any) {
      console.error("Error fetching trip meals:", error);
      res.status(500).json({ error: error.message || "Failed to fetch trip meals" });
    }
  });

  // POST /api/trips/:id/meals
  // Add a recipe (meal) to a trip - supports both internal and external recipes
  // Body: { recipeId: number } for internal OR { isExternal: true, externalRecipeId: string, title: string, sourceUrl: string } for external
  // Protected route - requires authentication
  app.post("/api/trips/:id/meals", isAuthenticated, async (req: any, res) => {
    try {
      const tripId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      // Validate trip ID
      if (isNaN(tripId)) {
        return res.status(400).json({ error: "Invalid trip ID" });
      }

      // Validate the request body using the updated addMealSchema
      const mealData = addMealSchema.parse(req.body);

      // For internal recipes, check if recipe exists and user owns it
      if (!mealData.isExternal && mealData.recipeId) {
        const recipe = await storage.getRecipeById(mealData.recipeId, userId);
        if (!recipe) {
          return res.status(404).json({ error: "Recipe not found" });
        }
      }

      // Add the meal to the trip (with ownership check)
      const newMeal = await storage.addMealToTrip(tripId, mealData, userId);
      
      if (!newMeal) {
        return res.status(404).json({ error: "Trip not found or meal already exists" });
      }

      res.status(201).json(newMeal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid meal data", 
          details: error.errors 
        });
      }
      
      console.error("Error adding meal to trip:", error);
      res.status(500).json({ error: "Failed to add meal to trip" });
    }
  });

  // DELETE /api/trips/:id/meals/:mealId
  // Remove a meal from a trip
  // Protected route - requires authentication
  app.delete("/api/trips/:id/meals/:mealId", isAuthenticated, async (req: any, res) => {
    try {
      const tripId = parseInt(req.params.id);
      const mealId = parseInt(req.params.mealId);
      const userId = req.user.claims.sub;
      
      // Validate IDs
      if (isNaN(tripId)) {
        return res.status(400).json({ error: "Invalid trip ID" });
      }
      if (isNaN(mealId)) {
        return res.status(400).json({ error: "Invalid meal ID" });
      }

      // Remove the meal from the trip (with ownership check)
      const success = await storage.removeMealFromTrip(tripId, mealId, userId);
      
      if (!success) {
        return res.status(404).json({ error: "Meal not found or trip not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error removing meal from trip:", error);
      res.status(500).json({ error: "Failed to remove meal from trip" });
    }
  });

  // GET /api/trips/:id/grocery
  // Generate a grocery list from all recipes in a trip
  // Returns the same format as /api/grocery/generate
  // Protected route - requires authentication
  app.get("/api/trips/:id/grocery", isAuthenticated, async (req: any, res) => {
    try {
      const tripId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      // Validate trip ID
      if (isNaN(tripId)) {
        return res.status(400).json({ error: "Invalid trip ID" });
      }

      // Get the trip (user can only access their own trips)
      const trip = await storage.getTripById(tripId, userId);
      if (!trip) {
        return res.status(404).json({ error: "Trip not found" });
      }

      // Get all meals for this trip
      const tripMeals = await storage.getTripMeals(tripId, userId);
      
      // Check if trip has any meals
      if (tripMeals.length === 0) {
        return res.json({ items: [], grouped: {
          "Produce": [],
          "Dairy": [],
          "Meat": [],
          "Pantry": [],
          "Camping Gear": [],
        }});
      }

      // Filter out external meals (we only process internal recipes for now)
      const internalMeals = tripMeals.filter(meal => !meal.isExternal && meal.recipeId !== null);
      
      if (internalMeals.length === 0) {
        return res.json({ items: [], grouped: {
          "Produce": [],
          "Dairy": [],
          "Meat": [],
          "Pantry": [],
          "Camping Gear": [],
        }});
      }

      // Fetch all recipes for the trip's meals (user can only access their own recipes)
      const recipes = await Promise.all(
        internalMeals.map(meal => storage.getRecipeById(meal.recipeId!, userId))
      );
      
      // Filter out any null recipes (in case some IDs don't exist)
      const validRecipes = recipes.filter((r): r is Recipe => r !== null && r !== undefined);
      
      if (validRecipes.length === 0) {
        return res.json({ items: [], grouped: {
          "Produce": [],
          "Dairy": [],
          "Meat": [],
          "Pantry": [],
          "Camping Gear": [],
        }});
      }
      
      // Collect all ingredients from selected recipes
      const allIngredients: string[] = [];
      validRecipes.forEach(recipe => {
        allIngredients.push(...recipe.ingredients);
      });
      
      // Normalize and deduplicate ingredients (case-insensitive)
      const uniqueIngredients = Array.from(
        new Set(allIngredients.map(i => i.trim().toLowerCase()))
      ).map(i => {
        // Find the original casing from the first occurrence
        return allIngredients.find(orig => orig.trim().toLowerCase() === i) || i;
      });
      
      // Categorize each ingredient and create GroceryItem objects
      const groceryItems: GroceryItem[] = uniqueIngredients.map(ingredient => ({
        name: ingredient,
        category: categorizeIngredient(ingredient),
        checked: false,
      }));
      
      // Group by category
      const grouped: Record<GroceryCategory, GroceryItem[]> = {
        "Produce": [],
        "Dairy": [],
        "Meat": [],
        "Pantry": [],
        "Camping Gear": [],
      };
      
      groceryItems.forEach(item => {
        grouped[item.category].push(item);
      });
      
      res.json({ items: groceryItems, grouped });
    } catch (error) {
      console.error("Error generating trip grocery list:", error);
      res.status(500).json({ error: "Failed to generate grocery list" });
    }
  });

  // GET /api/trips/:id/share
  // Get the current shareable link for a trip's grocery list (if one exists)
  // Protected route - requires authentication and trip ownership
  app.get("/api/trips/:id/share", isAuthenticated, async (req: any, res) => {
    try {
      const tripId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      // Validate trip ID
      if (isNaN(tripId)) {
        return res.status(400).json({ error: "Invalid trip ID" });
      }

      // Verify trip ownership
      const trip = await storage.getTripById(tripId, userId);
      if (!trip) {
        return res.status(404).json({ error: "Trip not found" });
      }

      // Get existing share link for this trip
      const sharedList = await storage.getSharedGroceryListByTrip(tripId);
      
      if (!sharedList) {
        return res.status(404).json({ error: "No share link exists for this trip" });
      }

      // Build the full share URL
      const shareUrl = `${req.protocol}://${req.get('host')}/shared/${sharedList.token}`;

      // Count items in the shared list
      const items = sharedList.items as any[];
      const itemCount = Array.isArray(items) ? items.length : 0;

      res.json({ 
        token: sharedList.token, 
        shareUrl,
        tripName: sharedList.tripName || trip.name,
        itemCount,
      });
    } catch (error) {
      console.error("Error fetching trip share link:", error);
      res.status(500).json({ error: "Failed to fetch share link" });
    }
  });

  // POST /api/trips/:id/share
  // Create or update a shareable link for a trip's grocery list
  // This generates the grocery list from the trip's meals and creates a public share link
  // Protected route - requires authentication and trip ownership
  app.post("/api/trips/:id/share", isAuthenticated, async (req: any, res) => {
    try {
      const tripId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      // Validate trip ID
      if (isNaN(tripId)) {
        return res.status(400).json({ error: "Invalid trip ID" });
      }

      // Get the trip (user can only access their own trips)
      const trip = await storage.getTripById(tripId, userId);
      if (!trip) {
        return res.status(404).json({ error: "Trip not found" });
      }

      // Check if trip has any meals
      if (trip.meals.length === 0) {
        return res.status(400).json({ error: "Cannot share grocery list - trip has no meals" });
      }

      // Fetch all recipes for the trip's meals
      const recipes = await Promise.all(
        trip.meals.map(id => storage.getRecipeById(id, userId))
      );
      
      // Filter out any null recipes
      const validRecipes = recipes.filter((r): r is Recipe => r !== null && r !== undefined);
      
      if (validRecipes.length === 0) {
        return res.status(400).json({ error: "Cannot share grocery list - no valid recipes found" });
      }
      
      // Collect all ingredients from selected recipes
      const allIngredients: string[] = [];
      validRecipes.forEach(recipe => {
        allIngredients.push(...recipe.ingredients);
      });
      
      // Normalize and deduplicate ingredients (case-insensitive)
      const uniqueIngredients = Array.from(
        new Set(allIngredients.map(i => i.trim().toLowerCase()))
      ).map(i => {
        return allIngredients.find(orig => orig.trim().toLowerCase() === i) || i;
      });
      
      // Categorize each ingredient and create GroceryItem objects
      const groceryItems: GroceryItem[] = uniqueIngredients.map(ingredient => ({
        name: ingredient,
        category: categorizeIngredient(ingredient),
        checked: false,
      }));

      // Create or update the shared grocery list for this trip
      const sharedList = await storage.upsertSharedGroceryListByTrip(tripId, {
        tripId,
        tripName: trip.name,
        items: groceryItems,
        collaborators: trip.collaborators || [],
      }, userId);

      // Build the full share URL
      const shareUrl = `${req.protocol}://${req.get('host')}/shared/${sharedList.token}`;

      res.json({ 
        token: sharedList.token, 
        shareUrl,
        tripName: trip.name,
        itemCount: groceryItems.length,
      });
    } catch (error) {
      console.error("Error creating trip share link:", error);
      res.status(500).json({ error: "Failed to create share link" });
    }
  });

  // Stripe Payment Routes
  // Reference: blueprint:javascript_stripe

  // GET /api/billing/config
  // Check if Stripe is properly configured and verify price details
  // Public route - no authentication required
  app.get("/api/billing/config", async (req, res) => {
    const configured = !!(stripe && process.env.STRIPE_PRICE_ID);
    
    if (!configured) {
      return res.json({ configured: false });
    }
    
    // Fetch price details to verify recurring configuration
    try {
      const price = await stripe!.prices.retrieve(process.env.STRIPE_PRICE_ID!);
      const product = await stripe!.products.retrieve(price.product as string);
      
      return res.json({ 
        configured: true,
        price: {
          id: price.id,
          type: price.type, // Should be 'recurring'
          recurring: price.recurring ? {
            interval: price.recurring.interval, // Should be 'year'
            interval_count: price.recurring.interval_count,
          } : null,
          unit_amount: price.unit_amount,
          currency: price.currency,
        },
        product: {
          name: product.name,
          description: product.description,
        },
      });
    } catch (error: any) {
      console.error('[Billing Config] Error fetching price details:', error);
      return res.json({ 
        configured: true,
        error: 'Could not fetch price details',
      });
    }
  });

  // GET /api/billing/debug
  // Diagnostic endpoint to check current subscription state
  // Returns sanitized diagnostic information for troubleshooting
  // Protected route - requires authentication
  app.get("/api/billing/debug", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Determine plan based on subscription status (same logic as /api/account/plan)
      let plan: 'free' | 'pro' = 'free';
      const status = user.subscriptionStatus;
      if (status === 'trialing' || status === 'active' || status === 'past_due') {
        plan = 'pro';
      }

      // Return sanitized diagnostic information
      return res.json({
        // Derived state
        computedPlan: plan,
        
        // Database state (sanitized - no sensitive IDs exposed)
        database: {
          hasStripeCustomer: !!user.stripeCustomerId,
          hasSubscriptionId: !!user.stripeSubscriptionId,
          subscriptionStatus: user.subscriptionStatus || null,
          membershipEndDate: user.proMembershipEndDate?.toISOString() || null,
        },
        
        // Diagnostic flags
        diagnosis: {
          isPro: plan === 'pro',
          webhookLikelyWorking: !!(user.stripeCustomerId && user.stripeSubscriptionId),
          statusSet: !!user.subscriptionStatus,
          endDateSet: !!user.proMembershipEndDate,
        },
        
        // Troubleshooting hints
        hints: [
          !user.stripeCustomerId ? "No Stripe customer ID - checkout may not have completed" : null,
          !user.stripeSubscriptionId ? "No subscription ID - webhook may not have fired" : null,
          !user.subscriptionStatus ? "No subscription status - database not updated" : null,
          user.subscriptionStatus && plan === 'free' ? 
            `Status is "${user.subscriptionStatus}" but plan is still free - unexpected status value` : null,
        ].filter(Boolean),
      });
    } catch (error: any) {
      console.error("Error in debug endpoint:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // POST /api/billing/create-checkout-session
  // Create a Stripe Checkout session for Pro Membership using Dashboard Price
  // Uses STRIPE_PRICE_ID environment variable (price_1SRnQBIEQH0jZmIb2XwrLR5v)
  // Body: { returnPath?: string } - optional path to return to after checkout
  // Protected route - requires authentication
  app.post("/api/billing/create-checkout-session", isAuthenticated, async (req: any, res) => {
    if (!stripe) {
      console.error("[Checkout] Stripe not configured - missing STRIPE_SECRET_KEY");
      return res.status(503).json({ error: "Payment system not configured. Please add STRIPE_SECRET_KEY." });
    }

    if (!process.env.STRIPE_PRICE_ID) {
      console.error("[Checkout] Missing STRIPE_PRICE_ID environment variable");
      return res.status(500).json({ error: "Stripe price not configured" });
    }

    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        console.error(`[Checkout] User not found: ${userId}`);
        return res.status(404).json({ error: "User not found" });
      }

      console.log(`[Checkout] Creating checkout session for user: ${userId} (${user.email})`);

      // Get return path from request body, default to /account
      const { returnPath = '/account' } = req.body || {};
      
      // Build success and cancel URLs dynamically based on return path
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const successUrl = `${baseUrl}${returnPath}?status=success`;
      const cancelUrl = `${baseUrl}${returnPath}?status=cancel`;

      // Prepare checkout session parameters with promotion code support
      let sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: "subscription",
        line_items: [
          {
            price: process.env.STRIPE_PRICE_ID,
            quantity: 1,
          },
        ],
        client_reference_id: userId,
        metadata: { 
          app_user_id: userId,
          purchase_type: 'pro_membership_annual',
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
        allow_promotion_codes: true,
      };

      // If user already has a Stripe customer ID, reuse it
      // Otherwise, create a new customer with metadata
      if (user.stripeCustomerId) {
        console.log(`[Checkout] Reusing existing customer: ${user.stripeCustomerId}`);
        sessionParams.customer = user.stripeCustomerId;
      } else {
        console.log(`[Checkout] Creating new customer for email: ${user.email}`);
        
        // Create new customer first with metadata
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          metadata: {
            userId: userId,
            app_user_id: userId,
          },
        });
        
        console.log(`[Checkout] Created customer: ${customer.id}`);
        
        // Save customer ID to database
        await storage.updateStripeCustomerId(userId, customer.id);
        
        // Use the new customer in the session
        sessionParams.customer = customer.id;
      }

      // Create checkout session using Dashboard Price ID
      const session = await stripe.checkout.sessions.create(sessionParams);

      console.log(`[Checkout] Created session: ${session.id}, URL: ${session.url}`);
      return res.json({ url: session.url });
    } catch (error: any) {
      console.error("[Checkout] Error creating checkout session:", error);
      const errorMessage = error?.message || "Could not create Stripe checkout session";
      return res.status(500).json({ error: errorMessage });
    }
  });

  // GET /api/billing/portal
  // Create a Stripe Customer Portal session for managing subscription
  // Allows users to view invoices, update payment methods, and cancel subscription
  // Protected route - requires authentication
  app.get("/api/billing/portal", isAuthenticated, async (req: any, res) => {
    if (!stripe) {
      return res.status(503).json({ error: "Payment system not configured. Please add STRIPE_SECRET_KEY." });
    }

    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user?.stripeCustomerId) {
        return res.status(400).json({ error: "No billing account found. Please subscribe first." });
      }

      // Build return URL dynamically
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const returnUrl = `${baseUrl}/account`;

      // Create billing portal session
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: returnUrl,
      });

      return res.json({ url: session.url });
    } catch (error: any) {
      console.error("Error creating billing portal session:", error);
      return res.status(500).json({ error: "Could not create billing portal session" });
    }
  });

  // POST /api/billing/sync-subscription
  // Manually sync subscription status from Stripe
  // Called after successful checkout to immediately update user's Pro status
  // Protected route - requires authentication
  app.post("/api/billing/sync-subscription", isAuthenticated, async (req: any, res) => {
    if (!stripe) {
      return res.status(503).json({ error: "Payment system not configured" });
    }

    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      console.log(`[Sync] Syncing subscription for user ${userId}`);

      // If user has a subscription ID, fetch it from Stripe
      if (user.stripeSubscriptionId) {
        console.log(`[Sync] Fetching subscription ${user.stripeSubscriptionId} from Stripe`);
        const subscriptionResponse = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

        // Type guard: ensure this is a subscription object
        if (!subscriptionResponse || subscriptionResponse.object !== 'subscription') {
          console.error(`Expected subscription object but got: ${subscriptionResponse?.object || 'null'}`);
          return res.status(500).json({ error: "Invalid subscription data" });
        }

        // Update local database with latest subscription data
        await storage.updateSubscriptionStatus(userId, subscriptionResponse.status);
        
        if ('current_period_end' in subscriptionResponse && typeof subscriptionResponse.current_period_end === 'number') {
          const endDate = new Date(subscriptionResponse.current_period_end * 1000);
          await storage.updateProMembershipEndDate(userId, endDate);
        }

        console.log(`[Sync] Updated user ${userId} - status: ${subscriptionResponse.status}`);
        
        return res.json({ 
          success: true, 
          status: subscriptionResponse.status,
          message: "Subscription synced successfully" 
        });
      }

      // If no subscription ID but has customer ID, try to find subscription
      if (user.stripeCustomerId) {
        console.log(`[Sync] Searching for subscriptions for customer ${user.stripeCustomerId}`);
        const subscriptions = await stripe.subscriptions.list({
          customer: user.stripeCustomerId,
          limit: 1,
        });

        if (subscriptions.data.length > 0) {
          const subscription = subscriptions.data[0];
          console.log(`[Sync] Found subscription ${subscription.id}`);
          
          // Save subscription ID
          await storage.updateStripeSubscriptionId(userId, subscription.id);
          await storage.updateSubscriptionStatus(userId, subscription.status);
          
          if ('current_period_end' in subscription && typeof subscription.current_period_end === 'number') {
            const endDate = new Date(subscription.current_period_end * 1000);
            await storage.updateProMembershipEndDate(userId, endDate);
          }

          console.log(`[Sync] Updated user ${userId} - status: ${subscription.status}`);
          
          return res.json({ 
            success: true, 
            status: subscription.status,
            message: "Subscription found and synced" 
          });
        }
      }

      // No subscription found
      console.log(`[Sync] No subscription found for user ${userId}`);
      return res.json({ 
        success: false, 
        message: "No active subscription found" 
      });
    } catch (error: any) {
      console.error("[Sync] Error syncing subscription:", error);
      return res.status(500).json({ error: "Failed to sync subscription" });
    }
  });

  // GET /api/account/plan
  // Get comprehensive account plan information
  // Returns plan, limits, and portal URL
  // Protected route - requires authentication
  app.get("/api/account/plan", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Determine plan based on subscription status
      let plan: 'free' | 'pro' = 'free';
      const status = user.subscriptionStatus;

      // Pro users have active, trialing, or past_due status
      if (status === 'trialing' || status === 'active' || status === 'past_due') {
        plan = 'pro';
      }

      // Define limits based on plan
      const tripLimit = plan === 'pro' ? null : 5;
      const groceryLimit = plan === 'pro' ? null : 5;

      // Note: Portal URL is generated on-demand when user clicks "Manage Subscription"
      // to avoid creating unnecessary one-time-use sessions on every page load

      return res.json({
        plan,
        tripLimit,
        groceryLimit,
        hasStripeCustomer: !!user.stripeCustomerId,
        subscriptionStatus: status || null,
        membershipEndDate: user.proMembershipEndDate?.toISOString() || null,
      });
    } catch (error: any) {
      console.error("Error fetching account plan:", error);
      return res.status(500).json({ error: "Could not fetch account plan" });
    }
  });

  // GET /api/billing/subscription-status
  // Get current subscription status and plan information
  // Returns plan type (free, trial, pro) and renewal date
  // Protected route - requires authentication
  app.get("/api/billing/subscription-status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Determine plan based on subscription status
      let plan: 'free' | 'trial' | 'pro' = 'free';
      const status = user.subscriptionStatus;

      if (status === 'trialing') {
        plan = 'trial';
      } else if (status === 'active' || status === 'past_due') {
        plan = 'pro';
      }

      // Return renewal date (proMembershipEndDate) as ISO string
      const current_period_end = user.proMembershipEndDate 
        ? user.proMembershipEndDate.toISOString() 
        : null;

      return res.json({ 
        plan, 
        current_period_end,
        status: status || null,
      });
    } catch (error: any) {
      console.error("Error fetching subscription status:", error);
      return res.status(500).json({ error: "Could not fetch subscription status" });
    }
  });

  // GET /api/billing/portal-session
  // Create a Stripe Customer Portal session for managing subscription
  // Returns portal URL for user to manage billing
  // Protected route - requires authentication
  app.get("/api/billing/portal-session", isAuthenticated, async (req: any, res) => {
    if (!stripe) {
      return res.status(503).json({ error: "Payment system not configured. Please add STRIPE_SECRET_KEY." });
    }

    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user?.stripeCustomerId) {
        return res.status(400).json({ error: "No billing account found. Please subscribe first." });
      }

      // Build return URL dynamically
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const returnUrl = `${baseUrl}/account`;

      // Create billing portal session
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: returnUrl,
      });

      return res.json({ url: session.url });
    } catch (error: any) {
      console.error("Error creating billing portal session:", error);
      return res.status(500).json({ error: "Could not create billing portal session" });
    }
  });

  // GET /api/trips/:id/weather
  // Get real weather forecast for a trip using Open-Meteo API
  // Accepts optional lat/lng query params or uses trip coordinates from database
  // Protected route - requires authentication and trip ownership
  app.get("/api/trips/:id/weather", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { lat, lng } = req.query;

      // Get trip for current user
      const trip = await storage.getTripById(parseInt(id), req.user.claims.sub);
      if (!trip) {
        return res.status(404).json({ error: "Trip not found" });
      }

      // Prefer lat/lng from query params, else from trip database fields
      // Note: Once trip.lat and trip.lng are populated in the DB via the trip creation/edit forms,
      // you can drop the ?lat=...&lng=... query parameter approach entirely.
      const rawLat = lat ?? trip.lat;
      const rawLng = lng ?? trip.lng;
      
      // Explicitly check for null/undefined before converting to Number
      // Important: Number(null) returns 0, not NaN, which would give wrong coordinates!
      if (rawLat == null || rawLng == null) {
        return res.status(400).json({ error: "Trip is missing coordinates (lat/lng)" });
      }
      
      const latitude = Number(rawLat);
      const longitude = Number(rawLng);
      if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
        return res.status(400).json({ error: "Trip is missing coordinates (lat/lng)" });
      }

      // Fetch weather forecast from Open-Meteo
      // Open-Meteo is free and requires no API key: https://open-meteo.com/
      // We fetch daily max/min temperature and weathercode for the forecast
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.searchParams.set("latitude", latitude.toString());
      url.searchParams.set("longitude", longitude.toString());
      url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,weathercode");
      url.searchParams.set("timezone", "auto");

      const weatherRes = await fetch(url.toString());
      if (!weatherRes.ok) {
        return res.status(500).json({ error: "Failed to fetch weather" });
      }
      const weatherJson = await weatherRes.json();

      // Transform Open-Meteo daily data to a simpler array format
      // Each day includes: date, high temp, low temp, and weathercode
      const forecast = (weatherJson.daily.time || []).map((date: string, index: number) => ({
        date,
        high: weatherJson.daily.temperature_2m_max[index],
        low: weatherJson.daily.temperature_2m_min[index],
        weathercode: weatherJson.daily.weathercode[index],
      }));

      return res.json({
        location: trip.location,
        lat: latitude,
        lng: longitude,
        forecast,
      });
    } catch (err) {
      console.error("weather error", err);
      return res.status(500).json({ error: "Could not load weather" });
    }
  });


  // POST /api/grocery/from-recipe
  // Add ingredients from a recipe to user's personal grocery list
  app.post("/api/grocery/from-recipe", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { recipeId, recipeTitle, ingredients } = req.body;

      if (!Array.isArray(ingredients) || ingredients.length === 0) {
        return res.status(400).json({ message: "No ingredients provided" });
      }

      await storage.addIngredientsToPersonalList(userId, recipeId, recipeTitle, ingredients);
      
      return res.json({ ok: true });
    } catch (err: any) {
      console.error("Error adding ingredients to personal list:", err);
      return res.status(500).json({ message: err.message || "Failed to add ingredients" });
    }
  });

  // GET /api/grocery/my-list
  // Get user's personal grocery list
  app.get("/api/grocery/my-list", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const items = await storage.getPersonalGroceryList(userId);
      
      return res.json({ items });
    } catch (err: any) {
      console.error("Error getting personal grocery list:", err);
      return res.status(500).json({ message: err.message || "Failed to get grocery list" });
    }
  });

  // DELETE /api/grocery/my-list
  // Clear user's personal grocery list
  app.delete("/api/grocery/my-list", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.clearPersonalGroceryList(userId);
      
      return res.json({ ok: true });
    } catch (err: any) {
      console.error("Error clearing personal grocery list:", err);
      return res.status(500).json({ message: err.message || "Failed to clear grocery list" });
    }
  });

  // POST /api/grocery/share
  // Send grocery list via email using nodemailer
  // Body: { to: string, subject: string, html: string }
  // Returns: { ok: true } on success
  // Protected route - requires authentication
  // Note: SMTP configuration required via environment variables
  // Note: Token-based sharing is at /api/grocery/share/link
  app.post("/api/grocery/share", isAuthenticated, async (req: any, res) => {
    try {
      // Validate the request body
      const emailSchema = z.object({
        to: z.string().email("Invalid email address"),
        subject: z.string().min(1, "Subject is required"),
        html: z.string().min(1, "Email content is required"),
      });
      
      const { to, subject, html } = emailSchema.parse(req.body);
      
      // Check if SMTP is configured
      const smtpHost = process.env.SMTP_HOST;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      
      if (!smtpHost || !smtpUser || !smtpPass) {
        return res.status(503).json({ 
          error: "Email service not configured",
          message: "SMTP credentials are required to send emails. Please contact your administrator.",
        });
      }
      
      // Create nodemailer transporter
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
      
      // Send the email
      await transporter.sendMail({
        from: smtpUser,
        to,
        subject,
        html,
      });
      
      return res.json({ ok: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: error.errors 
        });
      }
      
      console.error("Error sending grocery list email:", error);
      return res.status(500).json({ 
        error: "Failed to send email",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // GET /api/geocode
  // Geocoding proxy using Open-Meteo (no API key required)
  app.get("/api/geocode", async (req, res) => {
    try {
      const q = req.query.q as string;
      if (!q) {
        return res.status(400).json({ error: "Missing query" });
      }

      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`;
      const geoRes = await fetch(url);
      
      if (!geoRes.ok) {
        return res.status(500).json({ error: "Geocoding service unavailable" });
      }

      const data = await geoRes.json();
      const results = (data.results || []).map((r: any) => ({
        name: r.name,
        country: r.country,
        lat: r.latitude,
        lon: r.longitude,
      }));

      return res.json({ results });
    } catch (err) {
      console.error("Geocoding error:", err);
      return res.status(500).json({ error: "Failed to geocode" });
    }
  });

  // POST /api/trip-assistant
  // Get AI-powered trip planning suggestions (stubbed for now)
  // Body: { tripId?: number, prompt: string, season?: string, groupSize?: number }
  // Protected route - requires authentication
  app.post("/api/trip-assistant", isAuthenticated, async (req: any, res) => {
    try {
      const { tripAssistantRequestSchema } = await import("@shared/schema");
      
      // Validate request
      const data = tripAssistantRequestSchema.parse(req.body);
      
      // Extract keywords from prompt for basic keyword matching
      const promptLower = data.prompt.toLowerCase();
      const hasFamily = promptLower.includes("family") || promptLower.includes("kids") || promptLower.includes("children");
      const hasMountain = promptLower.includes("mountain") || promptLower.includes("hiking");
      const hasBeach = promptLower.includes("beach") || promptLower.includes("ocean") || promptLower.includes("coast");
      const hasEasy = promptLower.includes("easy") || promptLower.includes("beginner");
      
      // Stubbed campground suggestions with keyword awareness
      const campgrounds = hasBeach ? [
        {
          id: "coastal-haven-1",
          name: "Coastal Haven State Park",
          location: "Pacific Coast, Oregon",
          distanceHours: 3.5,
          highlights: ["Ocean views", "Beach access", "Tide pools", "Family-friendly"],
          recommendedSeasons: ["Spring", "Summer", "Fall"],
        },
        {
          id: "sunset-beach-2",
          name: "Sunset Beach Campground",
          location: "Northern California Coast",
          distanceHours: 5,
          highlights: ["Sandy beaches", "Dunes", "Fishing", "Wildlife viewing"],
          recommendedSeasons: ["Summer", "Fall"],
        },
      ] : hasMountain ? [
        {
          id: "alpine-peaks-1",
          name: "Alpine Peaks Wilderness",
          location: "Rocky Mountains, Colorado",
          distanceHours: 6,
          highlights: ["Mountain trails", "Alpine lakes", "Wildlife", "Scenic views"],
          recommendedSeasons: ["Summer", "Fall"],
        },
        {
          id: "mountain-ridge-2",
          name: "Mountain Ridge Campground",
          location: "Sierra Nevada, California",
          distanceHours: 4.5,
          highlights: ["Hiking trails", "Rock climbing", "Forest scenery", "Stargazing"],
          recommendedSeasons: ["Spring", "Summer", "Fall"],
        },
      ] : [
        {
          id: "riverside-retreat-1",
          name: "Riverside Retreat",
          location: "Cascade Range, Washington",
          distanceHours: 2.5,
          highlights: ["River access", "Fishing", "Easy trails", "Family sites"],
          recommendedSeasons: ["Spring", "Summer", "Fall"],
        },
        {
          id: "forest-grove-2",
          name: "Forest Grove Campground",
          location: "Olympic National Park, Washington",
          distanceHours: 4,
          highlights: ["Old growth forest", "Wildlife", "Scenic drives", "Quiet sites"],
          recommendedSeasons: ["Summer", "Fall"],
        },
      ];
      
      // Stubbed meal suggestions with keyword awareness
      const mealPlan = hasFamily && hasEasy ? [
        {
          mealType: "breakfast" as const,
          title: "Campfire Pancakes",
          description: "Easy pancakes cooked on a camp stove, perfect for kids",
          requiredGear: ["Camp stove", "Griddle or pan", "Spatula"],
          prepTime: "20 minutes",
          ingredients: ["Pancake mix", "Water", "Butter", "Syrup", "Fresh berries"],
        },
        {
          mealType: "lunch" as const,
          title: "Walking Tacos",
          description: "Fun, hands-on lunch that kids love - no cleanup needed",
          requiredGear: ["Camp stove", "Pot"],
          prepTime: "15 minutes",
          ingredients: ["Small chip bags", "Ground beef", "Taco seasoning", "Cheese", "Lettuce", "Salsa"],
        },
        {
          mealType: "dinner" as const,
          title: "Foil Packet Dinners",
          description: "Individual foil packets with protein and veggies - customizable for picky eaters",
          requiredGear: ["Campfire or grill", "Heavy-duty foil"],
          prepTime: "30 minutes",
          ingredients: ["Chicken or beef", "Potatoes", "Carrots", "Onions", "Seasoning"],
        },
      ] : [
        {
          mealType: "breakfast" as const,
          title: "Campfire Breakfast Burritos",
          description: "Hearty scrambled eggs with veggies wrapped in tortillas",
          requiredGear: ["Camp stove", "Large pan", "Spatula"],
          prepTime: "25 minutes",
          ingredients: ["Eggs", "Bell peppers", "Onions", "Cheese", "Tortillas", "Salsa"],
        },
        {
          mealType: "lunch" as const,
          title: "Trail Mix & Sandwiches",
          description: "No-cook option for active days on the trail",
          requiredGear: ["Cooler"],
          prepTime: "10 minutes",
          ingredients: ["Bread", "Deli meat", "Cheese", "Trail mix", "Fresh fruit"],
        },
        {
          mealType: "dinner" as const,
          title: "Campfire Chili",
          description: "One-pot hearty chili perfect for cool evenings",
          requiredGear: ["Dutch oven or large pot", "Campfire or stove"],
          prepTime: "45 minutes",
          ingredients: ["Ground beef", "Beans", "Tomatoes", "Onions", "Chili spices"],
        },
      ];
      
      // Stubbed packing tips with keyword awareness
      const packingTips = hasFamily ? [
        "Pack extra layers for kids - they get cold easier than adults",
        "Bring activities like cards, books, or nature scavenger hunt lists",
        "Don't forget sunscreen and bug spray - family sizes are more economical",
        "Pack a first aid kit with kids' pain reliever and band-aids",
        "Bring headlamps for everyone - makes evening bathroom trips safer",
      ] : [
        "Layer your clothing - temperature can vary 20-30 degrees from day to night",
        "Pack a headlamp or flashlight with extra batteries",
        "Bring a waterproof bag for electronics and important documents",
        "Don't forget fire starters - matches, lighter, and tinder",
        "Pack out what you pack in - bring trash bags for Leave No Trace camping",
      ];
      
      return res.json({
        campgrounds,
        mealPlan,
        packingTips,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: error.errors 
        });
      }
      
      console.error("Trip assistant error:", error);
      return res.status(500).json({ error: "Failed to generate suggestions" });
    }
  });

  // GET /api/billing/status
  // Get Pro membership status for current user
  app.get("/api/billing/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const isPro = user.proMembershipEndDate 
        ? new Date(user.proMembershipEndDate) > new Date()
        : false;

      return res.json({
        isPro,
        email: user.email || null,
        membershipEndDate: user.proMembershipEndDate || null,
      });
    } catch (err) {
      console.error("Billing status error:", err);
      return res.status(500).json({ error: "Failed to get billing status" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
