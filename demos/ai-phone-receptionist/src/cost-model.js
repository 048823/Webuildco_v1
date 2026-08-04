export const ratesUsd = {
  averageCallMinutes: 3.5,
  audUsdFx: 1.54,
  twilioAuLocalNumberMonthly: 3.0,
  twilioAuInboundLocalPerMinute: 0.01,
  twilioMediaStreamsPerMinute: 0.0044,
  openaiRealtimeMiniBudgetPerMinute: 0.035,
  twilioAuOutboundSmsPerSegment: 0.0515,
  emailPerMessage: 0,
};

export function estimateMonthlyCost(callsPerMonth, options = {}) {
  const rates = { ...ratesUsd, ...options };
  const minutes = callsPerMonth * rates.averageCallMinutes;
  const telephony = minutes * rates.twilioAuInboundLocalPerMinute;
  const mediaStreams = minutes * rates.twilioMediaStreamsPerMinute;
  const model = minutes * rates.openaiRealtimeMiniBudgetPerMinute;
  const sms = callsPerMonth * rates.twilioAuOutboundSmsPerSegment;
  const email = callsPerMonth * rates.emailPerMessage;
  const fixed = rates.twilioAuLocalNumberMonthly;
  const totalUsd = telephony + mediaStreams + model + sms + email + fixed;

  return {
    callsPerMonth,
    averageCallMinutes: rates.averageCallMinutes,
    minutes,
    perCallUsd: totalUsd / callsPerMonth,
    totalUsd,
    totalAud: totalUsd * rates.audUsdFx,
    componentsUsd: {
      fixed,
      telephony,
      mediaStreams,
      model,
      sms,
      email,
    },
  };
}

export function estimateTable(volumes = [50, 200, 500], options = {}) {
  return volumes.map((volume) => estimateMonthlyCost(volume, options));
}
