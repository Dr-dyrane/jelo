import 'server-only';

import nodemailer from 'nodemailer';
import {
  resolveHostingerMailboxResourceId,
  sendHostingerMailViaApi,
} from './hostinger-mail-api';
import { retailerMagicLinkEmail } from './templates';

function mailAddress() {
  return process.env.EMAIL_FROM_ADDRESS ?? 'hello@jelocare.com';
}

function usableSecret(value: string | undefined) {
  return Boolean(value && value !== '[SENSITIVE]');
}

type EmailProvider = 'hostinger-api' | 'hostinger-smtp';

function emailProvider(): EmailProvider | null {
  const configured = process.env.EMAIL_PROVIDER?.trim().toLocaleLowerCase('en');
  if (configured === 'hostinger-api' || configured === 'hostinger-mail-api'
    || configured === 'hostinger-agentic' || configured === 'hostinger') {
    return usableSecret(process.env.EMAIL_API_TOKEN) ? 'hostinger-api' : null;
  }
  if (configured === 'hostinger-smtp') {
    return usableSecret(process.env.EMAIL_SMTP_PASSWORD) ? 'hostinger-smtp' : null;
  }
  if (usableSecret(process.env.EMAIL_API_TOKEN)) return 'hostinger-api';
  if (usableSecret(process.env.EMAIL_SMTP_PASSWORD)) return 'hostinger-smtp';
  return null;
}

export function hasTransactionalEmailConfig() {
  return Boolean(emailProvider() && mailAddress());
}

function smtpTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.hostinger.com',
    port: 465,
    secure: true,
    auth: {
      user: mailAddress(),
      pass: process.env.EMAIL_SMTP_PASSWORD,
    },
  });
}

function displayName() {
  const configured = process.env.EMAIL_FROM?.trim();
  if (!configured) return 'JeloCare';
  const bracket = configured.lastIndexOf('<');
  return (bracket > 0 ? configured.slice(0, bracket) : configured)
    .trim()
    .replace(/^["']|["']$/g, '') || 'JeloCare';
}

let mailboxResourceId: Promise<string> | null = null;

function hostingerMailboxResourceId(apiToken: string) {
  mailboxResourceId ??= resolveHostingerMailboxResourceId({
    apiToken,
    fromAddress: mailAddress(),
  }).catch(error => {
    mailboxResourceId = null;
    throw error;
  });
  return mailboxResourceId;
}

export async function sendRetailerMagicLink(input: {
  to: string;
  storeName: string;
  magicLink: string;
}) {
  const message = retailerMagicLinkEmail(input);
  const provider = emailProvider();
  if (!provider) throw new Error('transactional_email_not_configured');

  if (provider === 'hostinger-api') {
    const apiToken = process.env.EMAIL_API_TOKEN!;
    return sendHostingerMailViaApi({
      apiToken,
      mailboxResourceId: await hostingerMailboxResourceId(apiToken),
      to: input.to,
      displayName: displayName(),
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }

  return smtpTransporter().sendMail({
    from: process.env.EMAIL_FROM ?? `JeloCare <${mailAddress()}>`,
    to: input.to,
    replyTo: process.env.EMAIL_REPLY_TO ?? mailAddress(),
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}
