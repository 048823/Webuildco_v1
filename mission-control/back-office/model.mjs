export const PIPELINE_STATES = Object.freeze([
  { id: "intake", label: "Intake", next: ["document_collection"] },
  { id: "document_collection", label: "Document collection", next: ["compliance_check"] },
  { id: "compliance_check", label: "Compliance check", next: ["ready_outcome"] },
  { id: "ready_outcome", label: "Ready outcome", next: [] },
]);

export const DOCUMENT_STATUSES = Object.freeze(["missing", "requested", "received", "review_required", "expired", "waived"]);
export const DEADLINE_STATUSES = Object.freeze(["on_track", "at_risk", "overdue", "met"]);
export const THREAD_STATUSES = Object.freeze(["draft_due", "waiting", "escalated", "closed"]);

export const SHARED_COLLECTIONS = Object.freeze([
  "tenants",
  "cases",
  "people",
  "document_requests",
  "deadlines",
  "follow_up_threads",
  "audit_events",
]);

export const REQUIRED_FIELDS = Object.freeze({
  tenants: Object.freeze(["id", "tenant_id", "vertical", "name"]),
  cases: Object.freeze(["id", "tenant_id", "vertical", "reference", "subject_person_id", "owner_person_id", "pipeline_state"]),
  people: Object.freeze(["id", "tenant_id", "roles", "display_name", "email"]),
  document_requests: Object.freeze(["id", "tenant_id", "case_id", "person_id", "checklist_key", "status", "due_on"]),
  deadlines: Object.freeze(["id", "tenant_id", "case_id", "kind", "label", "due_on", "status"]),
  follow_up_threads: Object.freeze(["id", "tenant_id", "case_id", "channel", "participant_person_id", "status", "provider"]),
  audit_events: Object.freeze(["id", "tenant_id", "case_id", "actor", "action", "reason", "created_at"]),
});

export const VERTICAL_CONFIGS = Object.freeze({
  migration: Object.freeze({
    id: "migration",
    name: "Migration agents",
    unit: Object.freeze({ singular: "case", plural: "cases", reference: "Case ID" }),
    people: Object.freeze({
      primary: "applicant",
      secondary: "sponsor",
      owner: "migration_agent",
    }),
    pipelineLabels: Object.freeze({
      intake: "Intake received",
      document_collection: "Collecting visa evidence",
      compliance_check: "Compliance check",
      ready_outcome: "Ready to lodge",
    }),
    checklist: Object.freeze([
      Object.freeze({ key: "passport_identity", label: "Passport identity page", role: "applicant" }),
      Object.freeze({ key: "visa_history", label: "Visa history evidence", role: "applicant" }),
      Object.freeze({ key: "sponsor_financials", label: "Sponsor financial evidence", role: "sponsor" }),
      Object.freeze({ key: "police_check", label: "Police check", role: "applicant" }),
      Object.freeze({ key: "medical_check", label: "Medical check", role: "applicant" }),
    ]),
    deadlines: Object.freeze([
      Object.freeze({ kind: "evidence_due", label: "Evidence due" }),
      Object.freeze({ kind: "visa_expiry", label: "Visa expiry" }),
      Object.freeze({ kind: "lodgement_target", label: "Lodgement target" }),
    ]),
    readyLabel: "Ready to lodge",
    agentConstraints: Object.freeze([
      "Draft or mock document follow-ups only.",
      "Flag dates and missing evidence only; do not provide migration or legal advice.",
    ]),
  }),
  hr: Object.freeze({
    id: "hr",
    name: "Optora / HR",
    unit: Object.freeze({ singular: "candidate", plural: "candidates", reference: "Candidate ID" }),
    people: Object.freeze({
      primary: "candidate",
      secondary: "hiring_manager",
      owner: "recruiter",
    }),
    pipelineLabels: Object.freeze({
      intake: "Candidate intake",
      document_collection: "Recruitment documents",
      compliance_check: "Pre-placement check",
      ready_outcome: "Ready to place",
    }),
    checklist: Object.freeze([
      Object.freeze({ key: "cv", label: "Current CV", role: "candidate" }),
      Object.freeze({ key: "right_to_work", label: "Right-to-work evidence", role: "candidate" }),
      Object.freeze({ key: "references", label: "Reference checks", role: "candidate" }),
      Object.freeze({ key: "contract_pack", label: "Contract pack", role: "candidate" }),
      Object.freeze({ key: "onboarding_forms", label: "Onboarding forms", role: "candidate" }),
    ]),
    deadlines: Object.freeze([
      Object.freeze({ kind: "interview", label: "Interview" }),
      Object.freeze({ kind: "offer", label: "Offer target" }),
      Object.freeze({ kind: "placement", label: "Placement target" }),
      Object.freeze({ kind: "onboarding", label: "Onboarding deadline" }),
    ]),
    readyLabel: "Ready to place",
    agentConstraints: Object.freeze([
      "Draft or mock document follow-ups only.",
      "Flag dates and missing paperwork only; do not make hiring decisions.",
    ]),
  }),
});

