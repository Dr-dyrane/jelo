import assert from 'node:assert/strict';
import test from 'node:test';
import { retailerMagicLinkEmail } from '@/lib/email/templates';

test('the retailer email is concise and keeps untrusted values out of HTML', () => {
  const message = retailerMagicLinkEmail({
    storeName: '<Glow & Co>',
    magicLink: 'https://www.jelocare.com/api/retailers/magic?token=a&next=<script>',
  });
  assert.match(message.subject, /Continue listing/);
  assert.match(message.text, /private link keeps your store details saved for 30 days/i);
  assert.doesNotMatch(message.html, /<Glow & Co>|<script>/);
  assert.match(message.html, /&lt;Glow &amp; Co&gt;/);
  assert.match(message.html, /Continue listing/);
});
