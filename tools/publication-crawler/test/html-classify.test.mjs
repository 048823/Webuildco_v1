import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyAddress } from '../lib/classify.mjs';
import { decodeCloudflareEmail, extractPublishedEmails } from '../lib/html.mjs';
import { RobotsRules } from '../lib/robots.mjs';

test('visible extraction excludes JSON-LD and aria-label but keeps visible, mailto, and Cloudflare emails', () => {
  const cfHex = encodeCloudflareEmail('person@example.com');
  const html = `
    <script type="application/ld+json">{"email":"hidden@example.com"}</script>
    <a href="/contact" aria-label="aria@example.com">Contact</a>
    <p>Reach jane@example.com for migration support.</p>
    <a href="mailto:team@example.com">Team</a>
    <a class="__cf_email__" data-cfemail="${cfHex}">[email protected]</a>
  `;

  const emails = extractPublishedEmails(html, 'https://example.com/contact').map((row) => row.email);
  assert.equal(decodeCloudflareEmail(cfHex), 'person@example.com');
  assert.deepEqual(new Set(emails), new Set(['jane@example.com', 'team@example.com', 'person@example.com']));
  assert.equal(emails.includes('hidden@example.com'), false);
  assert.equal(emails.includes('aria@example.com'), false);
});

test('address classes distinguish named, role, branch, and artifact addresses', () => {
  assert.equal(classifyAddress('jane.smith@example.com'), 'named_individual');
  assert.equal(classifyAddress('admin@example.com'), 'role');
  assert.equal(classifyAddress('sydney@example.com'), 'branch');
  assert.equal(classifyAddress('%20info@example.com'), 'junk');
});

test('robots parser honors disallow with longer allow override', () => {
  const robots = RobotsRules.parse(`
User-agent: *
Disallow: /
Allow: /public
`, 'WeBuildCo-PublicationCrawler/1.0');

  assert.equal(robots.canAccess('/private'), false);
  assert.equal(robots.canAccess('/public/register.csv'), true);
});

function encodeCloudflareEmail(email) {
  const key = 0x2a;
  const bytes = [key, ...Buffer.from(email).map((byte) => byte ^ key)];
  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
