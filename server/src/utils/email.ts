import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from './logger';

const transporter = nodemailer.createTransport({
  host: env.EMAIL_HOST,
  port: env.EMAIL_PORT ?? 587,
  secure: false,
  auth:
    env.EMAIL_USER && env.EMAIL_PASS
      ? { user: env.EMAIL_USER, pass: env.EMAIL_PASS }
      : undefined,
});

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  if (env.NODE_ENV === 'test') {
    return;
  }
  try {
    await transporter.sendMail({
      from: env.EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    logger.info(`Email sent to ${options.to}: ${options.subject}`);
  } catch (err) {
    logger.error('Email send failed', { err, to: options.to, subject: options.subject });
    throw err;
  }
}

export function inviteEmailHtml(inviterName: string, workspaceName: string, inviteUrl: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>You've been invited to join ${workspaceName}</h2>
      <p><strong>${inviterName}</strong> has invited you to collaborate on Nexus.</p>
      <p>
        <a href="${inviteUrl}" 
           style="background: #4F46E5; color: white; padding: 12px 24px; 
                  text-decoration: none; border-radius: 6px; display: inline-block;">
          Accept Invitation
        </a>
      </p>
      <p>This link expires in 48 hours.</p>
    </div>
  `;
}
