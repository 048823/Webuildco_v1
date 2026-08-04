import { estimateTable } from "../src/cost-model.js";

const table = estimateTable();

for (const row of table) {
  console.log(
    [
      `${row.callsPerMonth} calls/month`,
      `${row.minutes.toFixed(0)} minutes`,
      `$${row.perCallUsd.toFixed(2)} USD/call`,
      `$${row.totalUsd.toFixed(2)} USD/month`,
      `A$${row.totalAud.toFixed(2)} AUD/month`,
    ].join(" | "),
  );
}
