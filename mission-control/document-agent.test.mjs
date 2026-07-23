import assert from "node:assert";
import { createRequire } from "node:module";
import { demoBackOfficeData } from "./back-office/demo-data.mjs";
import { VERTICAL_CONFIGS } from "./back-office/model.mjs";

const require = createRequire(import.meta.url);
const agent = require("./document-agent.js");

const state = agent.seedDocumentChaserState(demoBackOfficeData, { verticalConfigs: VERTICAL_CONFIGS });
assert(agent.assertTenantScoped(state), "seed records must stay tenant-scoped");
assert(agent.SYSTEM_PROMPT.includes("Do not provide migration or legal advice."));
assert(agent.SYSTEM_PROMPT.includes("Do not make hiring decisions."));
assert.equal(state.cases.length, 6);
assert.equal(state.cases.flatMap((row) => row.documents).length, demoBackOfficeData.document_requests.length);

const migrationCase = state.cases.find((row) => row.reference === "MIG-DEMO-001");
const action = agent.decideNextAction(migrationCase, { now: state.now, channel: "whatsapp" });

assert.equal(action.type, "escalate");
assert.equal(action.status, "escalation_flagged");
assert.equal(action.draft.providerMode, "draft_only");
assert.equal(action.draft.sentExternally, false);
assert(action.draft.body.includes("Sponsor financial evidence"));
assert(action.auditEvent.reason.includes("last contact 1 day ago"));
assert(!/Hermes|Multica/i.test(action.draft.body), "prospect-facing drafts must not name-drop internal tools");

const afterDraft = agent.runAgent(state, migrationCase.id, { channel: "email" });
const updatedMigrationCase = afterDraft.cases.find((row) => row.id === migrationCase.id);
assert.equal(updatedMigrationCase.status, "escalation_flagged");
assert.equal(updatedMigrationCase.auditEvents.at(-1).providerMode, "draft_only");
assert.equal(updatedMigrationCase.auditEvents.at(-1).sentExternally, false);
assert.equal(updatedMigrationCase.lastAction.draft.providerId, "email");
assert(updatedMigrationCase.lastAction.draft.subject.includes("Documents needed"));
assert(!/Hermes|Multica/i.test(updatedMigrationCase.lastAction.draft.body), "email drafts must not name-drop internal tools");

const afterReply = agent.applyMockReply(afterDraft, migrationCase.id, "doc-mig-001-sponsor", { now: "2026-07-23T03:00:00.000Z" });
const repliedCase = afterReply.cases.find((row) => row.id === migrationCase.id);
assert.equal(repliedCase.documents.find((doc) => doc.id === "doc-mig-001-sponsor").status, "received");
assert.equal(repliedCase.status, "document_received_partial");
assert.equal(repliedCase.auditEvents.at(-1).type, "mock_reply_received");
assert(agent.assertTenantScoped(afterReply), "reply updates must remain tenant-scoped");

const hrCase = state.cases.find((row) => row.reference === "HR-DEMO-001");
const hrAction = agent.decideNextAction(hrCase, { now: state.now, channel: "email" });
assert.equal(hrAction.type, "wait");
assert.equal(hrAction.draft, null);

const overdueHrCase = state.cases.find((row) => row.reference === "HR-DEMO-002");
const overdueAction = agent.decideNextAction(overdueHrCase, { now: state.now, channel: "whatsapp" });
assert.equal(overdueAction.type, "escalate");
assert(overdueAction.auditEvent.reason.includes("overdue"));

console.log("ok - document chaser simulator");
