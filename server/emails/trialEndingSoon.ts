import { sendEmail, formatCurrency, formatDate } from "../emailService";

export async function sendTrialEndingSoonEmail(options: {
  to: string;
  name?: string;
  trialEndDate: Date;
  amount: number;
  currency: string;
  manageBillingUrl?: string;
}) {
  const { to, name, trialEndDate, amount, currency, manageBillingUrl } = options;
  const userName = name || "camper";
  const trialEndDateFormatted = formatDate(trialEndDate);
  const amountFormatted = formatCurrency(amount, currency);

  const subject = "Your Camping Planner Pro trial ends soon";

  const htmlBody = `
    <p>Hi ${userName},</p>

    <p>Just a reminder — your <strong>Camping Planner Pro</strong> trial ends on <strong>${trialEndDateFormatted}</strong>.</p>

    <p>Unless canceled before that date, your subscription will continue and you'll be charged <strong>${amountFormatted}</strong> for the next billing period.</p>

    <p>With Pro, you'll keep access to:</p>

    <ul>
      <li>Unlimited trips and grocery lists</li>
      <li>All printable planners and games</li>
      <li>Premium packing checklists</li>
      <li>Offline-ready recipe saving</li>
    </ul>

    ${manageBillingUrl ? `<p><a href="${manageBillingUrl}" target="_blank" rel="noopener noreferrer">Manage your subscription here</a>.</p>` : ''}

    <p>Happy camping,<br>
    <strong>The Camping Planner Team</strong><br>
    <a href="mailto:hello@thecampingplanner.com">hello@thecampingplanner.com</a><br>
    <a href="https://thecampingplanner.com">https://thecampingplanner.com</a>
    </p>
  `;

  const textBody = `
Hi ${userName},

Just a reminder — your Camping Planner Pro trial ends on ${trialEndDateFormatted}.

Unless canceled before that date, your subscription will continue and you'll be charged ${amountFormatted} for the next billing period.

With Pro, you'll keep access to:

• Unlimited trips and grocery lists
• All printable planners and games
• Premium packing checklists
• Offline-ready recipe saving

${manageBillingUrl ? `Manage your subscription here: ${manageBillingUrl}` : ''}

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
