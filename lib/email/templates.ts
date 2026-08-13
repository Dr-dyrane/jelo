function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

const OTP_COPY: Record<string, { headline: string; lead: string; subject: string }> = {
  'sign-in': {
    headline: 'Your sign-in code.',
    lead: 'Use this code to sign in to JeloCare.',
    subject: 'Your JeloCare sign-in code',
  },
  'email-verification': {
    headline: 'Verify your email.',
    lead: 'Use this code to confirm your email address.',
    subject: 'Verify your email · JeloCare',
  },
  'forget-password': {
    headline: 'Reset your password.',
    lead: 'Use this code to reset your password.',
    subject: 'Your JeloCare password reset code',
  },
};

// Branded one-time-code email — a sibling of retailerMagicLinkEmail so the auth
// webhook (app/api/auth-hooks) can render JeloCare's own OTP mail instead of
// Neon's default. Same warm card and wine eyebrow; the code sits in a quiet box.
export function operatorOtpEmail(input: { code: string; type?: string }) {
  const copy = OTP_COPY[input.type ?? 'sign-in'] ?? OTP_COPY['sign-in'];
  const code = escapeHtml(input.code);
  return {
    subject: copy.subject,
    text: [
      copy.lead,
      '',
      `Code: ${input.code}`,
      '',
      'This code expires in 10 minutes. If you did not request it, ignore this email.',
    ].join('\n'),
    html: `
      <div style="margin:0;background:#fff9f5;padding:40px 20px;color:#201b19;font-family:Arial,sans-serif">
        <div style="max-width:560px;margin:0 auto;background:#fffdf9;border-radius:28px;padding:40px">
          <p style="margin:0 0 28px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#6b3b35">JeloCare</p>
          <h1 style="margin:0 0 14px;font-size:36px;line-height:1.05;font-weight:400">${copy.headline}</h1>
          <p style="margin:0 0 28px;color:#6f625e;line-height:1.6">${copy.lead}</p>
          <div style="border-radius:18px;background:#f6ece7;padding:22px 22px;text-align:center;font-size:34px;font-weight:600;letter-spacing:.3em;padding-left:calc(22px + .3em);color:#201b19">${code}</div>
          <p style="margin:28px 0 0;color:#8a7d78;font-size:13px;line-height:1.55">This code expires in 10 minutes. If you did not request it, ignore this email.</p>
        </div>
      </div>
    `,
  };
}

export function operatorInvitationEmail(input: { email: string; signInLink: string }) {
  const email = escapeHtml(input.email);
  const signInLink = escapeHtml(input.signInLink);
  return {
    subject: 'You’re invited to JeloCare Ops',
    text: [
      'You’re invited to JeloCare Ops.',
      '',
      `Invited email: ${input.email}`,
      '',
      `Sign in here: ${input.signInLink}`,
      '',
      'Your access becomes active only after you verify the invited email.',
      'If you were not expecting this invitation, you can ignore this email.',
    ].join('\n'),
    html: `
      <div style="margin:0;background:#fff9f5;padding:40px 20px;color:#201b19;font-family:Arial,sans-serif">
        <div style="max-width:560px;margin:0 auto;background:#fffdf9;border-radius:28px;padding:40px">
          <p style="margin:0 0 28px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#6b3b35">JeloCare Ops</p>
          <h1 style="margin:0 0 18px;font-size:36px;line-height:1.05;font-weight:400">You’re invited.</h1>
          <p style="margin:0 0 8px;color:#6f625e;line-height:1.6">Sign in with the invited email to join the JeloCare operations team.</p>
          <p style="margin:0 0 28px;color:#201b19;line-height:1.6"><strong>${email}</strong></p>
          <a href="${signInLink}" style="display:inline-block;border-radius:999px;background:#201b19;padding:14px 20px;color:#fff;text-decoration:none">Sign in to JeloCare</a>
          <p style="margin:28px 0 0;color:#8a7d78;font-size:13px;line-height:1.55">Access becomes active only after the invited email is verified. If you were not expecting this invitation, ignore this email.</p>
        </div>
      </div>
    `,
  };
}

export function retailerMagicLinkEmail(input: { storeName: string; magicLink: string }) {
  const storeName = escapeHtml(input.storeName);
  const magicLink = escapeHtml(input.magicLink);
  return {
    subject: `Continue listing ${input.storeName} on JeloCare`,
    text: [
      `Continue listing ${input.storeName} on JeloCare.`,
      '',
      input.magicLink,
      '',
      'This private link keeps your store details saved for 30 days.',
      'If you did not request it, you can ignore this email.',
    ].join('\n'),
    html: `
      <div style="margin:0;background:#fff9f5;padding:40px 20px;color:#201b19;font-family:Arial,sans-serif">
        <div style="max-width:560px;margin:0 auto;background:#fffdf9;border-radius:28px;padding:40px">
          <p style="margin:0 0 28px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#6b3b35">JeloCare</p>
          <h1 style="margin:0 0 18px;font-size:36px;line-height:1.05;font-weight:400">Your store is saved.</h1>
          <p style="margin:0 0 28px;color:#6f625e;line-height:1.6">Continue ${storeName} whenever it suits you.</p>
          <a href="${magicLink}" style="display:inline-block;border-radius:999px;background:#201b19;padding:14px 20px;color:#fff;text-decoration:none">Continue listing</a>
          <p style="margin:28px 0 0;color:#8a7d78;font-size:13px;line-height:1.55">This private link works for 30 days. If you did not request it, ignore this email.</p>
        </div>
      </div>
    `,
  };
}

