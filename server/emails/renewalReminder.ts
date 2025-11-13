import { sendEmail, formatCurrency, formatDate } from "../emailService";

export async function sendRenewalReminderEmail(options: {
  to: string;
  name?: string;
  renewalDate: Date;
  amount: number;
  currency: string;
  manageBillingUrl?: string;
}) {
  const { to, name, renewalDate, amount, currency, manageBillingUrl } = options;
  const userName = name || "camper";
  const renewalDateFormatted = formatDate(renewalDate);
  const amountFormatted = formatCurrency(amount, currency);

  const subject = "Your Camping Planner Pro renewal is coming up";

  const htmlBody = `
    <p>Hi ${userName},</p>

    <p>Just a quick heads up — your <strong>Camping Planner Pro</strong> subscription is scheduled to renew on <strong>${renewalDateFormatted}</strong>.</p>

    <p>On that date, we'll automatically charge <strong>${amountFormatted}</strong> to your saved payment method to keep your Pro benefits active:</p>

    <ul>
      <li>Unlimited trips &amp; grocery lists</li>
      <li>Full access to all printable planners &amp; games</li>
      <li>Premium packing checklists</li>
      <li>Priority feature updates</li>
    </ul>

    ${manageBillingUrl ? `<p>If you want to update your card or cancel before renewal, you can <a href="${manageBillingUrl}" target="_blank" rel="noopener noreferrer">manage your subscription here</a>.</p>` : ''}

    <p>If everything looks good, you don't need to do anything — your plan will renew automatically.</p>

    <p>Happy camping,<br>
    <strong>The Camping Planner Team</strong><br>
    <a href="mailto:hello@thecampingplanner.com">hello@thecampingplanner.com</a><br>
    <a href="https://thecampingplanner.com">https://thecampingplanner.com</a>
    </p>
  `;

  const textBody = `
Hi ${userName},

Just a quick heads up — your Camping Planner Pro subscription is scheduled to renew on ${renewalDateFormatted}.

On that date, we'll automatically charge ${amountFormatted} to your saved payment method to keep your Pro benefits active:

• Unlimited trips & grocery lists
• Full access to all printable planners & games
• Premium packing checklists
• Priority feature updates

${manageBillingUrl ? `If you want to update your card or cancel before renewal, you can manage your subscription here: ${manageBillingUrl}` : ''}

If everything looks good, you don't need to do anything — your plan will renew automatically.

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
