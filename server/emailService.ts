import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

// Shared email utilities
export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  if (!transporter) {
    console.warn("[Email] Cannot send email - transporter not initialized");
    return;
  }

  const { to, subject, text, html } = options;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM!,
      to,
      subject,
      text,
      html,
    });

    console.log(`[Email] Email sent to ${to}: ${subject}`);
  } catch (error) {
    console.error(`[Email] Failed to send email to ${to}:`, error);
    throw error;
  }
}

export function formatCurrency(amountInCents: number, currency: string): string {
  const currencyFormatted = (currency || 'usd').toUpperCase();
  return `$${(amountInCents / 100).toFixed(2)} ${currencyFormatted}`;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

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

// Send Welcome to Pro email after successful subscription
export async function sendWelcomeToProEmail(options: {
  to: string;
  name?: string;
}) {
  const { to, name } = options;
  const userName = name || "camper";

  const subject = "Welcome to Camping Planner Pro — You're All Set!";

  const htmlBody = `
    <p>Hi ${userName},</p>

    <p>Thanks for subscribing to <strong>Camping Planner Pro</strong>! Your account is now fully upgraded and you can enjoy:</p>

    <ul>
      <li>Unlimited trips</li>
      <li>Unlimited grocery lists</li>
      <li>Full access to all Pro printables &amp; game bundles</li>
      <li>Premium packing checklists</li>
      <li>Priority feature updates</li>
      <li>Offline-ready recipe saving</li>
    </ul>

    <p>Your subscription has been successfully activated and you can start using all Pro features right away.</p>

    <p>If you ever need help or have ideas for new features, just reply to this email — we'd love to hear from you.</p>

    <p>Happy camping,<br>
    <strong>The Camping Planner Team</strong><br>
    <a href="mailto:hello@thecampingplanner.com">hello@thecampingplanner.com</a><br>
    <a href="https://thecampingplanner.com">https://thecampingplanner.com</a>
    </p>
  `;

  const textBody = `
Hi ${userName},

Thanks for subscribing to Camping Planner Pro! Your account is now fully upgraded and you can enjoy:

- Unlimited trips
- Unlimited grocery lists
- Full access to all Pro printables & game bundles
- Premium packing checklists
- Priority feature updates
- Offline-ready recipe saving

Your subscription has been successfully activated and you can start using all Pro features right away.

If you ever need help or have ideas for new features, just reply to this email — we'd love to hear from you.

Happy camping,
The Camping Planner Team
hello@thecampingplanner.com
https://thecampingplanner.com
  `.trim();

  await sendEmail({
    to,
    subject,
    text: textBody,
    html: htmlBody,
  });
}

// Send payment receipt/invoice email after successful payment
export async function sendProPaymentReceiptEmail(options: {
  to: string;
  name?: string;
  amount: number;              // in cents
  currency: string;            // e.g. "usd"
  invoiceNumber?: string;
  invoiceDate: Date;
  periodStart?: Date;
  periodEnd?: Date;
  manageBillingUrl?: string;   // link to Stripe customer portal
  invoicePdfUrl?: string;      // optional link to Stripe-hosted invoice PDF
}) {
  if (!transporter) {
    console.warn("[Email] Cannot send email - transporter not initialized");
    return;
  }

  const { to, name, amount, currency, invoiceNumber, invoiceDate, periodStart, periodEnd, manageBillingUrl, invoicePdfUrl } = options;
  const userName = name || "camper";

  // Format amount (convert cents to dollars)
  // Add defensive default for null/undefined currency
  const currencyFormatted = (currency || 'usd').toUpperCase();
  const amountFormatted = `$${(amount / 100).toFixed(2)} ${currencyFormatted}`;

  // Format dates
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const invoiceDateFormatted = formatDate(invoiceDate);
  const periodStartFormatted = periodStart ? formatDate(periodStart) : null;
  const periodEndFormatted = periodEnd ? formatDate(periodEnd) : null;

  // Subject
  const subject = invoiceNumber
    ? `Your Camping Planner Pro receipt ${invoiceNumber}`
    : "Your Camping Planner Pro receipt";

  // HTML body
  const htmlBody = `
    <p>Hi ${userName},</p>

    <p>Thanks for your payment! Here's your receipt for <strong>Camping Planner Pro</strong>.</p>

    <h3>Payment Details</h3>
    <ul>
      <li><strong>Amount:</strong> ${amountFormatted}</li>
      <li><strong>Date:</strong> ${invoiceDateFormatted}</li>
      ${periodStartFormatted && periodEndFormatted ? `<li><strong>Coverage period:</strong> ${periodStartFormatted} – ${periodEndFormatted}</li>` : ''}
      ${invoiceNumber ? `<li><strong>Invoice #:</strong> ${invoiceNumber}</li>` : ''}
    </ul>

    ${invoicePdfUrl ? `<p>You can <a href="${invoicePdfUrl}" target="_blank" rel="noopener noreferrer">download a PDF copy of your invoice here</a>.</p>` : ''}

    ${manageBillingUrl ? `<p>To update your billing details or payment method at any time, visit your
<a href="${manageBillingUrl}" target="_blank" rel="noopener noreferrer">subscription settings</a>.</p>` : ''}

    <p>Thanks again for supporting The Camping Planner — we're excited to help you plan many more trips.</p>

    <p>Happy camping,<br>
    <strong>The Camping Planner Team</strong><br>
    <a href="mailto:hello@thecampingplanner.com">hello@thecampingplanner.com</a><br>
    <a href="https://thecampingplanner.com">https://thecampingplanner.com</a>
    </p>
  `;

  // Plain text body
  const textBody = `
Hi ${userName},

Thanks for your payment! Here's your receipt for Camping Planner Pro.

Payment Details
- Amount: ${amountFormatted}
- Date: ${invoiceDateFormatted}
${periodStartFormatted && periodEndFormatted ? `- Coverage period: ${periodStartFormatted} – ${periodEndFormatted}` : ''}
${invoiceNumber ? `- Invoice #: ${invoiceNumber}` : ''}

${invoicePdfUrl ? `PDF invoice: ${invoicePdfUrl}` : ''}

${manageBillingUrl ? `You can update your billing details or payment method here:
${manageBillingUrl}` : ''}

Thanks again for supporting The Camping Planner — we're excited to help you plan many more trips.

Happy camping,
The Camping Planner Team
hello@thecampingplanner.com
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

    console.log(`[Email] Payment receipt email sent to ${to}${invoiceNumber ? ` (Invoice: ${invoiceNumber})` : ''}`);
  } catch (error) {
    console.error(`[Email] Failed to send payment receipt email to ${to}:`, error);
    throw error;
  }
}
