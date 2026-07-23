(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.DocumentAgent = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DAY = 24 * 60 * 60 * 1000;
  const SYSTEM_PROMPT = [
    "You are a document-collection follow-up agent.",
    "Only chase missing documents, flag deadlines, and record audit events.",
    "Do not provide migration or legal advice.",
    "Do not make hiring decisions.",
    "Never send externally in the MVP; create draft-only email or WhatsApp copy.",
    "Keep every record tenant-scoped and use synthetic demo data only.",
  ].join(" ");

  const PROVIDERS = {
    email: { id: "email", label: "Email", mode: "draft_only" },
    whatsapp: { id: "whatsapp", label: "WhatsApp", mode: "draft_only" },
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const parseDate = (value) => new Date(String(value).includes("T") ? value : `${value}T00:00:00.000Z`);
  const daysUntil = (date, now) => Math.ceil((parseDate(date) - parseDate(now)) / DAY);
  const daysSince = (date, now) => Math.max(0, Math.floor((parseDate(now) - parseDate(date)) / DAY));
  const missingDocuments = (item) => (item.documents || []).filter((doc) => doc.required && doc.status !== "received");
  const receivedDocuments = (item) => (item.documents || []).filter((doc) => doc.status === "received");
  const dueText = (date) => new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short" }).format(parseDate(date));
  const itemLabel = (item) => item.vertical === "hr" ? "candidate" : "client";
  const ownerLabel = (item) => item.vertical === "hr" ? "recruiter" : "adviser";
  const syntheticId = (prefix, parts) => `${prefix}-${parts.filter(Boolean).join("-")}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-");

  function seedDocumentChaserState() {
    return {
      now: "2026-07-23T02:00:00.000Z",
      activeCaseId: "mig-001",
      cases: [
        {
          id: "mig-001",
          tenantId: "tenant-migration-demo",
          vertical: "migration",
          title: "Maya Chen - partner visa evidence",
          personName: "Maya Chen",
          ownerName: "Harbour Migration",
          pipelineLabel: "Document collection",
          readyLabel: "Ready to lodge",
          deadline: "2026-07-26",
          lastContactAt: "2026-07-17T01:00:00.000Z",
          preferredChannel: "whatsapp",
          followUpCount: 2,
          status: "waiting_on_client",
          documents: [
            { id: "mig-001-passport", tenantId: "tenant-migration-demo", caseId: "mig-001", label: "Passport bio page", required: true, status: "received", dueDate: "2026-07-20", receivedAt: "2026-07-18T05:20:00.000Z", followUpCount: 0 },
            { id: "mig-001-police", tenantId: "tenant-migration-demo", caseId: "mig-001", label: "Police clearance", required: true, status: "missing", dueDate: "2026-07-24", lastRequestedAt: "2026-07-17T01:00:00.000Z", followUpCount: 2 },
            { id: "mig-001-medical", tenantId: "tenant-migration-demo", caseId: "mig-001", label: "Medical exam receipt", required: true, status: "missing", dueDate: "2026-07-29", lastRequestedAt: "2026-07-17T01:00:00.000Z", followUpCount: 1 },
          ],
          auditEvents: [
            audit("tenant-migration-demo", "mig-001", "seeded_case", "Synthetic migration demo case loaded", "No external data used.", "2026-07-23T02:00:00.000Z"),
          ],
        },
        {
          id: "hr-001",
          tenantId: "tenant-hr-demo",
          vertical: "hr",
          title: "Aisha Rahman - senior support shortlist",
          personName: "Aisha Rahman",
          ownerName: "Optora HR",
          pipelineLabel: "Pre-placement checks",
          readyLabel: "Ready to place",
          deadline: "2026-07-31",
          lastContactAt: "2026-07-22T00:30:00.000Z",
          preferredChannel: "email",
          followUpCount: 0,
          status: "waiting_on_candidate",
          documents: [
            { id: "hr-001-rtw", tenantId: "tenant-hr-demo", caseId: "hr-001", label: "Right-to-work evidence", required: true, status: "missing", dueDate: "2026-07-30", lastRequestedAt: "2026-07-22T00:30:00.000Z", followUpCount: 0 },
            { id: "hr-001-references", tenantId: "tenant-hr-demo", caseId: "hr-001", label: "Two referee contacts", required: true, status: "received", dueDate: "2026-07-28", receivedAt: "2026-07-22T05:10:00.000Z", followUpCount: 0 },
          ],
          auditEvents: [
            audit("tenant-hr-demo", "hr-001", "seeded_case", "Synthetic HR demo candidate loaded", "No external data used.", "2026-07-23T02:00:00.000Z"),
          ],
        },
      ],
    };
  }

  function audit(tenantId, caseId, type, decision, reason, createdAt, extra = {}) {
    return {
      id: syntheticId("audit", [caseId, type, createdAt || new Date().toISOString()]),
      tenantId,
      caseId,
      actor: "document_chaser_simulator",
      type,
      decision,
      reason,
      createdAt,
      sentExternally: false,
      ...extra,
    };
  }

  function escalationReasons(item, missing, now) {
    const nearestDue = Math.min(...missing.map((doc) => daysUntil(doc.dueDate, now)));
    const highestFollowUps = Math.max(...missing.map((doc) => doc.followUpCount || 0), item.followUpCount || 0);
    const reasons = [];
    if (nearestDue <= 3) reasons.push(`nearest missing document is due in ${nearestDue} day${nearestDue === 1 ? "" : "s"}`);
    if (highestFollowUps >= 2) reasons.push(`${highestFollowUps} previous follow-up${highestFollowUps === 1 ? "" : "s"}`);
    return reasons;
  }

  function decideNextAction(item, options = {}) {
    const now = options.now || item.now || new Date().toISOString();
    const channel = PROVIDERS[options.channel] ? options.channel : item.preferredChannel || "email";
    const missing = missingDocuments(item);
    const received = receivedDocuments(item);

    if (!missing.length) {
      return {
        id: syntheticId("action", [item.id, "ready", now]),
        tenantId: item.tenantId,
        caseId: item.id,
        type: "ready_for_review",
        status: "ready_for_review",
        channel,
        severity: "ok",
        headline: item.readyLabel,
        missing,
        received,
        draft: null,
        auditEvent: audit(item.tenantId, item.id, "ready_for_review", item.readyLabel, "All required documents are marked received.", now),
      };
    }

    const lastContactDays = daysSince(item.lastContactAt, now);
    const reasons = escalationReasons(item, missing, now);
    const shouldEscalate = reasons.length > 0;
    const shouldWait = !shouldEscalate && lastContactDays < 3;
    const type = shouldWait ? "wait" : shouldEscalate ? "escalate" : "draft_follow_up";
    const status = shouldWait ? item.status : shouldEscalate ? "escalation_flagged" : `drafted_${channel}`;
    const reason = shouldWait
      ? `Last contact was ${lastContactDays} day${lastContactDays === 1 ? "" : "s"} ago; wait before another chase.`
      : `${missing.length} missing document${missing.length === 1 ? "" : "s"}; last contact ${lastContactDays} day${lastContactDays === 1 ? "" : "s"} ago${reasons.length ? `; ${reasons.join("; ")}` : ""}.`;

    return {
      id: syntheticId("action", [item.id, type, channel, now]),
      tenantId: item.tenantId,
      caseId: item.id,
      type,
      status,
      channel,
      severity: shouldEscalate ? "bad" : shouldWait ? "warn" : "info",
      headline: shouldWait ? "Hold follow-up" : shouldEscalate ? "Escalation flagged" : "Follow-up draft ready",
      missing,
      received,
      draft: shouldWait ? null : makeDraft(item, missing, channel, shouldEscalate),
      auditEvent: audit(item.tenantId, item.id, type, shouldWait ? "Wait before next contact" : `Create ${PROVIDERS[channel].label} draft`, reason, now, {
        channel,
        providerMode: PROVIDERS[channel].mode,
        documentIds: missing.map((doc) => doc.id),
      }),
    };
  }

  function makeDraft(item, missing, channel, escalation) {
    const docLines = missing.map((doc) => `- ${doc.label} (due ${dueText(doc.dueDate)})`).join("\n");
    const legalBoundary = item.vertical === "migration"
      ? `This is only a document request; your ${ownerLabel(item)} will review any visa or legal questions separately.`
      : `This is only a document request; your ${ownerLabel(item)} will review suitability and next steps separately.`;

    if (channel === "whatsapp") {
      return {
        providerId: "whatsapp",
        providerMode: PROVIDERS.whatsapp.mode,
        sentExternally: false,
        body: [
          `Hi ${item.personName}, quick follow-up on the items still needed so your file can keep moving:`,
          docLines,
          escalation ? "The nearest due date is close, so please send what you have or reply with timing today." : "Please send what you have, or reply with timing if anything is delayed.",
          legalBoundary,
        ].join("\n"),
      };
    }

    return {
      providerId: "email",
      providerMode: PROVIDERS.email.mode,
      sentExternally: false,
      subject: `Documents needed for ${item.pipelineLabel.toLowerCase()}`,
      body: [
        `Hi ${item.personName},`,
        "",
        `Quick follow-up on the documents still needed so your ${itemLabel(item)} file can keep moving:`,
        docLines,
        "",
        escalation ? "The nearest due date is close, so please send what you have or reply with expected timing today." : "Please send what you have, or reply with expected timing if anything is delayed.",
        "",
        legalBoundary,
      ].join("\n"),
    };
  }

  function runAgent(state, caseId, options = {}) {
    const next = clone(state);
    const item = next.cases.find((row) => row.id === caseId);
    if (!item) return next;
    const action = decideNextAction(item, { now: next.now, ...options });
    item.status = action.status;
    item.lastAction = action;
    item.auditEvents = [...(item.auditEvents || []), action.auditEvent];
    next.activeCaseId = caseId;
    return next;
  }

  function applyMockReply(state, caseId, documentId, options = {}) {
    const next = clone(state);
    const now = options.now || next.now || new Date().toISOString();
    const item = next.cases.find((row) => row.id === caseId);
    if (!item) return next;
    const doc = item.documents.find((row) => row.id === documentId);
    if (!doc) return next;

    doc.status = "received";
    doc.receivedAt = now;
    item.lastContactAt = now;
    const missing = missingDocuments(item);
    item.status = missing.length ? "document_received_partial" : "ready_for_review";
    item.lastAction = null;
    item.auditEvents = [...(item.auditEvents || []), audit(item.tenantId, item.id, "mock_reply_received", `${doc.label} marked received`, missing.length ? `${missing.length} required document${missing.length === 1 ? "" : "s"} still missing.` : "All required documents are now received.", now, {
      documentIds: [doc.id],
    })];
    next.activeCaseId = caseId;
    return next;
  }

  function assertTenantScoped(state) {
    return (state.cases || []).every((item) =>
      Boolean(item.tenantId) &&
      (item.documents || []).every((doc) => doc.tenantId === item.tenantId && doc.caseId === item.id) &&
      (item.auditEvents || []).every((event) => event.tenantId === item.tenantId && event.caseId === item.id && event.sentExternally === false)
    );
  }

  return {
    PROVIDERS,
    SYSTEM_PROMPT,
    applyMockReply,
    assertTenantScoped,
    decideNextAction,
    daysSince,
    daysUntil,
    missingDocuments,
    runAgent,
    seedDocumentChaserState,
  };
});
