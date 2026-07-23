import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const agent = require("./document-agent.js");

const state = agent.seedDocumentChaserState();
assert(agent.assertTenantScoped(state), "seed records must stay tenant-scoped");
assert(agent.SYSTEM_PROMPT.includes("Do not provide migration or legal advice."));
assert(agent.SYSTEM_PROMPT.includes("Do not make hiring decisions."));

const migrationCase = state.cases.find((row) => row.id === "mig-001");
const action = agent.decideNextAction(migrationCase, { now: state.now, channel: "whatsapp" });

assert.equal(action.type, "escalate");
assert.equal(action.status, "escalation_flagged");
assert.equal(action.draft.providerMode, "draft_only");
assert.equal(action.draft.sentExternally, false);
assert(action.draft.body.includes("Police clearance"));
assert(action.auditEvent.reason.includes("last contact 6 days ago"));
assert(!/Hermes|Multica/i.test(action.draft.body), "prospect-facing drafts must not name-drop internal tools");

const afterDraft = agent.runAgent(state, "mig-001", { channel: "email" });
const updatedMigrationCase = afterDraft.cases.find((row) => row.id === "mig-001");
assert.equal(updatedMigrationCase.status, "escalation_flagged");
assert.equal(updatedMigrationCase.auditEvents.at(-1).providerMode, "draft_only");
assert.equal(updatedMigrationCase.auditEvents.at(-1).sentExternally, false);
assert.equal(updatedMigrationCase.lastAction.draft.providerId, "email");
assert(updatedMigrationCase.lastAction.draft.subject.includes("Documents needed"));
assert(!/Hermes|Multica/i.test(updatedMigrationCase.lastAction.draft.body), "email drafts must not name-drop internal tools");

const afterReply = agent.applyMockReply(afterDraft, "mig-001", "mig-001-police", { now: "2026-07-23T03:00:00.000Z" });
const repliedCase = afterReply.cases.find((row) => row.id === "mig-001");
assert.equal(repliedCase.documents.find((doc) => doc.id === "mig-001-police").status, "received");
assert.equal(repliedCase.status, "document_received_partial");
assert.equal(repliedCase.auditEvents.at(-1).type, "mock_reply_received");
assert(agent.assertTenantScoped(afterReply), "reply updates must remain tenant-scoped");

const hrCase = state.cases.find((row) => row.id === "hr-001");
const hrAction = agent.decideNextAction(hrCase, { now: state.now, channel: "email" });
assert.equal(hrAction.type, "wait");
assert.equal(hrAction.draft, null);

console.log("ok - document chaser simulator");
