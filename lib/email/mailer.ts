import 'server-only';

import nodemailer from 'nodemailer';
import {
  resolveHostingerMailboxResourceId,
  sendHostingerMailViaApi,
} from './hostinger-mail-api';
import {
  assistedOrderRecoveryEmail,
  assistedOrderUpdateEmail,
  operatorInvitationEmail,
  operatorOtpEmail,
  retailerMagicLinkEmail,
} from './templates';

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

async function deliver(to: string, message: { subject: string; text: string; html: string }) {
  const provider = emailProvider();
  if (!provider) throw new Error('transactional_email_not_configured');

  if (provider === 'hostinger-api') {
    const apiToken = process.env.EMAIL_API_TOKEN!;
    return sendHostingerMailViaApi({
      apiToken,
      mailboxResourceId: await hostingerMailboxResourceId(apiToken),
      to,
      displayName: displayName(),
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }

  return smtpTransporter().sendMail({
    from: process.env.EMAIL_FROM ?? `JeloCare <${mailAddress()}>`,
    to,
    replyTo: process.env.EMAIL_REPLY_TO ?? mailAddress(),
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}

export async function sendRetailerMagicLink(input: {
  to: string;
  storeName: string;
  magicLink: string;
}) {
  return deliver(input.to, retailerMagicLinkEmail(input));
}

export async function sendAssistedOrderRecovery(input: {
  to: string;
  name: string;
  reference: string;
  statusLink: string;
}) {
  return deliver(input.to, assistedOrderRecoveryEmail(input));
}

export async function sendAssistedOrderUpdate(input: {
  to: string;
  name: string;
  reference: string;
  statusLink: string;
}) {
  return deliver(input.to, assistedOrderUpdateEmail(input));
}

export async function sendAlertEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  return deliver(input.to, input);
}

// Used by the Neon Auth send.otp webhook (app/api/auth-hooks) to deliver the
// operator sign-in code through JeloCare's own branded transport.
export async function sendOperatorOtp(input: { to: string; code: string; type?: string }) {
  return deliver(input.to, operatorOtpEmail({ code: input.code, type: input.type }));
}

export async function sendOperatorInvitation(input: { to: string; signInLink: string }) {
  return deliver(input.to, operatorInvitationEmail({
    email: input.to,
    signInLink: input.signInLink,
  }));
}
