import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

// Initialize email transporter
export function initializeEmailService() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    console.warn("[Email] SMTP not configured - emails will not be sent");
    return;
  }

  try {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT),
      secure: SMTP_PORT === "465",
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    console.log("[Email] Email service initialized successfully");
  } catch (error) {
    console.error("[Email] Failed to initialize email service:", error);
  }
}

// Send Pro subscription confirmation email
export async function sendProSubscriptionEmail(options: {
  to: string;
  firstName: string;
  amount: number;
  currency: string;
  periodEnd: Date;
  manageUrl: string;
}) {
  if (!transporter) {
    console.warn("[Email] Cannot send email - transporter not initialized");
    return;
  }

  const { to, firstName, amount, currency, periodEnd, manageUrl } = options;

  // Format amount (Stripe uses cents)
  const formattedAmount = (amount / 100).toFixed(2);
  const currencySymbol = currency.toUpperCase() === "USD" ? "$" : currency.toUpperCase();
  
  // Format renewal date
  const renewalDate = periodEnd.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const subject = "Welcome to Camping Planner Pro!";

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%);
          color: white;
          padding: 30px 20px;
          text-align: center;
          border-radius: 8px 8px 0 0;
        }
        .content {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-top: none;
          padding: 30px 20px;
          border-radius: 0 0 8px 8px;
        }
        .amount {
          font-size: 32px;
          font-weight: bold;
          color: #0d9488;
          margin: 20px 0;
        }
        .detail-box {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 20px;
          margin: 20px 0;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          color: #6b7280;
        }
        .detail-value {
          font-weight: 600;
          color: #111827;
        }
        .button {
          display: inline-block;
          background: #0d9488;
          color: white;
          text-decoration: none;
          padding: 12px 24px;
          border-radius: 6px;
          font-weight: 600;
          margin: 20px 0;
        }
        .footer {
          text-align: center;
          color: #6b7280;
          font-size: 14px;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
        }
        .highlight {
          background: #fef3c7;
          padding: 15px;
          border-left: 4px solid #f59e0b;
          margin: 20px 0;
          border-radius: 4px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 style="margin: 0; font-size: 28px;">Welcome to Pro!</h1>
      </div>
      
      <div class="content">
        <p>Hi ${firstName},</p>
        
        <p>Thank you for subscribing to <strong>Camping Planner Pro</strong>! Your payment has been processed successfully.</p>
        
        <div class="amount">${currencySymbol}${formattedAmount}</div>
        
        <div class="detail-box">
          <div class="detail-row">
            <span class="detail-label">Plan</span>
            <span class="detail-value">Camping Planner Pro – Annual</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Amount</span>
            <span class="detail-value">${currencySymbol}${formattedAmount} ${currency.toUpperCase()}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Billing Period</span>
            <span class="detail-value">Annual (12 months)</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Next Renewal</span>
            <span class="detail-value">${renewalDate}</span>
          </div>
        </div>
        
        <div class="highlight">
          <strong>Auto-Renewal Notice:</strong><br>
          Your subscription renews automatically every 12 months unless canceled. You can cancel anytime before your renewal date.
        </div>
        
        <p><strong>What's Included:</strong></p>
        <ul>
          <li>Unlimited trips and grocery lists</li>
          <li>Printable camping planners and games</li>
          <li>Priority support</li>
          <li>All future Pro features</li>
        </ul>
        
        <center>
          <a href="${manageUrl}" class="button">Manage Subscription</a>
        </center>
        
        <p style="margin-top: 30px;">You can view receipts, update payment methods, or cancel your subscription anytime through your account page.</p>
        
        <p>Happy camping!</p>
        
        <p>
          — The Camping Planner Team<br>
          <a href="https://thecampingplanner.com">thecampingplanner.com</a>
        </p>
      </div>
      
      <div class="footer">
        <p>This is an automated receipt for your subscription to Camping Planner Pro.</p>
        <p>Questions? Reply to this email or visit your account page.</p>
      </div>
    </body>
    </html>
  `;

  const textBody = `
Welcome to Camping Planner Pro!

Hi ${firstName},

Thank you for subscribing to Camping Planner Pro! Your payment has been processed successfully.

PAYMENT DETAILS:
Amount: ${currencySymbol}${formattedAmount} ${currency.toUpperCase()}
Plan: Camping Planner Pro – Annual
Billing Period: Annual (12 months)
Next Renewal: ${renewalDate}

AUTO-RENEWAL NOTICE:
Your subscription renews automatically every 12 months unless canceled. You can cancel anytime before your renewal date.

WHAT'S INCLUDED:
• Unlimited trips and grocery lists
• Printable camping planners and games
• Priority support
• All future Pro features

Manage your subscription: ${manageUrl}

You can view receipts, update payment methods, or cancel your subscription anytime through your account page.

Happy camping!

— The Camping Planner Team
https://thecampingplanner.com
  `.trim();

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM!,
      to,
      subject,
      text: textBody,
      html: htmlBody,
    });

    console.log(`[Email] Pro subscription confirmation sent to ${to}`);
  } catch (error) {
    console.error(`[Email] Failed to send Pro subscription email to ${to}:`, error);
    throw error;
  }
}
