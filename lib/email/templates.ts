function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
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
