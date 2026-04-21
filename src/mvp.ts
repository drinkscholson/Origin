import { encodePacket } from "./codec.js";
import { encodeFrame } from "./frame.js";
import { renderEnglish } from "./render.js";
import { summarizeWorkflow } from "./workflow.js";
import { INCIDENT_RESPONSE_WORKFLOW } from "./workflows.js";

const summary = summarizeWorkflow(INCIDENT_RESPONSE_WORKFLOW);

console.log(`Origin MVP: ${INCIDENT_RESPONSE_WORKFLOW.title}`);
console.log(INCIDENT_RESPONSE_WORKFLOW.summary);
console.log("");

for (const [index, step] of INCIDENT_RESPONSE_WORKFLOW.steps.entries()) {
  const packetSummary = summary.diagnostics[index];

  console.log(`${index + 1}. ${step.label}`);
  console.log(`English : ${renderEnglish(step.packet)}`);
  console.log(`Packet  : ${encodePacket(step.packet)}`);

  if (packetSummary.diagnostics.length === 0) {
    console.log("Notes   : clean");
  } else {
    console.log(
      `Notes   : ${packetSummary.diagnostics
        .map((item) => `${item.severity}:${item.code}`)
        .join(", ")}`,
    );
  }

  console.log("");
}

console.log("Frame compression");
console.log("");

for (const [index, frame] of summary.frames.entries()) {
  console.log(`Frame ${index + 1}`);
  console.log(encodeFrame(frame));
  console.log("");
}

console.log(`Frame roundtrip: ${summary.frameRoundTripOk ? "ok" : "failed"}`);
console.log("");

console.log("Reference integrity");
console.log(
  `Links: ${summary.ledger.links.length}, duplicate ids: ${summary.ledger.duplicateIds.length}, reference issues: ${summary.ledger.referenceIssues.length}`,
);
console.log("");

if (summary.ledger.derivedConflicts.length > 0) {
  console.log("Derived conflicts");

  for (const conflict of summary.ledger.derivedConflicts) {
    console.log(
      `- ${conflict.id}: ${conflict.leftId} vs ${conflict.rightId} on ${conflict.subject} (${conflict.reason})`,
    );
  }

  console.log("");
}

console.table([
  {
    metric: "English bytes",
    value: summary.stats.englishTotal,
  },
  {
    metric: "Packet bytes",
    value: summary.stats.packetTotal,
  },
  {
    metric: "Frame bytes",
    value: summary.stats.frameTotal,
  },
  {
    metric: "Packet vs English",
    value: summary.stats.packetSavings,
  },
  {
    metric: "Frame vs English",
    value: summary.stats.frameSavings,
  },
  {
    metric: "Frame vs Packet",
    value: summary.stats.frameVsPacketSavings,
  },
  {
    metric: "Derived conflicts",
    value: summary.ledger.derivedConflicts.length,
  },
  {
    metric: "Reference issues",
    value: summary.ledger.referenceIssues.length,
  },
]);
