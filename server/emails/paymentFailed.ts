import { sendEmail, formatCurrency } from "../emailService";

export async function sendPaymentFailedEmail(options: {
  to: string;
  name?: string;
  amount: number;
  currency: string;
  manageBillingUrl?: string;
}) {
  const { to, name, amount, currency, manageBillingUrl } = options;
  const userName = name || "camper";
  const amountFormatted = formatCurrency(amount, currency);

  const subject = "We couldn't process your Camping Planner Pro payment";

  const htmlBody = `
    <p>Hi ${userName},</p>

    <p>We tried to process your latest <strong>Camping Planner Pro</strong> payment for <strong>${amountFormatted}</strong>, but your bank declined the charge.</p>

    <p>This can happen if a card expires, a bank blocks the transaction, or there are insufficient funds.</p>

    ${manageBillingUrl ? `<p>Please <a href="${manageBillingUrl}" target="_blank" rel="noopener noreferrer">update your payment method or retry the payment here</a>.</p>` : ''}

    <p>We'll keep your Pro features available for a short grace period. If payment still fails, your subscription may be paused.</p>

    <p>If you believe this was a mistake, reply to this email.</p>

    <p>Thank you,<br>
    <strong>The Camping Planner Team</strong><br>
    <a href="mailto:hello@thecampingplanner.com">hello@thecampingplanner.com</a><br>
    <a href="https://thecampingplanner.com">https://thecampingplanner.com</a>
    </p>
  `;

  const textBody = `
Hi ${userName},

We tried to process your latest Camping Planner Pro payment for ${amountFormatted}, but your bank declined the charge.

This can happen if a card expires, a bank blocks the transaction, or there are insufficient funds.

${manageBillingUrl ? `Please update your payment method or retry the payment here: ${manageBillingUrl}` : ''}

We'll keep your Pro features available for a short grace period. If payment still fails, your subscription may be paused.

If you believe this was a mistake, reply to this email.

Thank you,
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
