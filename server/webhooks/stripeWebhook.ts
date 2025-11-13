import { Express } from "express";
import express from "express";
import Stripe from "stripe";
import { IStorage } from "../storage";
import {
  sendWelcomeToProEmail,
  sendProPaymentReceiptEmail,
  sendRenewalReminderEmail,
  sendPaymentFailedEmail,
  sendTrialStartedEmail,
  sendTrialEndingSoonEmail,
  sendCancellationEmail,
} from "../emails";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-10-29.clover",
    })
  : null;

// In-memory cache for processed webhook event IDs (idempotency)
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

// Helper: Safely send email without failing the webhook
async function safelySendEmail(emailFn: () => Promise<void>, emailType: string) {
  try {
    await emailFn();
    console.log(`[Webhook] ✅ ${emailType} email sent successfully`);
  } catch (error) {
    console.error(`[Webhook] ⚠️ Failed to send ${emailType} email:`, error);
  }
}

// Helper: Get billing portal URL
async function getBillingPortalUrl(customerId: string): Promise<string | undefined> {
  if (!stripe) return undefined;
  
  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000'}/account`,
    });
    return portalSession.url;
  } catch (error) {
    console.error(`[Webhook] Failed to create billing portal URL:`, error);
    return undefined;
  }
}

// Helper: Find user by subscription ID or customer email
async function findUserBySubscription(
  storage: IStorage,
  subscription: Stripe.Subscription
): Promise<string | null> {
  // Try metadata first
  let userId = subscription.metadata?.app_user_id;
  
  if (userId) {
    return userId;
  }

  // Fallback: look up by customer email
  if (!stripe || !subscription.customer) {
    return null;
  }

  try {
    const customer = await stripe.customers.retrieve(subscription.customer as string);
    
    if (customer && !customer.deleted && customer.email) {
      console.log(`[Webhook] Looking up user by customer email: ${customer.email}`);
      const user = await storage.getUserByEmail(customer.email);
      
      if (user) {
        userId = user.id;
        console.log(`[Webhook] Found user by email: ${userId}`);
        
        // Update subscription metadata for future events
        try {
          await stripe.subscriptions.update(subscription.id, {
            metadata: { app_user_id: userId },
          });
          console.log(`[Webhook] Updated subscription metadata with app_user_id`);
        } catch (metadataError) {
          console.error(`[Webhook] Failed to update subscription metadata:`, metadataError);
        }
        
        return userId;
      }
    }
  } catch (error) {
    console.error(`[Webhook] Error fetching customer:`, error);
  }
  
  return null;
}