const PIPELINE_IDS = new Set(PIPELINE_STATES.map((state) => state.id));
const validSet = (rows) => new Set(rows);
const DOCUMENT_STATUS_IDS = validSet(DOCUMENT_STATUSES);
const DEADLINE_STATUS_IDS = validSet(DEADLINE_STATUSES);
const THREAD_STATUS_IDS = validSet(THREAD_STATUSES);

export function verticalConfig(vertical) {
  const config = VERTICAL_CONFIGS[vertical];
  if (!config) throw new Error(`Unknown back-office vertical: ${vertical}`);
  return config;
}

export function checklistItem(vertical, key) {
  const item = verticalConfig(vertical).checklist.find((row) => row.key === key);
  if (!item) throw new Error(`Unknown checklist item for ${vertical}: ${key}`);
  return item;
}

export function validateBackOfficeData(data) {
  const errors = [];
  const rows = (collection) => {
    const value = data?.[collection];
    if (!Array.isArray(value)) {
      errors.push(`${collection} must be an array`);
      return [];
    }
    return value;
  };

  for (const collection of SHARED_COLLECTIONS) {
    for (const record of rows(collection)) {
      for (const field of REQUIRED_FIELDS[collection]) {
        if (record[field] == null || record[field] === "") errors.push(`${collection}.${record.id || "unknown"} missing ${field}`);
      }
      if (!record.tenant_id) errors.push(`${collection}.${record.id || "unknown"} missing tenant_id`);
    }
  }

  const tenants = new Map(rows("tenants").map((tenant) => [tenant.id, tenant]));
  const people = new Map(rows("people").map((person) => [person.id, person]));
  const cases = new Map(rows("cases").map((unit) => [unit.id, unit]));

  for (const tenant of rows("tenants")) {
    if (tenant.id !== tenant.tenant_id) errors.push(`tenant ${tenant.id} must use id as its tenant boundary`);
    if (!VERTICAL_CONFIGS[tenant.vertical]) errors.push(`tenant ${tenant.id} has unknown vertical ${tenant.vertical}`);
  }

  for (const unit of rows("cases")) {
    const tenant = tenants.get(unit.tenant_id);
    if (!tenant) errors.push(`case ${unit.id} references unknown tenant ${unit.tenant_id}`);
    if (tenant && tenant.vertical !== unit.vertical) errors.push(`case ${unit.id} vertical does not match tenant ${unit.tenant_id}`);
    if (!PIPELINE_IDS.has(unit.pipeline_state)) errors.push(`case ${unit.id} has unknown pipeline_state ${unit.pipeline_state}`);
    for (const personId of [unit.subject_person_id, unit.secondary_person_id, unit.owner_person_id].filter(Boolean)) {
      const person = people.get(personId);
      if (!person) errors.push(`case ${unit.id} references unknown person ${personId}`);
      if (person && person.tenant_id !== unit.tenant_id) errors.push(`case ${unit.id} crosses tenant boundary via person ${personId}`);
    }
  }

  for (const request of rows("document_requests")) {
    const unit = cases.get(request.case_id);
    const person = people.get(request.person_id);
    if (!unit) errors.push(`document_request ${request.id} references unknown case ${request.case_id}`);
    if (!person) errors.push(`document_request ${request.id} references unknown person ${request.person_id}`);
    if (unit && unit.tenant_id !== request.tenant_id) errors.push(`document_request ${request.id} crosses tenant boundary via case ${request.case_id}`);
    if (person && person.tenant_id !== request.tenant_id) errors.push(`document_request ${request.id} crosses tenant boundary via person ${request.person_id}`);
    if (!DOCUMENT_STATUS_IDS.has(request.status)) errors.push(`document_request ${request.id} has unknown status ${request.status}`);
    if (unit) {
      try { checklistItem(unit.vertical, request.checklist_key); } catch (error) { errors.push(error.message); }
    }
  }

  for (const deadline of rows("deadlines")) {
    const unit = cases.get(deadline.case_id);
    if (!unit) errors.push(`deadline ${deadline.id} references unknown case ${deadline.case_id}`);
    if (unit && unit.tenant_id !== deadline.tenant_id) errors.push(`deadline ${deadline.id} crosses tenant boundary via case ${deadline.case_id}`);
    if (!DEADLINE_STATUS_IDS.has(deadline.status)) errors.push(`deadline ${deadline.id} has unknown status ${deadline.status}`);
    if (unit && !verticalConfig(unit.vertical).deadlines.some((row) => row.kind === deadline.kind)) {
      errors.push(`deadline ${deadline.id} has unknown kind ${deadline.kind} for ${unit.vertical}`);
    }
  }

  for (const thread of rows("follow_up_threads")) {
    const unit = cases.get(thread.case_id);
    const person = people.get(thread.participant_person_id);
    if (!unit) errors.push(`follow_up_thread ${thread.id} references unknown case ${thread.case_id}`);
    if (!person) errors.push(`follow_up_thread ${thread.id} references unknown person ${thread.participant_person_id}`);
    if (unit && unit.tenant_id !== thread.tenant_id) errors.push(`follow_up_thread ${thread.id} crosses tenant boundary via case ${thread.case_id}`);
    if (person && person.tenant_id !== thread.tenant_id) errors.push(`follow_up_thread ${thread.id} crosses tenant boundary via person ${thread.participant_person_id}`);
    if (!THREAD_STATUS_IDS.has(thread.status)) errors.push(`follow_up_thread ${thread.id} has unknown status ${thread.status}`);
    if (thread.provider !== "mock") errors.push(`follow_up_thread ${thread.id} must use provider=mock in the MVP`);
  }

  for (const event of rows("audit_events")) {
    const unit = cases.get(event.case_id);
    if (!unit) errors.push(`audit_event ${event.id} references unknown case ${event.case_id}`);
    if (unit && unit.tenant_id !== event.tenant_id) errors.push(`audit_event ${event.id} crosses tenant boundary via case ${event.case_id}`);
  }

  return errors;
}

