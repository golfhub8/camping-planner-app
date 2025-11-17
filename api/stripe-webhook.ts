import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import getRawBody from 'raw-body';
import { storage } from '../server/storage';
import {
  sendWelcomeToProEmail,
  sendProPaymentReceiptEmail,
  sendRenewalReminderEmail,
  sendPaymentFailedEmail,
  sendTrialStartedEmail,
  sendCancellationEmail,
  sendAdminNewSignupNotification,
} from '../server/emails';

// Use the same Stripe configuration as the main app
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export const config = {
  api: { bodyParser: false }
};

// Helper: Safely send email without failing the webhook
async function safelySendEmail(emailFn: () => Promise<void>, emailType: string) {
  try {
    await emailFn();
    console.log(`[Webhook] ✅ ${emailType} email sent successfully`);
  } catch (error) {
    console.error(`[Webhook] ⚠️ Failed to send ${emailType} email:`, error);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!stripe) {
    res.status(500).json({ error: 'Stripe not configured' });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const sig = req.headers['stripe-signature'] as string;
  const buf = await getRawBody(req as any);
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      buf, 
      sig, 
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
  } catch (err: any) {
    console.error('[Webhook] Signature verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  console.log('[Webhook] Received event:', event.type);

  // Handle the event types
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id || session.metadata?.app_user_id;
        
        if (!userId) {
          console.error('[Webhook] No user ID found in checkout session');
          break;
        }

        const purchaseType = session.metadata?.purchase_type;
        if (purchaseType !== 'pro_membership_annual') {
          console.log(`[Webhook] Purchase type (${purchaseType}) is not pro_membership_annual, skipping`);
          break;
        }

        if (session.customer && session.subscription) {
          await storage.updateStripeCustomerId(userId, session.customer as string);
          await storage.updateStripeSubscriptionId(userId, session.subscription as string);
          
          const subscriptionResponse = await stripe.subscriptions.retrieve(session.subscription as string);
          
          if (subscriptionResponse && 'current_period_end' in subscriptionResponse) {
            const endDate = new Date((subscriptionResponse as any).current_period_end * 1000);
            await storage.updateProMembershipEndDate(userId, endDate);
            await storage.updateSubscriptionStatus(userId, subscriptionResponse.status);
          }

          const user = await storage.getUser(userId);
          if (user?.email) {
            await safelySendEmail(
              () => sendWelcomeToProEmail(user.email),
              'Welcome to Pro'
            );
            await safelySendEmail(
              () => sendAdminNewSignupNotification(user),
              'Admin New Signup Notification'
            );
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.app_user_id;

        if (userId && 'current_period_end' in subscription) {
          const endDate = new Date((subscription as any).current_period_end * 1000);
          await storage.updateProMembershipEndDate(userId, endDate);
          await storage.updateSubscriptionStatus(userId, subscription.status);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.app_user_id;

        if (userId) {
          await storage.updateSubscriptionStatus(userId, 'canceled');
          
          const user = await storage.getUser(userId);
          if (user?.email) {
            await safelySendEmail(
              () => sendCancellationEmail(user.email),
              'Cancellation'
            );
          }
        }
        break;
      }

      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`[Webhook] Invoice ${event.type}:`, invoice.id);
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error('[Webhook] Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}
