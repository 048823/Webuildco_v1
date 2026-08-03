import { sameDomain } from './domain.mjs';

export const EVIDENCE_RECORD_VERSION = '2026-08-04.web452';

export const SOURCE_CLASSES = Object.freeze([
  'organisation_own_site',
  'public_register',
  'third_party_directory',
  'aggregated_list',
]);

const SOURCE_CLASS_ALIASES = new Map([
  ['organisation own site', 'organisation_own_site'],
  ['organisations own site', 'organisation_own_site'],
  ['organization own site', 'organisation_own_site'],
  ['organizations own site', 'organisation_own_site'],
  ['own site', 'organisation_own_site'],
  ['company site', 'organisation_own_site'],
  ['public register', 'public_register'],
  ['register', 'public_register'],
  ['government register', 'public_register'],
  ['third party directory', 'third_party_directory'],
  ['directory', 'third_party_directory'],
  ['aggregated list', 'aggregated_list'],
  ['vendor list', 'aggregated_list'],
  ['list', 'aggregated_list'],
]);

export function normalizeSourceClass(value) {
  const key = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[']/g, '')
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ');
  if (!key) return '';
  return SOURCE_CLASS_ALIASES.get(key) ?? '';
}

export function normalizeInputSourceClass(inputRow) {
  return normalizeSourceClass(
    inputRow.input_source_class
      || inputRow.domain_source_class
      || inputRow.domain_source_type
      || inputRow.list_source_class
      || '',
  );
}

export function resolvePublicationSourceClass(inputRow, sourceUrl) {
  const explicit = normalizeSourceClass(
    inputRow.publication_source_class
      || inputRow.address_source_class
      || inputRow.source_class
      || '',
  );
  if (explicit) {
    return {
      source_class: explicit,
      source_class_basis: 'explicit publication source class supplied in input row',
    };
  }

  let sourceHost = '';
  try {
    sourceHost = new URL(sourceUrl).hostname;
  } catch {
    sourceHost = '';
  }

  if (sourceHost && inputRow.domain && sameDomain(sourceHost, inputRow.domain)) {
    return {
      source_class: 'organisation_own_site',
      source_class_basis: 'source URL host matches the input organisation domain',
    };
  }

  return {
    source_class: 'aggregated_list',
    source_class_basis: 'off-domain source URL without explicit publication_source_class; hold for manual classification before export',
  };
}

export function buildCl42eToGMapping({ addressClass, stemInContextValue }) {
  const mapping = {
    cl_4_2_e: addressClass === 'named_individual' ? 'candidate' : 'not_primary_for_address_class',
    cl_4_2_f: addressClass === 'branch' ? 'candidate' : 'not_primary_for_address_class',
    cl_4_2_g: addressClass === 'role' || addressClass === 'branch' ? 'candidate' : 'not_primary_for_address_class',
    role_or_function_signal: roleOrFunctionSignal(addressClass, stemInContextValue),
    campaign_relevance_status: 'not_assessed_by_crawler',
    campaign_relevance_required: 'map the final message topic to the work-related business, function, duty, office, position, function or role shown in published_context before export',
  };
  return JSON.stringify(mapping);
}

function roleOrFunctionSignal(addressClass, stemInContextValue) {
  if (addressClass === 'named_individual') {
    return stemInContextValue === 'yes'
      ? 'named address; local-part stem appears in published context'
      : 'named address; local-part stem not found in published context';
  }
  if (addressClass === 'role') return 'role address local-part';
  if (addressClass === 'branch') return 'branch or location address local-part';
  return 'no usable role or function signal';
}
