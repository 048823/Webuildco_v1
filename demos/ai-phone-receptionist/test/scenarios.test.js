import assert from "node:assert/strict";
import test from "node:test";
import { availableSlots, business } from "../src/business.js";
import { bookRoofingVisit, makeInstructions, simulateScenario } from "../src/receptionist.js";
import { estimateMonthlyCost } from "../src/cost-model.js";
import { scenarios } from "./scenarios.js";

test("scenario matrix covers the required edge cases", () => {
  assert.equal(scenarios.length, 30);
  assert.ok(scenarios.some((scenario) => scenario.tags.includes("interruption")));
  assert.ok(scenarios.some((scenario) => scenario.tags.includes("accent")));
  assert.ok(scenarios.some((scenario) => scenario.tags.includes("background_noise")));
  assert.ok(scenarios.some((scenario) => scenario.tags.includes("emergency")));
  assert.ok(scenarios.some((scenario) => scenario.tags.includes("angry")));
  assert.ok(scenarios.some((scenario) => scenario.tags.includes("unsupported")));
  assert.ok(scenarios.some((scenario) => scenario.tags.includes("asks_if_human")));
});

for (const scenario of scenarios) {
  test(`scenario ${scenario.id}: ${scenario.expectedOutcome}`, () => {
    const result = simulateScenario(scenario);
    assert.equal(result.outcome, scenario.expectedOutcome);
    assert.equal(result.aiDisclosed, true);
    assert.equal(result.demoDisclosed, true);

    if (scenario.tags.includes("emergency")) {
      assert.match(result.safetyMessage, /000/);
      assert.match(result.safetyMessage, /SES/);
    }

    if (scenario.tags.includes("asks_if_human")) {
      assert.match(result.humanDisclosure, /AI receptionist/);
    }

    if (scenario.recordingEnabled) {
      assert.equal(result.askedForRecordingConsent, true);
    }
  });
}

test("instructions include disclosure, demo status, escalation, and forbidden advice", () => {
  const instructions = makeInstructions({ recordCalls: false });
  assert.match(instructions, /AI receptionist/);
  assert.match(instructions, /demo/);
  assert.match(instructions, /not a human/);
  assert.match(instructions, /000/);
  assert.match(instructions, /SES/);
  assert.match(instructions, /medical, legal, emergency, or financial advice/);
});

test("booking tool requires all qualification fields", () => {
  const result = bookRoofingVisit({
    callerName: "Amina",
    phone: "+61400000000",
    slotId: availableSlots[0].id,
  });

  assert.equal(result.status, "needs_more_information");
  assert.deepEqual(
    result.missing.sort(),
    ["address", "jobType", "postcode", "urgency"].sort(),
  );
});

test("booking tool creates a booking with complete data", () => {
  const result = bookRoofingVisit({
    callerName: "Amina",
    phone: "+61400000000",
    address: "12 Demo Street, Marrickville",
    postcode: "2204",
    jobType: "roof leak inspection",
    urgency: "water stain after rain",
    slotId: availableSlots[0].id,
  });

  assert.equal(result.status, "booked");
  assert.match(result.bookingId, /^HRD-/);
});

test("cost model keeps the productized service margin visible", () => {
  const estimate = estimateMonthlyCost(200);
  assert.equal(estimate.callsPerMonth, 200);
  assert.equal(estimate.averageCallMinutes, 3.5);
  assert.ok(estimate.totalUsd > 40);
  assert.ok(estimate.totalAud > estimate.totalUsd);
  assert.ok(estimate.perCallUsd < 0.5);
});

test("business is clearly an invented demo business", () => {
  assert.match(business.name, /Demo/);
  assert.match(business.demoDisclosure, /invented business/);
});
