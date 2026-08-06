import crypto from 'node:crypto';

const DOMAIN_IN_TEXT = /\b(?:https?:\/\/)?(?:www\.)?([a-z0-9][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+\.[a-z]{2,})(?:\/[^\s"'<>)]*)?/gi;

export function normalizeDomain(value) {
  if (!value) return '';
  let text = String(value).trim().toLowerCase();
  if (!text) return '';
  if (text.includes('@') && !text.includes('/')) {
    text = text.split('@').pop();
  }
  text = text.replace(/^mailto:/, '').replace(/^\/\//, 'https://');
  text = text.replace(/[),.;\]"']+$/g, '');

  try {
    const candidate = text.includes('://') ? text : `https://${text}`;
    const url = new URL(candidate);
    return normalizeHost(url.hostname);
  } catch {
    const match = text.match(/(?:^|\/\/|@)([a-z0-9.-]+\.[a-z]{2,})/i);
    return match ? normalizeHost(match[1]) : '';
  }
}

export function normalizeHost(host) {
  return String(host)
    .trim()
    .toLowerCase()
    .replace(/\.$/, '')
    .replace(/^www\./, '');
}

export function normalizeUrlForFetch(value) {
  if (!value) return '';
  const text = String(value).trim();
  if (/^https?:\/\//i.test(text)) return text;
  return `https://${text.replace(/^\/\//, '')}`;
}

export function emailDomain(email) {
  const domain = String(email).toLowerCase().split('@').pop() ?? '';
  return normalizeDomain(domain);
}

export function sameDomain(candidate, expectedDomain) {
  const candidateDomain = normalizeDomain(candidate);
  const expected = normalizeDomain(expectedDomain);
  return candidateDomain === expected || candidateDomain.endsWith(`.${expected}`);
}

export function normalizeEmail(value) {
  const decoded = safeDecodeURIComponent(String(value ?? '').trim())
    .replace(/^mailto:/i, '')
    .replace(/\?.*$/, '')
    .replace(/^["'<(]+/, '')
    .replace(/[>"'),.;:\]]+$/g, '')
    .toLowerCase();
  return decoded;
}

export function extractDomainsFromText(text) {
  const domains = new Set();
  for (const match of String(text).matchAll(DOMAIN_IN_TEXT)) {
    const domain = normalizeDomain(match[0]);
    if (domain) domains.add(domain);
  }
  return [...domains];
}

export function hashRecord(record) {
  return crypto.createHash('sha256').update(JSON.stringify(record)).digest('hex').slice(0, 16);
}

export function safeFileKey(value) {
  return normalizeDomain(value).replace(/[^a-z0-9.-]/g, '_') || 'unknown-domain';
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
