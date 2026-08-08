// Canonical form for suppression matching (WEB-497 ruling 1: account-wide).
//
// Two addresses that reach the same human must collapse to the same key, or a
// person who opted out still receives mail and we are back in the breach.
import { normalizeEmail, normalizeHost } from '../../publication-crawler/lib/domain.mjs';

// Address -> "local@domain", lowercased, plus-tag stripped. '' when not an address.
export function canonicalAddress(value) {
  const email = normalizeEmail(value);
  const at = email.lastIndexOf('@');
  if (at < 1) return '';
  const local = email.slice(0, at).split('+')[0];
  const domain = canonicalDomain(email.slice(at + 1));
  // ponytail: no gmail dot-folding. The ruling names case and plus-addressing
  // only, and dot-folding is wrong everywhere except Google. Add per-provider
  // folding if an opt-out is ever observed slipping through on dots alone.
  return local && domain ? `${local}@${domain}` : '';
}

// Bare domain -> lowercased host. Instantly blocklist entries may be either.
export function canonicalDomain(value) {
  const host = normalizeHost(String(value ?? '').trim().replace(/^@/, ''));
  return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(host) ? host : '';
}

// A store entry is whichever of the two it parses as. Order matters: an entry
// containing '@' is an address, everything else is tried as a domain.
export function canonicalEntry(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (text.includes('@')) {
    const address = canonicalAddress(text);
    return address ? { kind: 'address', value: address } : null;
  }
  const domain = canonicalDomain(text);
  return domain ? { kind: 'domain', value: domain } : null;
}
