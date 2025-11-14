import { sendEmail, formatDate } from "../emailService";

function formatDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export async function sendAdminNewSignupNotification(options: {
  userEmail: string;
  signupTime: Date;
  subscriptionId: string;
  renewalDate: Date;
  userName?: string;
}) {
  const { userEmail, signupTime, subscriptionId, renewalDate, userName } = options;

  const subject = "New Camping Planner Pro signup";

  const htmlBody = `
    <p><strong>New Pro Membership Signup</strong></p>

    <ul>
      <li><strong>User Email:</strong> ${userEmail}</li>
      ${userName ? `<li><strong>Name:</strong> ${userName}</li>` : ''}
      <li><strong>Signup Time:</strong> ${formatDateTime(signupTime)}</li>
      <li><strong>Stripe Subscription ID:</strong> ${subscriptionId}</li>
      <li><strong>Renewal Date:</strong> ${formatDate(renewalDate)}</li>
    </ul>

    <p>This is an automated notification from The Camping Planner app.</p>
  `;

  const textBody = `
New Pro Membership Signup

User Email: ${userEmail}
${userName ? `Name: ${userName}\n` : ''}Signup Time: ${formatDateTime(signupTime)}
Stripe Subscription ID: ${subscriptionId}
Renewal Date: ${formatDate(renewalDate)}

This is an automated notification from The Camping Planner app.
  `;

  await sendEmail({
    to: "hello@thecampingplanner.com",
    subject,
    text: textBody,
    html: htmlBody,
  });
}
