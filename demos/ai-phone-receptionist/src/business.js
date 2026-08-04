export const business = {
  name: "Harbourview Roofing Demo Co",
  shortName: "Harbourview Roofing",
  demoDisclosure:
    "This is a demo AI receptionist for an invented business. It is not a real roofing company.",
  city: "Sydney",
  serviceArea: [
    "Inner West",
    "Eastern Suburbs",
    "Lower North Shore",
    "Sydney CBD",
    "Northern Beaches",
  ],
  services: [
    "roof leak inspection",
    "storm damage assessment",
    "gutter repair",
    "tile replacement",
    "metal roof maintenance",
    "roof ventilation check",
  ],
  unsupported: [
    "solar panel electrical work",
    "structural engineering certification",
    "insurance claim advice",
    "emergency rescue",
    "medical, legal, financial, or emergency advice",
  ],
  humanFallbackLabel: "the roofing team",
  emergencyAdvice:
    "If anyone is in immediate danger, hang up and call 000. For storm or flood help in NSW, call the SES on 132 500.",
  summaryRecipient: "demo owner",
  defaultTimezone: "Australia/Sydney",
  requiredFields: [
    "callerName",
    "phone",
    "address",
    "postcode",
    "jobType",
    "urgency",
  ],
};

export const availableSlots = [
  {
    id: "2026-08-04-0900",
    label: "Tuesday 4 August 2026 at 9:00 am AEST",
    startsAt: "2026-08-04T09:00:00+10:00",
    available: true,
  },
  {
    id: "2026-08-04-1400",
    label: "Tuesday 4 August 2026 at 2:00 pm AEST",
    startsAt: "2026-08-04T14:00:00+10:00",
    available: true,
  },
  {
    id: "2026-08-05-1100",
    label: "Wednesday 5 August 2026 at 11:00 am AEST",
    startsAt: "2026-08-05T11:00:00+10:00",
    available: true,
  },
  {
    id: "2026-08-06-1500",
    label: "Thursday 6 August 2026 at 3:00 pm AEST",
    startsAt: "2026-08-06T15:00:00+10:00",
    available: true,
  },
];

export function publicBusinessFacts() {
  return {
    name: business.name,
    demoDisclosure: business.demoDisclosure,
    city: business.city,
    serviceArea: business.serviceArea,
    services: business.services,
    unsupported: business.unsupported,
    availableSlots: availableSlots.filter((slot) => slot.available),
  };
}
