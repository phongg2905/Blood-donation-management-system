import nodemailer from 'nodemailer';
import { env } from '../../config/env';

export interface ResetMailConfig {
  host?: string | undefined;
  port: number;
  secure: boolean;
  user?: string | undefined;
  password?: string | undefined;
  from?: string | undefined;
  resetUrl: string;
  production: boolean;
  ttlMinutes: number;
}

export function createPasswordResetMailer(config: ResetMailConfig) {
  const transport = config.host ? nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: config.production,
    ...(config.user && config.password ? { auth: { user: config.user, pass: config.password } } : {}),
    connectionTimeout: 3000,
    greetingTimeout: 3000,
    socketTimeout: 5000,
    disableFileAccess: true,
    disableUrlAccess: true,
  }) : null;

  return {
    // Development fallback only; SMTP mode never exposes a token in HTTP.
    exposesDevelopmentToken: !config.production && !transport,
    async send(email: string, token: string): Promise<void> {
      if (!transport) {
        if (config.production) throw new Error('Password reset SMTP is not configured');
        return;
      }
      const url = new URL(config.resetUrl);
      url.searchParams.set('token', token);
      await transport.sendMail({
        from: config.from,
        to: email,
        subject: 'Đặt lại mật khẩu — Hệ thống hiến máu',
        text: `Mở liên kết sau để đặt lại mật khẩu:\n${url.toString()}\n\nLiên kết có hiệu lực ${config.ttlMinutes} phút và chỉ dùng một lần. Nếu bạn không yêu cầu, hãy bỏ qua email này.`,
      });
    },
  };
}

export const passwordResetMailer = createPasswordResetMailer({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  user: env.SMTP_USER,
  password: env.SMTP_PASSWORD,
  from: env.SMTP_FROM,
  resetUrl: env.RESET_PASSWORD_URL ?? `${env.CORS_ORIGIN}/reset-password`,
  production: env.NODE_ENV === 'production',
  ttlMinutes: env.RESET_TOKEN_TTL_MINUTES,
});
