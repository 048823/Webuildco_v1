import { availableSlots, business, publicBusinessFacts } from "./business.js";

const bookingStore = new Map();

export function makeInstructions({ recordCalls = false } = {}) {
  const consentLine = recordCalls
    ? "Tell the caller the call may be recorded for demo testing and ask for consent before continuing. If they decline recording, continue without recording if the platform allows it; otherwise offer a human callback."
    : "Do not say the call is being recorded. Recording is disabled for this demo.";

  return [
    `You are the AI receptionist for ${business.name}.`,
    business.demoDisclosure,
    "Open every call by saying you are an AI receptionist, not a human.",
    consentLine,
    "Goal: answer inbound roofing enquiries, qualify the caller, book one available inspection slot or log a callback.",
    "Keep replies short. Ask one question at a time. Confirm names, phone numbers, addresses, and dates back to the caller.",
    `Service area: ${business.serviceArea.join(", ")}.`,
    `Supported work: ${business.services.join(", ")}.`,
    `Unsupported work: ${business.unsupported.join(", ")}.`,
    `If the caller mentions danger, active electrical hazards, collapse, injury, fire, flooding, or emergency help, say: ${business.emergencyAdvice} Then offer to log an urgent callback only after they are safe.`,
    "Do not give quotes, diagnose structural safety, advise on insurance claims, or give medical, legal, emergency, or financial advice.",
    "If asked whether you are human, state clearly that you are an AI receptionist helping with intake.",
    "If the caller asks for a human, is angry, cannot be understood after two attempts, or needs unsupported work, offer human callback or transfer.",
    "Before booking, collect callerName, phone, address, postcode, jobType, urgency, and preferred slot.",
    "Use get_available_slots before offering a booking time.",
    "Use book_roofing_visit only after the caller chooses an available slot.",
    "Use request_callback when no booking is possible or the caller prefers callback.",
    "Use escalate_to_human for emergency, angry, unsupported, privacy, or human-requested calls.",
    "End by telling the caller a summary will be sent to the demo business.",
  ].join("\n");
}

export function getRealtimeTools() {
  return [
    {
      type: "function",
      name: "get_available_slots",
      description: "List currently available inspection slots for the demo roofing business.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
    {
      type: "function",
      name: "book_roofing_visit",
      description: "Book a roof inspection slot after collecting the required caller details.",
      parameters: {
        type: "object",
        properties: {
          callerName: { type: "string" },
          phone: { type: "string" },
          address: { type: "string" },
          postcode: { type: "string" },
          jobType: { type: "string" },
          urgency: { type: "string" },
          slotId: { type: "string" },
          notes: { type: "string" },
        },
        required: [
          "callerName",
          "phone",
          "address",
          "postcode",
          "jobType",
          "urgency",
          "slotId",
        ],
      },
    },
    {
      type: "function",
      name: "request_callback",
      description: "Log a callback request when a booking cannot be completed.",
      parameters: {
        type: "object",
        properties: {
          callerName: { type: "string" },
          phone: { type: "string" },
          reason: { type: "string" },
          urgency: { type: "string" },
          notes: { type: "string" },
        },
        required: ["callerName", "phone", "reason"],
      },
    },
    {
      type: "function",
      name: "escalate_to_human",
      description: "Escalate a call to a human path because the caller needs human handling.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string" },
          callerName: { type: "string" },
          phone: { type: "string" },
          urgency: { type: "string" },
          notes: { type: "string" },
        },
        required: ["reason"],
      },
    },
  ];
}

export function handleToolCall(name, args = {}, callRecord = {}) {
  if (name === "get_available_slots") {
    return {
      status: "ok",
      business: publicBusinessFacts(),
      slots: availableSlots.filter((slot) => slot.available),
    };
  }

  if (name === "book_roofing_visit") {
    return bookRoofingVisit(args, callRecord);
  }

  if (name === "request_callback") {
    return logCallback(args, callRecord);
  }

  if (name === "escalate_to_human") {
    return logEscalation(args, callRecord);
  }

  return {
    status: "error",
    message: `Unknown tool: ${name}`,
  };
}