export function assertBackOfficeData(data) {
  const errors = validateBackOfficeData(data);
  if (errors.length) throw new Error(errors.join("\n"));
  return true;
}

export function recordsForVertical(data, vertical) {
  verticalConfig(vertical);
  const tenantIds = new Set((data.tenants || []).filter((tenant) => tenant.vertical === vertical).map((tenant) => tenant.id));
  return Object.fromEntries(SHARED_COLLECTIONS.map((collection) => [
    collection,
    (data[collection] || []).filter((record) => tenantIds.has(record.tenant_id)),
  ]));
}

export function summarizeUnit(unit, data) {
  const config = verticalConfig(unit.vertical);
  const person = (data.people || []).find((row) => row.id === unit.subject_person_id);
  const secondary = (data.people || []).find((row) => row.id === unit.secondary_person_id);
  const documents = (data.document_requests || []).filter((row) => row.case_id === unit.id);
  const deadlines = (data.deadlines || []).filter((row) => row.case_id === unit.id);
  const followUp = (data.follow_up_threads || []).find((row) => row.case_id === unit.id && row.status !== "closed");
  const documentCounts = documents.reduce((out, row) => {
    out[row.status] = (out[row.status] || 0) + 1;
    return out;
  }, {});

  return {
    id: unit.id,
    tenant_id: unit.tenant_id,
    vertical: unit.vertical,
    reference: unit.reference,
    unit_label: config.unit.singular,
    subject: person?.display_name || unit.subject_person_id,
    pipeline_state: unit.pipeline_state,
    pipeline_label: config.pipelineLabels[unit.pipeline_state],
    ready_label: config.readyLabel,
    secondary: secondary?.display_name || "",
    documents_total: documents.length,
    documents_missing: (documentCounts.missing || 0) + (documentCounts.requested || 0) + (documentCounts.expired || 0),
    documents_review: documentCounts.review_required || 0,
    deadlines_open: deadlines.filter((row) => row.status !== "met").length,
    next_action: followUp?.next_action || "",
  };
}

export function summarizeVertical(data, vertical) {
  const scoped = recordsForVertical(data, vertical);
  return scoped.cases.map((unit) => summarizeUnit(unit, scoped));
}
