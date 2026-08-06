import { normalizeEmail } from './domain.mjs';

const ROLE_LOCALS = new Set([
  'admin',
  'admission',
  'admissions',
  'accounts',
  'apply',
  'bookings',
  'careers',
  'contact',
  'enquiries',
  'enquiry',
  'hello',
  'help',
  'hr',
  'info',
  'jobs',
  'legal',
  'mail',
  'marketing',
  'office',
  'privacy',
  'reception',
  'sales',
  'service',
  'support',
  'team',
  'webmaster',
]);

const GEO_LOCALS = new Set([
  'adelaide',
  'act',
  'australia',
  'bangalore',
  'bangladesh',
  'biratnagar',
  'brisbane',
  'butwal',
  'canberra',
  'cebu',
  'chennai',
  'davao',
  'delhi',
  'goldcoast',
  'hobart',
  'india',
  'kathmandu',
  'london',
  'manila',
  'melbourne',
  'mumbai',
  'nepal',
  'nsw',
  'parramatta',
  'perth',
  'pokhara',
  'queensland',
  'riyadh',
  'sydney',
  'tasmania',
  'victoria',
  'wa',
]);

export function classifyAddress(email) {
  const normalized = normalizeEmail(email);
  const local = normalized.split('@')[0] ?? '';
  const cleanedLocal = local.replace(/[^a-z0-9._+-]/g, '');

  if (!normalized.includes('@') || local !== cleanedLocal || local.startsWith('%')) {
    return 'junk';
  }
  if (/^[a-f0-9]{24,}$/i.test(local) || /^(email|example|test|noreply|no-reply)$/.test(local)) {
    return 'junk';
  }

  const tokens = local.split(/[._+-]+/).filter(Boolean);
  if (tokens.some((token) => GEO_LOCALS.has(token)) || GEO_LOCALS.has(local)) {
    return 'branch';
  }
  if (ROLE_LOCALS.has(local) || tokens.some((token) => ROLE_LOCALS.has(token))) {
    return 'role';
  }

  return 'named_individual';
}

export function stemInContext(email, context) {
  const local = normalizeEmail(email).split('@')[0] ?? '';
  const stems = local
    .split(/[._+-]+/)
    .filter((part) => part.length >= 3)
    .map((part) => escapeRegExp(part));
  if (stems.length === 0) return 'no';
  const haystack = String(context ?? '');
  return stems.some((stem) => new RegExp(`\\b${stem}\\b`, 'i').test(haystack)) ? 'yes' : 'no';
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
