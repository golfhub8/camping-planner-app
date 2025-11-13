import { sendEmail, formatDate } from "../emailService";

export async function sendTrialStartedEmail(options: {
  to: string;
  name?: string;
  trialEndDate: Date;
  manageBillingUrl?: string;
}) {
  const { to, name, trialEndDate, manageBillingUrl } = options;
  const userName = name || "camper";
  const trialEndDateFormatted = formatDate(trialEndDate);

  const subject = "Your Camping Planner Pro trial is live!";

  const htmlBody = `
    <p>Hi ${userName},</p>

    <p>Welcome to your <strong>Camping Planner Pro</strong> trial!</p>

    <p>For the next 7 days (until <strong>${trialEndDateFormatted}</strong>), you'll have full access to:</p>

    <ul>
      <li>Unlimited trips</li>
      <li>Unlimited grocery lists</li>
      <li>All printable planners &amp; game bundles</li>
      <li>Premium packing checklists</li>
      <li>Offline-ready saved recipes</li>
    </ul>

    <p>If you're enjoying Pro, you don't need to do anything — your subscription will continue automatically.</p>

    ${manageBillingUrl ? `<p>To review or cancel your trial, <a href="${manageBillingUrl}" target="_blank" rel="noopener noreferrer">visit your subscription settings</a>.</p>` : ''}

    <p>Happy camping,<br>
    <strong>The Camping Planner Team</strong><br>
    <a href="mailto:hello@thecampingplanner.com">hello@thecampingplanner.com</a><br>
    <a href="https://thecampingplanner.com">https://thecampingplanner.com</a>
    </p>
  `;

  const textBody = `
Hi ${userName},

Welcome to your Camping Planner Pro trial!

For the next 7 days (until ${trialEndDateFormatted}), you'll have full access to:

• Unlimited trips
• Unlimited grocery lists
• All printable planners & game bundles
• Premium packing checklists
• Offline-ready saved recipes

If you're enjoying Pro, you don't need to do anything — your subscription will continue automatically.

${manageBillingUrl ? `To review or cancel your trial, visit: ${manageBillingUrl}` : ''}

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