// Event Handler: checkout.session.completed
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  storage: IStorage
) {
  console.log(`[Webhook] ==================== Processing checkout.session.completed ====================`);
  console.log(`[Webhook] Session ID: ${session.id}`);
  console.log(`[Webhook] client_reference_id: ${session.client_reference_id}`);
  console.log(`[Webhook] metadata:`, JSON.stringify(session.metadata));
  console.log(`[Webhook] customer: ${session.customer}`);
  console.log(`[Webhook] subscription: ${session.subscription}`);
  
  // Find user
  let userId = session.client_reference_id || session.metadata?.app_user_id;
  let userIdFoundViaEmail = false;

  if (!userId && session.customer_email) {
    console.log(`[Webhook] No userId in metadata, looking up by email: ${session.customer_email}`);
    const user = await storage.getUserByEmail(session.customer_email);
    if (user) {
      userId = user.id;
      userIdFoundViaEmail = true;
      console.log(`[Webhook] Found user by email: ${userId}`);
    }
  }

  if (!userId) {
    console.error("[Webhook] ❌ CRITICAL: No user ID found in checkout session");
    return;
  }
  
  console.log(`[Webhook] ✅ Successfully identified userId: ${userId}`);

  const purchaseType = session.metadata?.purchase_type;
  if (purchaseType !== 'pro_membership_annual') {
    console.log(`[Webhook] Purchase type (${purchaseType}) is not pro_membership_annual, skipping`);
    return;
  }

  if (!session.customer || !session.subscription || !stripe) {
    console.log(`[Webhook] Missing customer or subscription, skipping`);
    return;
  }

  console.log(`[Webhook] Updating database - customer: ${session.customer}, subscription: ${session.subscription}`);
  await storage.updateStripeCustomerId(userId, session.customer as string);
  await storage.updateStripeSubscriptionId(userId, session.subscription as string);
  
  // Fetch subscription to get period end date
  const subscriptionResponse = await stripe.subscriptions.retrieve(session.subscription as string);
  
  if (!subscriptionResponse || subscriptionResponse.object !== 'subscription') {
    console.error(`[Webhook] Invalid subscription response`);
    return;
  }
  
  // Type guard for current_period_end
  if (!('current_period_end' in subscriptionResponse) || 
      typeof subscriptionResponse.current_period_end !== 'number') {
    console.error(`[Webhook] Missing current_period_end`);
    return;
  }
  
  const endDate = new Date(subscriptionResponse.current_period_end * 1000);
  await storage.updateProMembershipEndDate(userId, endDate);
  await storage.updateSubscriptionStatus(userId, subscriptionResponse.status);
  
  console.log(`[Webhook] ✅ Subscription activated - status: ${subscriptionResponse.status}, expires: ${endDate}`);
  
  // Update subscription metadata if found via email
  if (userIdFoundViaEmail) {
    try {
      await stripe.subscriptions.update(session.subscription as string, {
        metadata: { app_user_id: userId },
      });
    } catch (metadataError) {
      console.error(`[Webhook] Failed to update subscription metadata:`, metadataError);
    }
  }
  
  // Send appropriate welcome email
  const user = await storage.getUser(userId);
  if (!user?.email) {
    console.log(`[Webhook] User or email not found, skipping email`);
    return;
  }

  const userName = user.firstName || undefined;
  const manageBillingUrl = await getBillingPortalUrl(session.customer as string);

  // If subscription has trial, send trial started email
  if (subscriptionResponse.status === 'trialing' && subscriptionResponse.trial_end) {
    await safelySendEmail(
      () => sendTrialStartedEmail({
        to: user.email!,
        name: userName,
        trialEndDate: new Date(subscriptionResponse.trial_end! * 1000),
        manageBillingUrl,
      }),
      'Trial Started'
    );
  } else {
    // No trial - they're active immediately, send welcome email
    await safelySendEmail(
      () => sendWelcomeToProEmail({
        to: user.email!,
        name: userName,
      }),
      'Welcome to Pro'
    );
  }
}

// Event Handler: invoice.payment_succeeded
async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
  storage: IStorage
) {
  console.log(`[Webhook] Processing invoice.payment_succeeded`);
  console.log(`[Webhook] Invoice ID: ${invoice.id}, Amount: ${invoice.amount_paid}`);
  
  if (!invoice.customer) {
    console.log(`[Webhook] Invoice has no customer, skipping`);
    return;
  }
  
  const user = await storage.getUserByStripeCustomerId(invoice.customer as string);
  if (!user?.email) {
    console.log(`[Webhook] No user or email found for customer ${invoice.customer}`);
    return;
  }
  
  console.log(`[Webhook] Found user ${user.id} for customer ${invoice.customer}`);
  
  // Update subscription status if this is tied to a subscription
  let invoiceSubscriptionId: string | undefined;
  if ('subscription' in invoice && invoice.subscription) {
    invoiceSubscriptionId = typeof invoice.subscription === 'string' 
      ? invoice.subscription 
      : (invoice.subscription as any).id;
  }
  
  if (invoiceSubscriptionId && user.stripeSubscriptionId === invoiceSubscriptionId && stripe) {
    const subscription = await stripe.subscriptions.retrieve(invoiceSubscriptionId);
    if (subscription && subscription.object === 'subscription') {
      await storage.updateSubscriptionStatus(user.id, subscription.status);
      
      // Ensure Pro membership is active if subscription is active
      if (['active', 'trialing', 'past_due'].includes(subscription.status)) {
        if ('current_period_end' in subscription && typeof subscription.current_period_end === 'number') {
          const endDate = new Date(subscription.current_period_end * 1000);
          await storage.updateProMembershipEndDate(user.id, endDate);
        }
      }
    }
  }
  
  const manageBillingUrl = await getBillingPortalUrl(invoice.customer as string);
  
  // Extract period dates from invoice line items
  const firstLine = invoice.lines.data[0];
  const periodStart = firstLine?.period?.start 
    ? new Date(firstLine.period.start * 1000) 
    : undefined;
  const periodEnd = firstLine?.period?.end 
    ? new Date(firstLine.period.end * 1000) 
    : undefined;
  
  // Send payment receipt email
  await safelySendEmail(
    () => sendProPaymentReceiptEmail({
      to: user.email!,
      name: user.firstName || undefined,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      invoiceNumber: invoice.number ?? undefined,
      invoiceDate: new Date((invoice.status_transitions?.paid_at || invoice.created) * 1000),
      periodStart,
      periodEnd,
      manageBillingUrl,
      invoicePdfUrl: invoice.hosted_invoice_url ?? undefined,
    }),
    'Payment Receipt'
  );
}

