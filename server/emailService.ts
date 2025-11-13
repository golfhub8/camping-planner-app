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

// Send Welcome to Pro email after successful subscription
export async function sendWelcomeToProEmail(options: {
  to: string;
  name?: string;
}) {
  if (!transporter) {
    console.warn("[Email] Cannot send email - transporter not initialized");
    return;
  }

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

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM!,
      to,
      subject,
      text: textBody,
      html: htmlBody,
    });

    console.log(`[Email] Welcome to Pro email sent to ${to}`);
  } catch (error) {
    console.error(`[Email] Failed to send Welcome to Pro email to ${to}:`, error);
    throw error;
  }
}
