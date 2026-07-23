import assert from "node:assert";
import {
  PIPELINE_STATES,
  VERTICAL_CONFIGS,
  assertBackOfficeData,
  checklistItem,
  recordsForVertical,
  summarizeVertical,
  validateBackOfficeData,
} from "./model.mjs";
import { demoBackOfficeData } from "./demo-data.mjs";

assert.deepEqual(PIPELINE_STATES.map((state) => state.id), [
  "intake",
  "document_collection",
  "compliance_check",
  "ready_outcome",
]);
assert.equal(VERTICAL_CONFIGS.migration.readyLabel, "Ready to lodge");
assert.equal(VERTICAL_CONFIGS.hr.readyLabel, "Ready to place");
assert.equal(checklistItem("migration", "sponsor_financials").role, "sponsor");
assert.equal(checklistItem("hr", "right_to_work").label, "Right-to-work evidence");

assertBackOfficeData(demoBackOfficeData);

for (const collection of Object.keys(demoBackOfficeData)) {
  for (const record of demoBackOfficeData[collection]) {
    assert(record.tenant_id, `${collection}.${record.id} must carry tenant_id`);
  }
}

const migration = recordsForVertical(demoBackOfficeData, "migration");
const hr = recordsForVertical(demoBackOfficeData, "hr");
assert.equal(migration.cases.length, 3);
assert.equal(hr.cases.length, 3);
assert(migration.cases.every((unit) => unit.tenant_id === "tenant-migration-demo"));
assert(hr.cases.every((unit) => unit.tenant_id === "tenant-hr-demo"));

const migrationStates = new Set(migration.cases.map((unit) => unit.pipeline_state));
const hrStates = new Set(hr.cases.map((unit) => unit.pipeline_state));
assert(migrationStates.has("document_collection"));
assert(migrationStates.has("compliance_check"));
assert(migrationStates.has("ready_outcome"));
assert(hrStates.has("intake"));
assert(hrStates.has("document_collection"));
assert(hrStates.has("compliance_check"));

const migrationSummary = summarizeVertical(demoBackOfficeData, "migration");
const hrSummary = summarizeVertical(demoBackOfficeData, "hr");
assert.equal(migrationSummary[0].unit_label, "case");
assert.equal(hrSummary[0].unit_label, "candidate");
assert.equal(migrationSummary.find((row) => row.reference === "MIG-DEMO-001").secondary, "Rahul Hart");
assert.equal(hrSummary.find((row) => row.reference === "HR-DEMO-001").secondary, "Sara Lee");
assert.equal(migrationSummary.find((row) => row.reference === "MIG-DEMO-001").documents_missing, 2);
assert.equal(hrSummary.find((row) => row.reference === "HR-DEMO-002").next_action, "Escalate overdue references and expired contract pack to recruiter.");

const badTenantCrossing = structuredClone(demoBackOfficeData);
badTenantCrossing.document_requests[0].tenant_id = "tenant-hr-demo";
assert(validateBackOfficeData(badTenantCrossing).some((error) => error.includes("crosses tenant boundary")));

const forbiddenNames = JSON.stringify(demoBackOfficeData).toLowerCase();
assert(!forbiddenNames.includes("brilliant"), "demo data must not include Brilliant Co data");

console.log("ok - back-office model, vertical configs, and synthetic fixtures");