export function assistedOrderRecoveryEmail(input: {
  name: string;
  reference: string;
  statusLink: string;
}) {
  const name = escapeHtml(input.name);
  const reference = escapeHtml(input.reference);
  const statusLink = escapeHtml(input.statusLink);
  return {
    subject: `${input.reference} · Your JeloCare order request`,
    text: [
      `Hi ${input.name},`,
      '',
      `Your order request ${input.reference} is saved.`,
      'JeloCare is verifying the exact products, retailer terms, and delivery cost.',
      '',
      `Open your private status page: ${input.statusLink}`,
      '',
      'This recovery link works once and expires in 20 minutes. You can keep using the status page on this device for 30 days.',
      'No payment has been taken.',
    ].join('\n'),
    html: `
      <div style="margin:0;background:#fff9f5;padding:40px 20px;color:#201b19;font-family:Arial,sans-serif">
        <div style="max-width:560px;margin:0 auto;background:#fffdf9;border-radius:28px;padding:40px">
          <p style="margin:0 0 28px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#6b3b35">JeloCare</p>
          <h1 style="margin:0 0 18px;font-size:36px;line-height:1.05;font-weight:400">Your request is saved.</h1>
          <p style="margin:0 0 8px;color:#6f625e;line-height:1.6">Hi ${name}. We’re verifying the exact basket, retailer terms, and delivery cost.</p>
          <p style="margin:0 0 28px;color:#201b19"><strong>${reference}</strong></p>
          <a href="${statusLink}" style="display:inline-block;border-radius:999px;background:#201b19;padding:14px 20px;color:#fff;text-decoration:none">Track order request</a>
          <p style="margin:28px 0 0;color:#8a7d78;font-size:13px;line-height:1.55">This one-time recovery link expires in 20 minutes. No payment has been taken.</p>
        </div>
      </div>
    `,
  };
}

export function assistedOrderUpdateEmail(input: {
  name: string;
  reference: string;
  statusLink: string;
}) {
  const name = escapeHtml(input.name);
  const reference = escapeHtml(input.reference);
  const statusLink = escapeHtml(input.statusLink);
  return {
    // Keep the subject and preview deliberately generic for lock-screen privacy.
    subject: 'A JeloCare order update is ready',
    text: [
      `Hi ${input.name},`,
      '',
      'A saved order request has an update.',
      `Reference: ${input.reference}`,
      '',
      `Open JeloCare securely: ${input.statusLink}`,
      '',
      'JeloCare never takes payment from an email link. You can turn off order emails from your private status page or My JeloCare.',
    ].join('\n'),
    html: `
      <div style="margin:0;background:#fff9f5;padding:40px 20px;color:#201b19;font-family:Arial,sans-serif">
        <div style="max-width:560px;margin:0 auto;background:#fffdf9;border-radius:28px;padding:40px">
          <p style="margin:0 0 28px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#6b3b35">JeloCare</p>
          <h1 style="margin:0 0 18px;font-size:36px;line-height:1.05;font-weight:400">Your private order has an update.</h1>
          <p style="margin:0 0 8px;color:#6f625e;line-height:1.6">Hi ${name}. Open JeloCare to see the current governed order state.</p>
          <p style="margin:0 0 28px;color:#201b19"><strong>${reference}</strong></p>
          <a href="${statusLink}" style="display:inline-block;border-radius:999px;background:#201b19;padding:14px 20px;color:#fff;text-decoration:none">Open order status</a>
          <p style="margin:28px 0 0;color:#8a7d78;font-size:13px;line-height:1.55">JeloCare never takes payment from an email link. Turn off order emails from your private status page or My JeloCare.</p>
        </div>
      </div>
    `,
  };
}

export function assistedOrderOperatorAlertEmail(input: {
  reference: string;
  retailer: string;
  itemCount: number;
  opsLink: string;
}) {
  const reference = escapeHtml(input.reference);
  const retailer = escapeHtml(input.retailer);
  const opsLink = escapeHtml(input.opsLink);
  const itemLabel = `${input.itemCount} ${input.itemCount === 1 ? 'item' : 'items'}`;
  return {
    subject: `New order request · ${input.reference}`,
    text: [
      'A new JeloCare order request is waiting.',
      '',
      `Reference: ${input.reference}`,
      `Retailer: ${input.retailer}`,
      `Basket: ${itemLabel}`,
      '',
      `Open the private Ops workspace: ${input.opsLink}`,
      '',
      'Customer details remain inside the authenticated workspace.',
    ].join('\n'),
    html: `
      <div style="margin:0;background:#fff9f5;padding:40px 20px;color:#201b19;font-family:Arial,sans-serif">
        <div style="max-width:560px;margin:0 auto;background:#fffdf9;border-radius:28px;padding:40px">
          <p style="margin:0 0 28px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#6b3b35">JeloCare Ops</p>
          <h1 style="margin:0 0 18px;font-size:36px;line-height:1.05;font-weight:400">A new order is waiting.</h1>
          <p style="margin:0 0 8px;color:#201b19"><strong>${reference}</strong></p>
          <p style="margin:0 0 28px;color:#6f625e;line-height:1.6">${retailer} · ${itemLabel}</p>
          <a href="${opsLink}" style="display:inline-block;border-radius:999px;background:#201b19;padding:14px 20px;color:#fff;text-decoration:none">Open order workspace</a>
          <p style="margin:28px 0 0;color:#8a7d78;font-size:13px;line-height:1.55">Customer details remain inside the authenticated JeloCare Ops workspace.</p>
        </div>
      </div>
    `,
  };
}