// Event Handler: invoice.payment_failed
async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  storage: IStorage
) {
  console.log(`[Webhook] Processing invoice.payment_failed`);
  console.log(`[Webhook] Invoice ID: ${invoice.id}, Amount due: ${invoice.amount_due}`);
  
  if (!invoice.customer) {
    console.log(`[Webhook] Invoice has no customer, skipping`);
    return;
  }
  
  const user = await storage.getUserByStripeCustomerId(invoice.customer as string);
  if (!user?.email) {
    console.log(`[Webhook] No user or email found for customer ${invoice.customer}`);
    return;
  }
  
  const manageBillingUrl = await getBillingPortalUrl(invoice.customer as string);
  
  // Send payment failed notification
  await safelySendEmail(
    () => sendPaymentFailedEmail({
      to: user.email!,
      name: user.firstName || undefined,
      amount: invoice.amount_due,
      currency: invoice.currency,
      manageBillingUrl,
    }),
    'Payment Failed'
  );
}

// Event Handler: invoice.upcoming (renewal reminder)
async function handleInvoiceUpcoming(
  invoice: Stripe.Invoice,
  storage: IStorage
) {
  console.log(`[Webhook] Processing invoice.upcoming`);
  console.log(`[Webhook] Invoice ID: ${invoice.id}, Amount due: ${invoice.amount_due}`);
  
  if (!invoice.customer) {
    console.log(`[Webhook] Invoice has no customer, skipping`);
    return;
  }
  
  const user = await storage.getUserByStripeCustomerId(invoice.customer as string);
  if (!user?.email) {
    console.log(`[Webhook] No user or email found for customer ${invoice.customer}`);
    return;
  }
  
  const manageBillingUrl = await getBillingPortalUrl(invoice.customer as string);
  
  // Send renewal reminder
  const renewalDate = invoice.next_payment_attempt 
    ? new Date(invoice.next_payment_attempt * 1000) 
    : new Date(invoice.period_end * 1000);
  
  await safelySendEmail(
    () => sendRenewalReminderEmail({
      to: user.email!,
      name: user.firstName || undefined,
      renewalDate,
      amount: invoice.amount_due,
      currency: invoice.currency,
      manageBillingUrl,
    }),
    'Renewal Reminder'
  );
}

// Event Handler: customer.subscription.trial_will_end
async function handleTrialWillEnd(
  subscription: Stripe.Subscription,
  storage: IStorage
) {
  console.log(`[Webhook] Processing customer.subscription.trial_will_end`);
  console.log(`[Webhook] Subscription ID: ${subscription.id}`);
  
  const userId = await findUserBySubscription(storage, subscription);
  if (!userId) {
    console.error(`[Webhook] Could not find user for subscription ${subscription.id}`);
    return;
  }
  
  const user = await storage.getUser(userId);
  if (!user?.email) {
    console.log(`[Webhook] User or email not found`);
    return;
  }
  
  if (!subscription.trial_end) {
    console.log(`[Webhook] No trial_end in subscription`);
    return;
  }
  
  const manageBillingUrl = subscription.customer 
    ? await getBillingPortalUrl(subscription.customer as string) 
    : undefined;
  
  // Get amount from subscription items
  const amount = subscription.items.data[0]?.price?.unit_amount || 2999;
  const currency = subscription.items.data[0]?.price?.currency || 'usd';
  
  // Send trial ending soon email
  await safelySendEmail(
    () => sendTrialEndingSoonEmail({
      to: user.email!,
      name: user.firstName || undefined,
      trialEndDate: new Date(subscription.trial_end! * 1000),
      amount,
      currency,
      manageBillingUrl,
    }),
    'Trial Ending Soon'
  );
}

