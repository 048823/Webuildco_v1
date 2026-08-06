export const scenarios = [
  {
    id: "01-straight-leak-booking",
    tags: ["booking"],
    slotId: "2026-08-04-0900",
    expectedOutcome: "booked",
  },
  {
    id: "02-after-hours-callback",
    tags: ["callback"],
    expectedOutcome: "callback_logged",
  },
  {
    id: "03-gutter-repair-booking",
    tags: ["booking"],
    slotId: "2026-08-04-1400",
    expectedOutcome: "booked",
  },
  {
    id: "04-storm-damage-urgent-callback",
    tags: ["callback"],
    reason: "urgent_storm_damage",
    expectedOutcome: "callback_logged",
  },
  {
    id: "05-emergency-collapse-risk",
    tags: ["emergency"],
    expectedOutcome: "escalated",
  },
  {
    id: "06-emergency-active-electrical-risk",
    tags: ["emergency"],
    expectedOutcome: "escalated",
  },
  {
    id: "07-angry-missed-tradie",
    tags: ["angry"],
    expectedOutcome: "escalated",
  },
  {
    id: "08-caller-asks-for-human",
    tags: ["human_requested"],
    expectedOutcome: "escalated",
  },
  {
    id: "09-caller-asks-if-human",
    tags: ["asks_if_human"],
    expectedOutcome: "booked",
  },
  {
    id: "10-heavy-background-noise",
    tags: ["background_noise", "unintelligible"],
    expectedOutcome: "callback_logged",
  },
  {
    id: "11-australian-accent-broad",
    tags: ["accent", "booking"],
    slotId: "2026-08-05-1100",
    expectedOutcome: "booked",
  },
  {
    id: "12-australian-accent-fast-speech",
    tags: ["accent", "booking"],
    slotId: "2026-08-06-1500",
    expectedOutcome: "booked",
  },
  {
    id: "13-interruption-while-agent-speaking",
    tags: ["interruption", "booking"],
    expectedOutcome: "booked",
  },
  {
    id: "14-interruption-change-slot",
    tags: ["interruption", "booking"],
    slotId: "2026-08-04-1400",
    expectedOutcome: "booked",
  },
  {
    id: "15-unsupported-solar-electrical",
    tags: ["unsupported"],
    expectedOutcome: "callback_logged",
  },
  {
    id: "16-unsupported-insurance-advice",
    tags: ["advice"],
    expectedOutcome: "callback_logged",
  },
  {
    id: "17-unsupported-structural-certification",
    tags: ["unsupported"],
    expectedOutcome: "callback_logged",
  },
  {
    id: "18-price-quote-request",
    tags: ["advice"],
    expectedOutcome: "callback_logged",
  },
  {
    id: "19-no-phone-number-given",
    tags: ["callback"],
    expectedOutcome: "callback_logged",
  },
  {
    id: "20-no-address-yet",
    tags: ["callback"],
    expectedOutcome: "callback_logged",
  },
  {
    id: "21-out-of-service-area",
    tags: ["unsupported"],
    expectedOutcome: "callback_logged",
  },
  {
    id: "22-repeat-caller-asks-status",
    tags: ["callback"],
    reason: "status_request",
    expectedOutcome: "callback_logged",
  },
  {
    id: "23-privacy-question",
    tags: ["human_requested"],
    expectedOutcome: "escalated",
  },
  {
    id: "24-recording-consent-enabled",
    tags: ["booking"],
    recordingEnabled: true,
    expectedOutcome: "booked",
  },
  {
    id: "25-wants-today-only-no-slots",
    tags: ["callback"],
    reason: "no_matching_slot",
    expectedOutcome: "callback_logged",
  },
  {
    id: "26-elderly-caller-slow",
    tags: ["booking"],
    expectedOutcome: "booked",
  },
  {
    id: "27-caller-changes-job-type",
    tags: ["interruption", "booking"],
    expectedOutcome: "booked",
  },
  {
    id: "28-rude-but-not-angry",
    tags: ["booking"],
    expectedOutcome: "booked",
  },
  {
    id: "29-business-owner-tests-demo",
    tags: ["asks_if_human", "booking"],
    expectedOutcome: "booked",
  },
  {
    id: "30-cannot-understand-after-two-tries",
    tags: ["unintelligible"],
    expectedOutcome: "callback_logged",
  },
];
