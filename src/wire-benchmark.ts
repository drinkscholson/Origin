import { encodePacket, estimateUtf8Bytes } from "./codec.js";
import { renderEnglish } from "./render.js";
import { summarizeWorkflow } from "./workflow.js";
import { INCIDENT_RESPONSE_WORKFLOW } from "./workflows.js";
import { encodeWireBundle, estimateWireBytes } from "./wire.js";

const packets = INCIDENT_RESPONSE_WORKFLOW.steps.map((step) => step.packet);
const summary = summarizeWorkflow(INCIDENT_RESPONSE_WORKFLOW);
const wireBundle = encodeWireBundle(packets);

const englishBytes = packets.reduce(
  (total, packet) => total + estimateUtf8Bytes(renderEnglish(packet)),
  0,
);
const o1Bytes = packets.reduce(
  (total, packet) => total + estimateUtf8Bytes(encodePacket(packet)),
  0,
);
const frameBytes = summary.stats.frameTotal;
const wireBytes = estimateWireBytes(wireBundle);

console.table([
  { format: "English", bytes: englishBytes },
  { format: "O1 packets", bytes: o1Bytes },
  { format: "F1 frames", bytes: frameBytes },
  { format: "W1 wire bundle", bytes: wireBytes },
]);

console.log("");
console.log(`O1 vs English : ${ratio(englishBytes, o1Bytes)}`);
console.log(`F1 vs English : ${ratio(englishBytes, frameBytes)}`);
console.log(`W1 vs English : ${ratio(englishBytes, wireBytes)}`);
console.log(`W1 vs O1      : ${ratio(o1Bytes, wireBytes)}`);
console.log(`W1 vs F1      : ${ratio(frameBytes, wireBytes)}`);

function ratio(base: number, next: number): string {
  return `${((1 - next / base) * 100).toFixed(1)}%`;
}
