import { sendEmail, formatDate } from "../emailService";

export async function sendCancellationEmail(options: {
  to: string;
  name?: string;
  currentPeriodEnd?: Date;
  reactivateUrl?: string;
}) {
  const { to, name, currentPeriodEnd, reactivateUrl } = options;
  const userName = name || "camper";
  const currentPeriodEndFormatted = currentPeriodEnd ? formatDate(currentPeriodEnd) : null;

  const subject = "Your Camping Planner Pro subscription has been cancelled";

  const htmlBody = `
    <p>Hi ${userName},</p>

    <p>This is a confirmation that your <strong>Camping Planner Pro</strong> subscription has been cancelled.</p>

    ${currentPeriodEndFormatted 
      ? `<p>You will continue to have Pro access until <strong>${currentPeriodEndFormatted}</strong>.</p>`
      : `<p>Your account will now return to the free plan.</p>`
    }

    ${reactivateUrl ? `<p>If you change your mind, you can <a href="${reactivateUrl}" target="_blank" rel="noopener noreferrer">restart your Pro membership here</a>.</p>` : ''}

    <p>Thank you for being part of The Camping Planner community.</p>

    <p><strong>The Camping Planner Team</strong><br>
    <a href="mailto:hello@thecampingplanner.com">hello@thecampingplanner.com</a><br>
    <a href="https://thecampingplanner.com">https://thecampingplanner.com</a>
    </p>
  `;

  const textBody = `
Hi ${userName},

This is a confirmation that your Camping Planner Pro subscription has been cancelled.

${currentPeriodEndFormatted 
  ? `You will continue to have Pro access until ${currentPeriodEndFormatted}.`
  : `Your account will now return to the free plan.`
}

${reactivateUrl ? `If you change your mind, you can restart your Pro membership here: ${reactivateUrl}` : ''}

Thank you for being part of The Camping Planner community.

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
