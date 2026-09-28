import nodemailer from 'nodemailer';
import { env } from '../../config/env';

const transport = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      ...(env.SMTP_USER && env.SMTP_PASSWORD
        ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } }
        : {}),
      connectionTimeout: 3000,
      greetingTimeout: 3000,
      socketTimeout: 5000,
    })
  : null;

/** No-op (logs only) when SMTP isn't configured — matches the dev fallback used for password reset. */
export async function sendNotificationEmail(
  to: string,
  subject: string,
  text: string,
): Promise<boolean> {
  if (!transport) {
    console.info(`[dev] Email to ${to}: ${subject}`);
    return false;
  }
  try {
    await transport.sendMail({ to, from: env.SMTP_FROM, subject, text });
    return true;
  } catch (error) {
    console.error('Notification email failed', error);
    return false;
  }
}