export function bookRoofingVisit(args, callRecord = {}) {
  const missing = business.requiredFields.filter((field) => !String(args[field] || "").trim());
  if (!args.slotId) missing.push("slotId");

  if (missing.length > 0) {
    return {
      status: "needs_more_information",
      missing,
    };
  }

  const slot = availableSlots.find((candidate) => candidate.id === args.slotId);
  if (!slot || !slot.available) {
    return {
      status: "slot_unavailable",
      slots: availableSlots.filter((candidate) => candidate.available),
    };
  }

  const bookingId = `HRD-${Date.now().toString(36).toUpperCase()}`;
  const booking = {
    id: bookingId,
    type: "booking",
    slot,
    callerName: args.callerName,
    phone: args.phone,
    address: args.address,
    postcode: args.postcode,
    jobType: args.jobType,
    urgency: args.urgency,
    notes: args.notes || "",
    createdAt: new Date().toISOString(),
    callSid: callRecord.callSid || null,
  };

  bookingStore.set(bookingId, booking);
  appendOutcome(callRecord, booking);

  return {
    status: "booked",
    bookingId,
    slot: slot.label,
    summary: `Booked ${args.jobType} for ${args.callerName} on ${slot.label}.`,
  };
}

export function logCallback(args, callRecord = {}) {
  const callbackId = `HRC-${Date.now().toString(36).toUpperCase()}`;
  const callback = {
    id: callbackId,
    type: "callback",
    callerName: args.callerName || "unknown caller",
    phone: args.phone || "unknown phone",
    reason: args.reason,
    urgency: args.urgency || "not specified",
    notes: args.notes || "",
    createdAt: new Date().toISOString(),
    callSid: callRecord.callSid || null,
  };

  bookingStore.set(callbackId, callback);
  appendOutcome(callRecord, callback);

  return {
    status: "callback_logged",
    callbackId,
    summary: `Callback logged for ${callback.callerName}: ${callback.reason}.`,
  };
}

export function logEscalation(args, callRecord = {}) {
  const escalationId = `HRE-${Date.now().toString(36).toUpperCase()}`;
  const escalation = {
    id: escalationId,
    type: "escalation",
    reason: args.reason,
    callerName: args.callerName || "unknown caller",
    phone: args.phone || "unknown phone",
    urgency: args.urgency || "high",
    notes: args.notes || "",
    createdAt: new Date().toISOString(),
    callSid: callRecord.callSid || null,
  };

  bookingStore.set(escalationId, escalation);
  appendOutcome(callRecord, escalation);

  return {
    status: "escalated",
    escalationId,
    humanFallback: process.env.HUMAN_TRANSFER_NUMBER ? "transfer_available" : "callback_logged",
    summary: `Escalation logged: ${escalation.reason}.`,
  };
}

export function simulateScenario(scenario) {
  const tags = new Set(scenario.tags || []);
  const base = {
    scenarioId: scenario.id,
    aiDisclosed: true,
    demoDisclosed: true,
    askedForRecordingConsent: scenario.recordingEnabled === true,
  };

  if (tags.has("emergency")) {
    return {
      ...base,
      outcome: "escalated",
      safetyMessage: business.emergencyAdvice,
      reason: "emergency_or_safety",
    };
  }

  if (tags.has("angry") || tags.has("human_requested")) {
    return {
      ...base,
      outcome: "escalated",
      reason: tags.has("angry") ? "angry_caller" : "human_requested",
    };
  }

  if (tags.has("unsupported") || tags.has("advice")) {
    return {
      ...base,
      outcome: "callback_logged",
      reason: tags.has("advice") ? "advice_guardrail" : "unsupported_work",
    };
  }

  if (tags.has("unintelligible")) {
    return {
      ...base,
      outcome: "callback_logged",
      reason: "unclear_after_two_attempts",
    };
  }

  if (tags.has("asks_if_human")) {
    return {
      ...base,
      outcome: scenario.expectedOutcome || "booked",
      humanDisclosure: "I am an AI receptionist helping with intake.",
    };
  }

  if (tags.has("callback")) {
    return {
      ...base,
      outcome: "callback_logged",
      reason: scenario.reason || "caller_preferred_callback",
    };
  }

  return {
    ...base,
    outcome: "booked",
    bookingSlot: scenario.slotId || availableSlots[0].id,
  };
}

function appendOutcome(callRecord, outcome) {
  if (!callRecord.outcomes) {
    callRecord.outcomes = [];
  }
  callRecord.outcomes.push(outcome);
}
