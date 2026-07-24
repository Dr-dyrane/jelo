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
