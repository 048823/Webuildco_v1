import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCl42eToGMapping,
  EVIDENCE_RECORD_VERSION,
  normalizeInputSourceClass,
  normalizeSourceClass,
  resolvePublicationSourceClass,
  SOURCE_CLASSES,
} from '../lib/evidence.mjs';

test('source class taxonomy normalizes the four permitted publication classes', () => {
  assert.deepEqual(SOURCE_CLASSES, [
    'organisation_own_site',
    'public_register',
    'third_party_directory',
    'aggregated_list',
  ]);
  assert.equal(normalizeSourceClass("organisation's own site"), 'organisation_own_site');
  assert.equal(normalizeSourceClass('Public Register'), 'public_register');
  assert.equal(normalizeSourceClass('third-party directory'), 'third_party_directory');
  assert.equal(normalizeSourceClass('vendor_list'), 'aggregated_list');
});

test('publication source class is row-level and separate from input domain provenance', () => {
  const ownSite = resolvePublicationSourceClass(
    { domain: 'example.com', input_source_class: 'public register' },
    'https://www.example.com/contact',
  );
  assert.equal(ownSite.source_class, 'organisation_own_site');
  assert.equal(normalizeInputSourceClass({ input_source_class: 'public register' }), 'public_register');

  const registerPage = resolvePublicationSourceClass(
    { domain: 'example.com', publication_source_class: 'public_register' },
    'https://register.example.gov.au/record/123',
  );
  assert.equal(registerPage.source_class, 'public_register');
});

test('cl 4(2)(e)-(g) mapping records candidates without deciding campaign relevance', () => {
  const roleMapping = JSON.parse(buildCl42eToGMapping({
    addressClass: 'role',
    stemInContextValue: 'no',
  }));
  assert.equal(roleMapping.cl_4_2_g, 'candidate');
  assert.equal(roleMapping.cl_4_2_e, 'not_primary_for_address_class');
  assert.equal(roleMapping.campaign_relevance_status, 'not_assessed_by_crawler');

  const namedMapping = JSON.parse(buildCl42eToGMapping({
    addressClass: 'named_individual',
    stemInContextValue: 'yes',
  }));
  assert.equal(namedMapping.cl_4_2_e, 'candidate');
  assert.equal(namedMapping.role_or_function_signal.includes('local-part stem appears'), true);
  assert.equal(EVIDENCE_RECORD_VERSION, '2026-08-04.web452');
});