// Event Handler: customer.subscription.updated
async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  storage: IStorage
) {
  console.log(`[Webhook] Processing customer.subscription.updated`);
  console.log(`[Webhook] Subscription ID: ${subscription.id}, Status: ${subscription.status}`);
  
  const userId = await findUserBySubscription(storage, subscription);
  if (!userId) {
    console.error(`[Webhook] Could not find user for subscription ${subscription.id}`);
    return;
  }

  // Store subscription status
  await storage.updateSubscriptionStatus(userId, subscription.status);

  // Update Pro membership based on status
  const allowedStatuses = ['active', 'trialing', 'past_due'];
  
  if (allowedStatuses.includes(subscription.status)) {
    if ('current_period_end' in subscription && typeof subscription.current_period_end === 'number') {
      const endDate = new Date(subscription.current_period_end * 1000);
      await storage.updateProMembershipEndDate(userId, endDate);
      console.log(`[Webhook] Updated Pro membership for user ${userId} - status: ${subscription.status}, expires: ${endDate}`);
    }
  } else {
    // Subscription canceled or in other non-active state
    await storage.updateProMembershipEndDate(userId, null);
    console.log(`[Webhook] Revoked Pro membership for user ${userId} - status: ${subscription.status}`);
    
    // Send cancellation email for certain statuses
    if (['canceled', 'incomplete_expired'].includes(subscription.status)) {
      const user = await storage.getUser(userId);
      if (user?.email) {
        const currentPeriodEnd = ('current_period_end' in subscription && typeof subscription.current_period_end === 'number')
          ? new Date(subscription.current_period_end * 1000) 
          : undefined;
        
        await safelySendEmail(
          () => sendCancellationEmail({
            to: user.email!,
            name: user.firstName || undefined,
            currentPeriodEnd,
            reactivateUrl: `${process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000'}/account`,
          }),
          'Cancellation Confirmation'
        );
      }
    }
  }
}

// Event Handler: customer.subscription.deleted
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  storage: IStorage
) {
  console.log(`[Webhook] Processing customer.subscription.deleted`);
  console.log(`[Webhook] Subscription ID: ${subscription.id}`);
  
  const userId = await findUserBySubscription(storage, subscription);
  if (!userId) {
    console.error(`[Webhook] Could not find user for subscription ${subscription.id}`);
    return;
  }

  // Revoke Pro access
  await storage.updateProMembershipEndDate(userId, null);
  await storage.updateSubscriptionStatus(userId, 'canceled');
  console.log(`[Webhook] Revoked Pro membership for user ${userId} - subscription deleted`);
  
  // Send cancellation email
  const user = await storage.getUser(userId);
  if (user?.email) {
    const currentPeriodEnd = ('current_period_end' in subscription && typeof subscription.current_period_end === 'number')
      ? new Date(subscription.current_period_end * 1000) 
      : undefined;
    
    await safelySendEmail(
      () => sendCancellationEmail({
        to: user.email!,
        name: user.firstName || undefined,
        currentPeriodEnd,
        reactivateUrl: `${process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000'}/account`,
      }),
      'Cancellation Confirmation'
    );
  }
}

// Main webhook handler registration
export function registerStripeWebhook(app: Express, storage: IStorage): void {
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
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Check idempotency
    if (processedWebhookEvents.has(event.id)) {
      console.log(`[Webhook] Event ${event.id} already processed, skipping duplicate`);
      return res.status(200).send("Duplicate event - already processed");
    }

    try {
      console.log(`[Webhook] Received event: ${event.type} (${event.id})`);
      
      // Route events to handlers
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, storage);
          break;

        case 'invoice.payment_succeeded':
          await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice, storage);
          break;

        case 'invoice.payment_failed':
          await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice, storage);
          break;

        case 'invoice.upcoming':
          await handleInvoiceUpcoming(event.data.object as Stripe.Invoice, storage);
          break;

        case 'customer.subscription.trial_will_end':
          await handleTrialWillEnd(event.data.object as Stripe.Subscription, storage);
          break;

        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, storage);
          break;

        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, storage);
          break;

        default:
          console.log(`[Webhook] Unhandled event type: ${event.type}`);
      }

      // Mark event as successfully processed
      processedWebhookEvents.set(event.id, Date.now());
      
      res.json({ received: true });
    } catch (error) {
      console.error("[Webhook] Error processing webhook:", error);
      res.status(500).send("Webhook processing failed");
    }
  });
}
