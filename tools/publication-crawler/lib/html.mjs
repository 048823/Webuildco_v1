import { normalizeEmail } from './domain.mjs';

const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const SINGLE_EMAIL_PATTERN = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
const MAILTO_PATTERN = /<a\b[^>]*href=["']\s*mailto:([^"'?>\s]+)[^"']*["'][^>]*>/gi;
const CF_EMAIL_PATTERN = /data-cfemail=["']([a-f0-9]+)["']/gi;
const CF_FRAGMENT_PATTERN = /\/cdn-cgi\/l\/email-protection#([a-f0-9]+)/gi;

export function extractPublishedEmails(html, pageUrl) {
  const results = [];
  const decodedHtml = decodeHtmlEntities(String(html ?? ''));

  for (const match of decodedHtml.matchAll(CF_EMAIL_PATTERN)) {
    const email = decodeCloudflareEmail(match[1]);
    if (email) {
      results.push(makeResult(email, email, 'deobfuscated:cloudflare', 'visible_text', contextFromHtml(decodedHtml, match.index ?? 0), pageUrl));
    }
  }

  for (const match of decodedHtml.matchAll(CF_FRAGMENT_PATTERN)) {
    const email = decodeCloudflareEmail(match[1]);
    if (email) {
      results.push(makeResult(email, email, 'deobfuscated:cloudflare', 'visible_text', contextFromHtml(decodedHtml, match.index ?? 0), pageUrl));
    }
  }

  for (const match of decodedHtml.matchAll(MAILTO_PATTERN)) {
    const email = normalizeEmail(match[1]);
    if (emailMatches(email)) {
      results.push(makeResult(email, email, 'plaintext', 'mailto_link', contextFromHtml(decodedHtml, match.index ?? 0), pageUrl));
    }
  }

  const visibleText = deobfuscateVisibleText(htmlToVisibleText(decodedHtml));
  for (const match of visibleText.matchAll(EMAIL_PATTERN)) {
    const email = normalizeEmail(match[0]);
    if (emailMatches(email)) {
      results.push(makeResult(email, match[0], 'plaintext', 'visible_text', contextFromText(visibleText, match.index ?? 0), pageUrl));
    }
  }

  const seen = new Map();
  for (const result of results) {
    const key = `${result.email}|${result.publication_url}`;
    const previous = seen.get(key);
    if (!previous || rankVisibility(result.evidence_visibility) > rankVisibility(previous.evidence_visibility)) {
      seen.set(key, result);
    }
  }
  return [...seen.values()];
}

export function htmlToVisibleText(html) {
  return decodeHtmlEntities(
    String(html ?? '')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<template\b[\s\S]*?<\/template>/gi, ' ')
      .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

export function extractLinks(html, baseUrl) {
  const links = [];
  const linkPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
  for (const match of String(html ?? '').matchAll(linkPattern)) {
    const href = decodeHtmlEntities(match[1]).trim();
    if (!href || href.startsWith('#') || /^mailto:|^tel:|^javascript:/i.test(href)) continue;
    try {
      const url = new URL(href, baseUrl);
      url.hash = '';
      links.push(url.toString());
    } catch {
      // Ignore malformed links from broken pages.
    }
  }
  return [...new Set(links)];
}

export function hasRestrictionText(text) {
  const normal = String(text ?? '').toLowerCase().replace(/\s+/g, ' ');
  return [
    /unsolicited commercial electronic messages?/,
    /unsolicited commercial (?:email|e-mail|message)s?/,
    /do not (?:send|use).*unsolicited/,
    /not use .*e-?mail addresses .*unsolicited/,
    /strictly prohibited .*unsolicited/,
    /spam act/,
    /address[- ]harvesting software/,
    /harvest(?:ed|ing)? addresses/,
  ].some((pattern) => pattern.test(normal));
}

export function looksUnrendered(html) {
  const text = htmlToVisibleText(html);
  const scriptBytes = (String(html).match(/<script\b/gi) ?? []).length;
  return text.length < 120 && scriptBytes >= 3;
}

export function decodeHtmlEntities(value) {
  return String(value ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, number) => String.fromCodePoint(Number.parseInt(number, 10)))
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/gi, ' ');
}

export function decodeCloudflareEmail(hex) {
  if (!hex || hex.length < 4 || hex.length % 2 !== 0) return '';
  const key = Number.parseInt(hex.slice(0, 2), 16);
  const chars = [];
  for (let i = 2; i < hex.length; i += 2) {
    chars.push(String.fromCharCode(Number.parseInt(hex.slice(i, i + 2), 16) ^ key));
  }
  return chars.join('');
}

function deobfuscateVisibleText(text) {
  let value = String(text ?? '');
  value = value.replace(/\s+(?:\[|\()?at(?:\]|\))?\s+/gi, '@');
  value = value.replace(/\s+(?:\[|\()?dot(?:\]|\))?\s+/gi, '.');
  value = value.replace(/\s+@\s+/g, '@').replace(/\s+\.\s+/g, '.');
  try {
    value = decodeURIComponent(value);
  } catch {
    // Keep the original visible text when percent-decoding is invalid.
  }
  return value;
}

function makeResult(email, evidence, method, visibility, context, pageUrl) {
  return {
    email: normalizeEmail(email),
    publication_evidence: normalizeEmail(evidence),
    evidence_context: context.replace(/\s+/g, ' ').trim().slice(0, 700),
    evidence_method: method,
    evidence_visibility: visibility,
    publication_url: pageUrl,
  };
}

function contextFromText(text, index) {
  return text.slice(Math.max(0, index - 320), Math.min(text.length, index + 380));
}

function contextFromHtml(html, index) {
  return htmlToVisibleText(html.slice(Math.max(0, index - 900), Math.min(html.length, index + 900)));
}

function emailMatches(value) {
  return SINGLE_EMAIL_PATTERN.test(value);
}

function rankVisibility(visibility) {
  return { visible_text: 3, mailto_link: 2 }[visibility] ?? 1;
}
